import uuid
import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Request, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Store, Merchant, Workspace, Session as AuthSession, OAuthAccount
from schemas import (
    SignupRequest, LoginRequest, SignupResponse, VerifyResponse,
    RegenerateKeyResponse, StoreProfileResponse, UpdateProfileRequest,
    LogoutResponse, ResetPasswordRequest, ResetPasswordResponse,
    ResetPasswordConfirmRequest, ResetPasswordConfirmResponse,
    WorkspaceMeResponse, OAuthRequest,
)
from auth import (
    hash_password, verify_password, create_jwt, decode_jwt,
    get_store_from_api_key, get_store_from_jwt,
    get_merchant_from_jwt, get_workspace_from_jwt,
    new_opaque_token, reset_token_expiry, limiter,
)

log = logging.getLogger("palda.auth")
router = APIRouter()


# ── Signup / Login ────────────────────────────────────────────────

@router.post("/signup", response_model=SignupResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def signup(request: Request, body: SignupRequest, db: AsyncSession = Depends(get_db)):
    # Reject duplicates by merchant email (the canonical uniqueness key going forward)
    # and by legacy stores.owner_email to catch pre-migration accounts.
    existing_merchant = await db.execute(select(Merchant).where(Merchant.email == body.email))
    if existing_merchant.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )
    existing_store = await db.execute(select(Store).where(Store.owner_email == body.email))
    if existing_store.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    pw_hash = hash_password(body.password)

    merchant = Merchant(
        id=uuid.uuid4(),
        business_name=body.store_name,
        email=body.email,
        password_hash=pw_hash,
        status="active",
    )
    db.add(merchant)
    await db.flush()

    workspace = Workspace(id=uuid.uuid4(), merchant_id=merchant.id)
    db.add(workspace)
    await db.flush()

    new_api_key = str(uuid.uuid4())
    store = Store(
        id=uuid.uuid4(),
        workspace_id=workspace.id,
        owner_email=body.email,
        owner_password_hash=pw_hash,
        store_name=body.store_name,
        store_url=body.store_url,
        niche=body.niche,
        location_country=body.location_country,
        location_city=body.location_city,
        api_key=new_api_key,
    )
    db.add(store)
    await db.commit()

    token = create_jwt(
        merchant_id=str(merchant.id),
        workspace_id=str(workspace.id),
        email=merchant.email,
        store_id=str(store.id),
    )
    return SignupResponse(
        token=token,
        api_key=new_api_key,
        store_id=str(store.id),
        workspace_id=str(workspace.id),
        merchant_id=str(merchant.id),
    )


@router.post("/login", response_model=SignupResponse)
@limiter.limit("10/minute")
async def login(request: Request, body: LoginRequest, db: AsyncSession = Depends(get_db)):
    # Preferred path: merchants table.
    merchant_row = (
        await db.execute(select(Merchant).where(Merchant.email == body.email))
    ).scalars().first()

    if merchant_row and merchant_row.password_hash and verify_password(body.password, merchant_row.password_hash):
        workspace = (
            await db.execute(select(Workspace).where(Workspace.merchant_id == merchant_row.id))
        ).scalars().first()
        if not workspace:
            # Backfill was expected to create one; guard anyway so we never return a token
            # without a workspace_id claim.
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Workspace missing for merchant — contact support",
            )
        store = (
            await db.execute(select(Store).where(Store.workspace_id == workspace.id))
        ).scalars().first()
        token = create_jwt(
            merchant_id=str(merchant_row.id),
            workspace_id=str(workspace.id),
            email=merchant_row.email,
            store_id=str(store.id) if store else None,
        )
        return SignupResponse(
            token=token,
            api_key=store.api_key if store else "",
            store_id=str(store.id) if store else "",
            workspace_id=str(workspace.id),
            merchant_id=str(merchant_row.id),
        )

    # Legacy fallback: authenticate against stores.owner_email (rows that missed backfill
    # somehow, or edge-case pre-migration accounts). If it works, mint a JWT that
    # matches whatever workspace_id has been linked.
    store = (
        await db.execute(select(Store).where(Store.owner_email == body.email))
    ).scalars().first()
    if store and store.owner_password_hash and verify_password(body.password, store.owner_password_hash):
        workspace_id = store.workspace_id
        if not workspace_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Store has no workspace — backfill did not run",
            )
        merchant = (
            await db.execute(select(Merchant).where(Merchant.email == body.email))
        ).scalars().first()
        merchant_id = str(merchant.id) if merchant else str(workspace_id)
        token = create_jwt(
            merchant_id=merchant_id,
            workspace_id=str(workspace_id),
            email=body.email,
            store_id=str(store.id),
        )
        return SignupResponse(
            token=token,
            api_key=store.api_key,
            store_id=str(store.id),
            workspace_id=str(workspace_id),
            merchant_id=merchant_id,
        )

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid email or password",
    )


@router.post("/oauth", response_model=SignupResponse)
@limiter.limit("10/minute")
async def oauth(request: Request, body: OAuthRequest, db: AsyncSession = Depends(get_db)):
    """Find-or-create a merchant from a verified OAuth identity (Google, MVP).

    The frontend NextAuth flow calls this after a successful Google sign-in.
    Email is the canonical key: an existing password merchant with the same email
    gets an `oauth_accounts` row attached (account linking) rather than an error.
    OAuth-only merchants are created with no `password_hash`. No Store is created
    here — Google signups land in onboarding to connect their store, and the
    frontend keys off an empty `store_id` to route there.
    """
    if body.provider != "google":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported OAuth provider",
        )

    # 1. Existing link by (provider, provider_account_id) — the fast path for returns.
    link = (
        await db.execute(
            select(OAuthAccount).where(
                OAuthAccount.provider == body.provider,
                OAuthAccount.provider_account_id == body.provider_account_id,
            )
        )
    ).scalars().first()

    merchant: Merchant | None = None
    if link:
        merchant = (
            await db.execute(select(Merchant).where(Merchant.id == link.merchant_id))
        ).scalars().first()

    # 2. No link yet — resolve by email (links an existing password account).
    if merchant is None:
        merchant = (
            await db.execute(select(Merchant).where(Merchant.email == body.email))
        ).scalars().first()

        if merchant is None:
            # Brand-new OAuth merchant: create Merchant + Workspace, no password, no store.
            merchant = Merchant(
                id=uuid.uuid4(),
                business_name=body.name or body.email.split("@")[0],
                email=body.email,
                password_hash=None,
                status="active",
            )
            db.add(merchant)
            await db.flush()
            db.add(Workspace(id=uuid.uuid4(), merchant_id=merchant.id))
            await db.flush()

        # Attach the OAuth identity (covers both freshly-created and linked accounts).
        db.add(OAuthAccount(
            id=uuid.uuid4(),
            merchant_id=merchant.id,
            provider=body.provider,
            provider_account_id=body.provider_account_id,
        ))
        await db.flush()

    # Resolve workspace (backfill guarantees one for legacy accounts; new ones just made it).
    workspace = (
        await db.execute(select(Workspace).where(Workspace.merchant_id == merchant.id))
    ).scalars().first()
    if not workspace:
        workspace = Workspace(id=uuid.uuid4(), merchant_id=merchant.id)
        db.add(workspace)
        await db.flush()

    store = (
        await db.execute(select(Store).where(Store.workspace_id == workspace.id))
    ).scalars().first()

    await db.commit()

    token = create_jwt(
        merchant_id=str(merchant.id),
        workspace_id=str(workspace.id),
        email=merchant.email,
        store_id=str(store.id) if store else None,
    )
    return SignupResponse(
        token=token,
        api_key=store.api_key if store else "",
        store_id=str(store.id) if store else "",
        workspace_id=str(workspace.id),
        merchant_id=str(merchant.id),
    )


@router.post("/logout", response_model=LogoutResponse)
async def logout(
    request: Request,
    db: AsyncSession = Depends(get_db),
    merchant: Merchant = Depends(get_merchant_from_jwt),
):
    # Stateless JWT — record a logout marker session so we have an audit trail
    # even before we move to server-side session validation.
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[7:] if auth_header.startswith("Bearer ") else ""
    if token:
        db.add(AuthSession(
            id=uuid.uuid4(),
            merchant_id=merchant.id,
            token=token[:255],
            kind="logout",
            expires_at=datetime.utcnow(),
            revoked_at=datetime.utcnow(),
        ))
        await db.commit()
    return LogoutResponse(logged_out=True)


# ── Password reset ───────────────────────────────────────────────

@router.post("/reset-password", response_model=ResetPasswordResponse)
@limiter.limit("5/minute")
async def reset_password_request(
    request: Request,
    body: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    # Always return 200 to avoid user enumeration. Only mint a token if the
    # merchant exists. Email delivery is deferred (PRD: no user-facing email in MVP);
    # the token is echoed in the response as `dev_token` for now so the flow is
    # exercisable end-to-end.
    merchant = (
        await db.execute(select(Merchant).where(Merchant.email == body.email))
    ).scalars().first()

    if not merchant:
        log.info("reset_password: no merchant for %s", body.email)
        return ResetPasswordResponse(accepted=True, dev_token=None)

    token = new_opaque_token()
    db.add(AuthSession(
        id=uuid.uuid4(),
        merchant_id=merchant.id,
        token=token,
        kind="reset",
        expires_at=reset_token_expiry(),
    ))
    await db.commit()
    log.info("reset_password: minted reset token for merchant %s", merchant.id)
    return ResetPasswordResponse(accepted=True, dev_token=token)


@router.post("/reset-password/confirm", response_model=ResetPasswordConfirmResponse)
@limiter.limit("10/minute")
async def reset_password_confirm(
    request: Request,
    body: ResetPasswordConfirmRequest,
    db: AsyncSession = Depends(get_db),
):
    session_row = (
        await db.execute(select(AuthSession).where(
            AuthSession.token == body.token,
            AuthSession.kind == "reset",
        ))
    ).scalars().first()

    if not session_row or session_row.revoked_at is not None or session_row.expires_at < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset token is invalid or expired",
        )

    merchant = (
        await db.execute(select(Merchant).where(Merchant.id == session_row.merchant_id))
    ).scalars().first()
    if not merchant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant not found")

    new_hash = hash_password(body.new_password)
    merchant.password_hash = new_hash
    # Keep legacy stores.owner_password_hash in sync so plugin-only auth paths
    # don't fall out of parity while we still have both fields.
    store = (
        await db.execute(select(Store).where(Store.owner_email == merchant.email))
    ).scalars().first()
    if store:
        store.owner_password_hash = new_hash

    session_row.revoked_at = datetime.utcnow()
    await db.commit()
    return ResetPasswordConfirmResponse(reset=True)


# ── Legacy: kept unchanged for plugin + existing dashboards ──────

@router.post("/regenerate-key", response_model=RegenerateKeyResponse)
async def regenerate_key(
    db: AsyncSession = Depends(get_db),
    store: Store = Depends(get_store_from_jwt),
):
    store.api_key = str(uuid.uuid4())
    db.add(store)
    await db.commit()
    return RegenerateKeyResponse(api_key=store.api_key)


@router.get("/verify", response_model=VerifyResponse)
async def verify(store: Store = Depends(get_store_from_api_key)):
    return VerifyResponse(
        verified=True,
        store_name=store.store_name,
        store_id=str(store.id),
    )


@router.get("/profile", response_model=StoreProfileResponse)
async def get_profile(store: Store = Depends(get_store_from_jwt)):
    return StoreProfileResponse(
        store_name=store.store_name,
        store_url=store.store_url,
        niche=store.niche,
        location_country=store.location_country,
        location_city=store.location_city,
        plugin_site_url=store.plugin_site_url,
    )


@router.patch("/profile", response_model=StoreProfileResponse)
async def update_profile(
    body: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    store: Store = Depends(get_store_from_jwt),
):
    result = await db.execute(select(Store).where(Store.id == store.id))
    db_store = result.scalars().first()
    if not db_store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")

    if body.store_name is not None:
        db_store.store_name = body.store_name
    if body.store_url is not None:
        db_store.store_url = body.store_url
    if body.niche is not None:
        db_store.niche = body.niche
    if body.location_country is not None:
        db_store.location_country = body.location_country
    if body.location_city is not None:
        db_store.location_city = body.location_city

    db.add(db_store)
    await db.commit()
    await db.refresh(db_store)

    return StoreProfileResponse(
        store_name=db_store.store_name,
        store_url=db_store.store_url,
        niche=db_store.niche,
        location_country=db_store.location_country,
        location_city=db_store.location_city,
        plugin_site_url=db_store.plugin_site_url,
    )
