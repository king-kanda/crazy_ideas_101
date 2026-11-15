"""WooCommerce integration status + resync trigger.

The plugin uses the existing X-Shelf-API-Key header path for data push, so
"connect" is implicit (completed at onboarding when the Store row is created
and api_key issued). This router surfaces status for the dashboard and
exposes a "Re-sync now" trigger that the plugin polls on each cron tick.
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_workspace_from_jwt, get_store_from_api_key
from database import get_db
from models import Store, Product, Order, SyncJob, Workspace
from schemas import WooCommerceStatus, ResyncResponse

router = APIRouter()

RESYNC_DEBOUNCE_SECONDS = 60


async def _active_store(workspace: Workspace, db: AsyncSession) -> Optional[Store]:
    return (
        await db.execute(select(Store).where(Store.workspace_id == workspace.id))
    ).scalars().first()


@router.get("/status", response_model=WooCommerceStatus)
async def status_endpoint(
    workspace: Workspace = Depends(get_workspace_from_jwt),
    db: AsyncSession = Depends(get_db),
):
    store = await _active_store(workspace, db)
    if not store:
        return WooCommerceStatus(connected=False)

    product_count = (
        await db.execute(select(func.count(Product.id)).where(Product.store_id == store.id))
    ).scalar() or 0
    order_count = (
        await db.execute(select(func.count(Order.id)).where(Order.store_id == store.id))
    ).scalar() or 0

    jobs = (
        await db.execute(
            select(SyncJob)
            .where(SyncJob.store_id == store.id)
            .order_by(desc(SyncJob.started_at))
            .limit(5)
        )
    ).scalars().all()

    return WooCommerceStatus(
        connected=True,
        store_url=store.store_url,
        plugin_site_url=store.plugin_site_url,
        last_sync_at=store.last_sync_at,
        resync_requested_at=store.resync_requested_at,
        product_count=product_count,
        order_count=order_count,
        recent_jobs=[
            {
                "kind": j.kind,
                "status": j.status,
                "started_at": j.started_at.isoformat() if j.started_at else None,
                "finished_at": j.finished_at.isoformat() if j.finished_at else None,
                "records_processed": j.records_processed,
                "error": j.error,
            }
            for j in jobs
        ],
    )


@router.post("/resync", response_model=ResyncResponse)
async def resync(
    workspace: Workspace = Depends(get_workspace_from_jwt),
    db: AsyncSession = Depends(get_db),
):
    """Flip `resync_requested_at`. The plugin polls this value and runs a full
    push when it changes. Debounced server-side so dashboards clicking fast
    don't DDoS the host.
    """
    store = await _active_store(workspace, db)
    if not store:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No store connected")

    now = datetime.utcnow()
    if store.resync_requested_at and (now - store.resync_requested_at) < timedelta(seconds=RESYNC_DEBOUNCE_SECONDS):
        return ResyncResponse(accepted=False, resync_requested_at=store.resync_requested_at)

    store.resync_requested_at = now
    await db.commit()
    return ResyncResponse(accepted=True, resync_requested_at=now)


@router.get("/resync-flag")
async def resync_flag(store: Store = Depends(get_store_from_api_key)):
    """Plugin-side poll endpoint. Returns the current resync_requested_at so
    the plugin can detect a dashboard-triggered full push without needing
    workspace auth.
    """
    return {
        "resync_requested_at": store.resync_requested_at.isoformat() if store.resync_requested_at else None,
    }
