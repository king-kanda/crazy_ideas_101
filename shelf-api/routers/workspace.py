import uuid

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Store, Merchant, Workspace
from schemas import WorkspaceMeResponse, CreateStoreRequest, CreateStoreResponse
from auth import get_workspace_from_jwt

router = APIRouter()


@router.get("/me", response_model=WorkspaceMeResponse)
async def workspace_me(
    db: AsyncSession = Depends(get_db),
    workspace: Workspace = Depends(get_workspace_from_jwt),
):
    merchant = (
        await db.execute(select(Merchant).where(Merchant.id == workspace.merchant_id))
    ).scalars().first()
    if not merchant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant not found")

    store = (
        await db.execute(select(Store).where(Store.workspace_id == workspace.id))
    ).scalars().first()

    return WorkspaceMeResponse(
        merchant_id=str(merchant.id),
        workspace_id=str(workspace.id),
        business_name=merchant.business_name,
        email=merchant.email,
        timezone=workspace.timezone,
        currency=workspace.currency,
        has_store=store is not None,
        store_id=str(store.id) if store else None,
        store_name=store.store_name if store else None,
    )


@router.post("/store", response_model=CreateStoreResponse, status_code=status.HTTP_201_CREATED)
async def create_store(
    body: CreateStoreRequest,
    db: AsyncSession = Depends(get_db),
    workspace: Workspace = Depends(get_workspace_from_jwt),
):
    """Connect a store to the authenticated workspace.

    Used by onboarding when a merchant already has a workspace but no store yet —
    e.g. a Google (OAuth) signup, which creates the merchant + workspace but no
    store. Password signups still create everything in one shot via /auth/signup.
    """
    existing = (
        await db.execute(select(Store).where(Store.workspace_id == workspace.id))
    ).scalars().first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This workspace already has a store connected",
        )

    merchant = (
        await db.execute(select(Merchant).where(Merchant.id == workspace.merchant_id))
    ).scalars().first()
    if not merchant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Merchant not found")

    new_api_key = str(uuid.uuid4())
    store = Store(
        id=uuid.uuid4(),
        workspace_id=workspace.id,
        owner_email=merchant.email,
        owner_password_hash=merchant.password_hash,  # may be None for OAuth merchants
        store_name=body.store_name,
        store_url=body.store_url,
        niche=body.niche,
        location_country=body.location_country,
        location_city=body.location_city,
        api_key=new_api_key,
    )
    db.add(store)
    await db.commit()

    return CreateStoreResponse(
        store_id=str(store.id),
        api_key=new_api_key,
        store_name=store.store_name,
        store_url=store.store_url,
    )
