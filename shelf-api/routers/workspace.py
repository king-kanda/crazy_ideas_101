from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from database import get_db
from models import Store, Merchant, Workspace
from schemas import WorkspaceMeResponse
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
