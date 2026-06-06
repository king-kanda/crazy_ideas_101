from datetime import datetime, timezone
from typing import Any, Dict, Optional
import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from database import get_db
from models import Store, Product, SearchEvent, CartEvent, ActivityLog
from schemas import (
    IngestProductsRequest,
    IngestSearchesRequest,
    IngestCartEventsRequest,
    IngestActivityRequest,
    IngestResponse,
)
from auth import get_store_from_api_key

router = APIRouter()


@router.post("/products", response_model=IngestResponse)
async def ingest_products(
    body: IngestProductsRequest,
    x_shelf_site_url: Optional[str] = Header(None),
    store: Store = Depends(get_store_from_api_key),
    db: AsyncSession = Depends(get_db),
):
    if x_shelf_site_url and store.plugin_site_url != x_shelf_site_url:
        site_result = await db.execute(select(Store).where(Store.id == store.id))
        db_store = site_result.scalars().first()
        if db_store:
            db_store.plugin_site_url = x_shelf_site_url
    inserted = 0
    updated = 0

    for item in body.products:
        result = await db.execute(
            select(Product).where(
                Product.store_id == store.id,
                Product.wc_product_id == item.wc_product_id,
            )
        )
        existing = result.scalars().first()

        if existing:
            existing.name = item.name
            existing.category = item.category
            existing.price = item.price
            existing.stock_status = item.stock_status
            existing.synced_at = datetime.utcnow()
            updated += 1
        else:
            db.add(
                Product(
                    store_id=store.id,
                    wc_product_id=item.wc_product_id,
                    name=item.name,
                    category=item.category,
                    price=item.price,
                    stock_status=item.stock_status,
                    synced_at=datetime.utcnow(),
                )
            )
            inserted += 1

    await db.commit()
    return IngestResponse(inserted=inserted, updated=updated)


@router.post("/searches", response_model=Dict[str, Any])
async def ingest_searches(
    body: IngestSearchesRequest,
    store: Store = Depends(get_store_from_api_key),
    db: AsyncSession = Depends(get_db),
):
    events = [
        SearchEvent(
            store_id=store.id,
            query=ev.query,
            results_count=ev.results_count,
            user_found_product=ev.user_found_product,
            occurred_at=ev.occurred_at.replace(tzinfo=None),
        )
        for ev in body.events
    ]
    db.add_all(events)
    await db.commit()
    return {"inserted": len(events)}


@router.post("/cart-events", response_model=Dict[str, Any])
async def ingest_cart_events(
    body: IngestCartEventsRequest,
    store: Store = Depends(get_store_from_api_key),
    db: AsyncSession = Depends(get_db),
):
    # Build a lookup map for wc_product_id → Product.id for this store
    wc_ids = [ev.wc_product_id for ev in body.events if ev.wc_product_id is not None]
    product_map: Dict[int, uuid.UUID] = {}
    if wc_ids:
        result = await db.execute(
            select(Product.wc_product_id, Product.id).where(
                Product.store_id == store.id,
                Product.wc_product_id.in_(wc_ids),
            )
        )
        for wc_id, prod_id in result.all():
            product_map[wc_id] = prod_id

    events = []
    for ev in body.events:
        product_id = product_map.get(ev.wc_product_id) if ev.wc_product_id is not None else None
        events.append(
            CartEvent(
                store_id=store.id,
                event_type=ev.event_type,
                product_id=product_id,
                wc_product_id=ev.wc_product_id,
                session_id=ev.session_id,
                occurred_at=ev.occurred_at.replace(tzinfo=None),
            )
        )
    db.add_all(events)
    await db.commit()
    return {"inserted": len(events)}


@router.post("/activity", response_model=Dict[str, Any])
async def ingest_activity(
    body: IngestActivityRequest,
    store: Store = Depends(get_store_from_api_key),
    db: AsyncSession = Depends(get_db),
):
    upserted = 0
    for log in body.logs:
        result = await db.execute(
            select(ActivityLog).where(
                ActivityLog.store_id == store.id,
                ActivityLog.hour_bucket == log.hour_bucket.replace(tzinfo=None),
            )
        )
        existing = result.scalars().first()
        if existing:
            existing.active_users = log.active_users
            existing.page_views = log.page_views
        else:
            db.add(
                ActivityLog(
                    store_id=store.id,
                    hour_bucket=log.hour_bucket.replace(tzinfo=None),
                    active_users=log.active_users,
                    page_views=log.page_views,
                )
            )
        upserted += 1

    await db.commit()
    return {"upserted": upserted}
