"""Workspace-scoped product + order read endpoints for the dashboard."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from auth import get_workspace_from_jwt
from database import get_db
from models import Workspace, Store, Product, Order
from schemas import ProductsPage, ProductRow, OrdersPage, OrderRow, OrderItemRow

router = APIRouter()


async def _store_ids(workspace_id, db: AsyncSession) -> list:
    rows = (
        await db.execute(select(Store.id).where(Store.workspace_id == workspace_id))
    ).scalars().all()
    return list(rows)


@router.get("/products", response_model=ProductsPage)
async def list_products(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    workspace: Workspace = Depends(get_workspace_from_jwt),
    db: AsyncSession = Depends(get_db),
):
    store_ids = await _store_ids(workspace.id, db)
    if not store_ids:
        return ProductsPage(items=[], total=0, limit=limit, offset=offset)

    total = (
        await db.execute(select(func.count(Product.id)).where(Product.store_id.in_(store_ids)))
    ).scalar() or 0

    rows = (
        await db.execute(
            select(Product)
            .where(Product.store_id.in_(store_ids))
            .order_by(desc(Product.synced_at))
            .limit(limit).offset(offset)
        )
    ).scalars().all()

    return ProductsPage(
        items=[
            ProductRow(
                id=p.id,
                wc_product_id=p.wc_product_id,
                name=p.name,
                category=p.category,
                price=float(p.price) if p.price is not None else None,
                stock_status=p.stock_status,
                stock_quantity=p.stock_quantity,
                synced_at=p.synced_at,
            )
            for p in rows
        ],
        total=total, limit=limit, offset=offset,
    )


@router.get("/orders", response_model=OrdersPage)
async def list_orders(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    status: str | None = Query(None),
    workspace: Workspace = Depends(get_workspace_from_jwt),
    db: AsyncSession = Depends(get_db),
):
    store_ids = await _store_ids(workspace.id, db)
    if not store_ids:
        return OrdersPage(items=[], total=0, limit=limit, offset=offset)

    where = [Order.store_id.in_(store_ids)]
    if status:
        where.append(Order.status == status)

    total = (await db.execute(select(func.count(Order.id)).where(*where))).scalar() or 0

    rows = (
        await db.execute(
            select(Order)
            .where(*where)
            .options(selectinload(Order.items))
            .order_by(desc(Order.order_created_at), desc(Order.synced_at))
            .limit(limit).offset(offset)
        )
    ).scalars().all()

    items: list[OrderRow] = []
    for o in rows:
        items.append(OrderRow(
            id=o.id,
            wc_order_id=o.wc_order_id,
            status=o.status,
            currency=o.currency,
            total=float(o.total) if o.total is not None else None,
            customer_email=o.customer_email,
            customer_name=o.customer_name,
            order_created_at=o.order_created_at,
            items=[
                OrderItemRow(
                    product_name=it.product_name,
                    quantity=it.quantity,
                    unit_price=float(it.unit_price) if it.unit_price is not None else None,
                    line_total=float(it.line_total) if it.line_total is not None else None,
                )
                for it in o.items
            ],
        ))

    return OrdersPage(items=items, total=total, limit=limit, offset=offset)
