import os
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Request, HTTPException, status
from jose import jwt, JWTError
from passlib.context import CryptContext
from sqlalchemy import select
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import AsyncSessionLocal

JWT_SECRET = os.environ.get("JWT_SECRET", "change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 30
RESET_TOKEN_TTL_MINUTES = 30

# Shared limiter — mounted in main.py, used as decorator on rate-limited routes.
limiter = Limiter(key_func=get_remote_address)


# ── Password hashing ─────────────────────────────────────────────
# Argon2 is the default; bcrypt is kept for verifying legacy hashes written
# before the migration. Successful logins against a bcrypt hash should be
# rehashed by the caller (see `password_needs_rehash`).

_pwd_context = CryptContext(
    schemes=["argon2", "bcrypt"],
    deprecated=["bcrypt"],
    default="argon2",
)


def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return _pwd_context.verify(plain, hashed)
    except (ValueError, TypeError):
        return False


def password_needs_rehash(hashed: str) -> bool:
    """True when `hashed` was produced by a deprecated scheme (bcrypt)."""
    try:
        return _pwd_context.needs_update(hashed)
    except (ValueError, TypeError):
        return False


# ── JWT ──────────────────────────────────────────────────────────

def create_jwt(*, merchant_id: str, workspace_id: str, email: str, store_id: Optional[str] = None) -> str:
    """Mint a merchant-scoped JWT.

    `sub` is the merchant_id going forward. `store_id` is included transitionally
    so legacy resolvers (get_store_from_jwt) keep working while callers migrate.
    """
    expire = datetime.utcnow() + timedelta(days=JWT_EXPIRE_DAYS)
    payload = {
        "sub": merchant_id,
        "merchant_id": merchant_id,
        "workspace_id": workspace_id,
        "email": email,
        "exp": expire,
    }
    if store_id:
        payload["store_id"] = store_id
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_jwt(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


def _bearer_payload(request: Request) -> dict:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    payload = decode_jwt(auth_header[7:])
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    return payload


# ── Resolvers ────────────────────────────────────────────────────

async def get_merchant_from_jwt(request: Request):
    from models import Merchant

    payload = _bearer_payload(request)
    merchant_id = payload.get("merchant_id") or payload.get("sub")

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Merchant).where(Merchant.id == merchant_id))
        merchant = result.scalars().first()

    if not merchant:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Merchant not found",
        )
    return merchant


async def get_workspace_from_jwt(request: Request):
    """Preferred resolver for Phase 1+ routes. Returns the Workspace row.

    Multi-tenancy rule: every downstream query filters on workspace_id.
    """
    from models import Workspace

    payload = _bearer_payload(request)
    workspace_id = payload.get("workspace_id")
    if not workspace_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token missing workspace_id",
        )

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Workspace).where(Workspace.id == workspace_id))
        workspace = result.scalars().first()

    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Workspace not found",
        )
    return workspace


async def get_store_from_jwt(request: Request):
    """Legacy resolver — used by /auth/profile, /labs/*, and existing insights routes
    that were written against the pre-workspace model. New routes should prefer
    get_workspace_from_jwt.
    """
    from models import Store

    payload = _bearer_payload(request)
    # Prefer explicit store_id claim; fall back to looking up via workspace_id;
    # last-resort legacy path uses sub (which used to be store_id).
    store_id = payload.get("store_id")
    workspace_id = payload.get("workspace_id")

    async with AsyncSessionLocal() as session:
        store = None
        if store_id:
            store = (await session.execute(select(Store).where(Store.id == store_id))).scalars().first()
        if not store and workspace_id:
            store = (
                await session.execute(select(Store).where(Store.workspace_id == workspace_id))
            ).scalars().first()
        if not store:
            legacy_sub = payload.get("sub")
            if legacy_sub:
                store = (await session.execute(select(Store).where(Store.id == legacy_sub))).scalars().first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Store not found",
        )
    return store


async def get_store_from_api_key(request: Request):
    """WordPress plugin path — kept intentionally under the legacy header name."""
    from models import Store

    api_key = request.headers.get("X-Shelf-API-Key")
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Shelf-API-Key header",
        )

    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Store).where(Store.api_key == api_key))
        store = result.scalars().first()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
        )
    return store


# ── Session tokens (opaque, for reset flow) ─────────────────────

def new_opaque_token() -> str:
    return secrets.token_urlsafe(32)


def reset_token_expiry() -> datetime:
    return datetime.utcnow() + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)
