import json
import os
from collections import defaultdict
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from groq import Groq
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Store, Product, SearchEvent, CartEvent, ActivityLog, TrendCache
from schemas import (
    DemandInsights, TopSearch, TrendKeyword, DemandGap,
    StoreInsights, TopSeller, DeadStock, HighAbandonProduct, CartFunnel,
    ActivityInsights, HeatmapEntry,
)
from auth import get_store_from_api_key

router = APIRouter()

groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))


async def _get_store_or_404(store_id: str, db: AsyncSession) -> Store:
    result = await db.execute(select(Store).where(Store.id == store_id))
    store = result.scalars().first()
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")
    return store


# ── /insights/{store_id}/demand ───────────────────────────────────────────────

@router.get("/{store_id}/demand", response_model=DemandInsights)
async def demand_insights(store_id: str, db: AsyncSession = Depends(get_db)):
    store = await _get_store_or_404(store_id, db)

    # Top searches with aggregated counts
    search_rows = await db.execute(
        select(
            SearchEvent.query,
            func.count(SearchEvent.id).label("count"),
            func.min(SearchEvent.results_count).label("min_results"),
        )
        .where(SearchEvent.store_id == store.id)
        .group_by(SearchEvent.query)
        .order_by(func.count(SearchEvent.id).desc())
        .limit(20)
    )
    top_searches: List[TopSearch] = []
    for row in search_rows.all():
        top_searches.append(
            TopSearch(query=row.query, count=row.count, zero_results=(row.min_results == 0))
        )

    # Trend keywords from cache
    trend_rows = await db.execute(
        select(TrendCache).where(TrendCache.store_id == store.id)
    )
    trend_keywords: List[TrendKeyword] = []
    for tc in trend_rows.scalars().all():
        data = tc.trend_data or {}
        interest = data.get("interest", 0) if isinstance(data, dict) else 0
        trend_keywords.append(
            TrendKeyword(keyword=tc.keyword, interest=interest, geo=tc.geo or "")
        )

    # Products for gap analysis
    prod_rows = await db.execute(
        select(Product.name, Product.category).where(Product.store_id == store.id).limit(50)
    )
    products_list = [{"name": r.name, "category": r.category} for r in prod_rows.all()]

    zero_result_searches = [s.query for s in top_searches if s.zero_results][:10]
    geo = store.location_country or "US"
    trends_summary = [{"keyword": t.keyword, "interest": t.interest} for t in trend_keywords[:10]]

    gaps: List[DemandGap] = []
    if os.environ.get("GROQ_API_KEY"):
        try:
            response = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are a retail intelligence assistant. "
                            "Respond only with valid JSON. No preamble, no markdown, no explanation."
                        ),
                    },
                    {
                        "role": "user",
                        "content": (
                            "Given the buyer search data and trend signals below, identify the top 5 demand gaps "
                            "— things buyers are clearly looking for that this store does not adequately stock or describe.\n"
                            "Be specific. Reference actual search queries and product names. Return a JSON array only:\n"
                            '[{ "signal": "...", "severity": "high|medium|low" }]\n\n'
                            f"Store products: {json.dumps(products_list)}\n"
                            f"Top zero-result searches: {json.dumps(zero_result_searches)}\n"
                            f"Trending keywords (location: {geo}): {json.dumps(trends_summary)}"
                        ),
                    },
                ],
                temperature=0.3,
                max_tokens=1000,
            )
            raw = response.choices[0].message.content
            parsed = json.loads(raw)
            gaps = [DemandGap(signal=g["signal"], severity=g["severity"]) for g in parsed]
        except Exception:
            gaps = []

    return DemandInsights(top_searches=top_searches, trend_keywords=trend_keywords, gaps=gaps)


# ── /insights/{store_id}/store ────────────────────────────────────────────────

@router.get("/{store_id}/store", response_model=StoreInsights)
async def store_insights(store_id: str, db: AsyncSession = Depends(get_db)):
    store = await _get_store_or_404(store_id, db)

    # Top sellers: products most purchased
    purchase_rows = await db.execute(
        select(Product.name, func.count(CartEvent.id).label("purchase_count"))
        .join(CartEvent, CartEvent.product_id == Product.id)
        .where(
            CartEvent.store_id == store.id,
            CartEvent.event_type == "purchase",
        )
        .group_by(Product.name)
        .order_by(func.count(CartEvent.id).desc())
        .limit(10)
    )
    top_sellers = [
        TopSeller(product_name=r.name, purchase_count=r.purchase_count)
        for r in purchase_rows.all()
    ]

    # Dead stock: products not updated in 30+ days or out of stock
    cutoff = datetime.utcnow() - timedelta(days=30)
    dead_rows = await db.execute(
        select(Product)
        .where(
            Product.store_id == store.id,
            Product.synced_at < cutoff,
        )
        .limit(20)
    )
    dead_stock = [
        DeadStock(
            product_name=p.name,
            stock_status=p.stock_status or "unknown",
            days_since_synced=(datetime.utcnow() - p.synced_at).days if p.synced_at else 0,
        )
        for p in dead_rows.scalars().all()
    ]

    # Cart funnel
    funnel_rows = await db.execute(
        select(CartEvent.event_type, func.count(CartEvent.id).label("cnt"))
        .where(CartEvent.store_id == store.id)
        .group_by(CartEvent.event_type)
    )
    funnel_map = {r.event_type: r.cnt for r in funnel_rows.all()}
    add_to_cart = funnel_map.get("add_to_cart", 0)
    abandoned = funnel_map.get("abandoned", 0)
    purchased = funnel_map.get("purchase", 0)
    cart_funnel = CartFunnel(add_to_cart=add_to_cart, abandoned=abandoned, purchased=purchased)

    # Abandonment rate
    total_initiated = add_to_cart
    abandonment_rate = round(abandoned / total_initiated, 4) if total_initiated > 0 else 0.0

    # High abandonment products
    view_rows = await db.execute(
        select(Product.name, func.count(CartEvent.id).label("views"))
        .join(CartEvent, CartEvent.product_id == Product.id)
        .where(CartEvent.store_id == store.id, CartEvent.event_type == "view")
        .group_by(Product.name)
    )
    view_map = {r.name: r.views for r in view_rows.all()}

    abandon_rows = await db.execute(
        select(Product.name, func.count(CartEvent.id).label("abandons"))
        .join(CartEvent, CartEvent.product_id == Product.id)
        .where(CartEvent.store_id == store.id, CartEvent.event_type == "abandoned")
        .group_by(Product.name)
    )
    abandon_map = {r.name: r.abandons for r in abandon_rows.all()}

    high_abandon_products = []
    all_product_names = set(view_map.keys()) | set(abandon_map.keys())
    for name in all_product_names:
        views = view_map.get(name, 0)
        abandons = abandon_map.get(name, 0)
        rate = round(abandons / views, 4) if views > 0 else 0.0
        if rate > 0:
            high_abandon_products.append(
                HighAbandonProduct(
                    product_name=name,
                    views=views,
                    abandons=abandons,
                    abandon_rate=rate,
                )
            )
    high_abandon_products.sort(key=lambda x: x.abandon_rate, reverse=True)

    return StoreInsights(
        top_sellers=top_sellers,
        dead_stock=dead_stock,
        abandonment_rate=abandonment_rate,
        high_abandon_products=high_abandon_products[:10],
        cart_funnel=cart_funnel,
    )


# ── /insights/{store_id}/activity ────────────────────────────────────────────

@router.get("/{store_id}/activity", response_model=ActivityInsights)
async def activity_insights(store_id: str, db: AsyncSession = Depends(get_db)):
    store = await _get_store_or_404(store_id, db)

    log_rows = await db.execute(
        select(ActivityLog)
        .where(ActivityLog.store_id == store.id)
        .order_by(ActivityLog.hour_bucket.asc())
    )
    logs = log_rows.scalars().all()

    heatmap = [
        HeatmapEntry(
            hour=log.hour_bucket.strftime("%Y-%m-%dT%H:%M:%S"),
            active_users=log.active_users,
        )
        for log in logs
    ]

    # Peak hours: aggregate active_users by hour-of-day across all days
    hour_totals: dict = defaultdict(int)
    day_set: set = set()
    for log in logs:
        hour_totals[log.hour_bucket.hour] += log.active_users
        day_set.add(log.hour_bucket.date())

    # Top 3 hours of day by total active users
    sorted_hours = sorted(hour_totals.items(), key=lambda x: x[1], reverse=True)
    peak_hours = [f"{h:02d}:00" for h, _ in sorted_hours[:3]]

    # Average daily users
    if day_set:
        total_users = sum(log.active_users for log in logs)
        avg_daily_users = round(total_users / len(day_set), 2)
    else:
        avg_daily_users = 0.0

    return ActivityInsights(
        heatmap=heatmap,
        peak_hours=peak_hours,
        avg_daily_users=avg_daily_users,
    )
