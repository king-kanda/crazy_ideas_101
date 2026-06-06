import asyncio
import json
import os
from collections import defaultdict
from datetime import datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from groq import Groq
from sqlalchemy import select, func, delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Store, Product, SearchEvent, CartEvent, ActivityLog, TrendCache
from schemas import (
    DemandInsights, TopSearch, TrendKeyword, DemandGap,
    StoreInsights, TopSeller, DeadStock, HighAbandonProduct, CartFunnel,
    ActivityInsights, HeatmapEntry, DailyActivity,
)
from auth import get_store_from_api_key, get_store_from_jwt

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

    # Current valid keywords = niche + active product categories
    valid_keywords: set = set()
    if store.niche:
        valid_keywords.add(store.niche.lower())

    cat_rows = await db.execute(
        select(Product.category)
        .where(Product.store_id == store.id, Product.category.isnot(None))
        .distinct()
    )
    product_categories: List[str] = []
    for row in cat_rows.all():
        if row.category:
            product_categories.append(row.category)
            valid_keywords.add(row.category.lower())

    # Trend keywords from cache — filtered to only current valid keywords
    trend_rows = await db.execute(
        select(TrendCache).where(TrendCache.store_id == store.id)
    )
    trend_keywords: List[TrendKeyword] = []
    for tc in trend_rows.scalars().all():
        if valid_keywords and tc.keyword.lower() not in valid_keywords:
            continue  # stale entry — skip it
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
                            "Be specific. Reference actual search queries and product names when possible.\n"
                            "Return a JSON array only (no markdown, no preamble):\n"
                            '[{ "signal": "Detailed explanation referencing the data", "severity": "high|medium|low", '
                            '"category": "product category this gap belongs to", '
                            '"action": "Specific actionable step the store owner should take" }]\n\n'
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
            gaps = [
                DemandGap(
                    signal=g["signal"],
                    severity=g["severity"],
                    category=g.get("category"),
                    action=g.get("action"),
                )
                for g in parsed
            ]
        except Exception:
            gaps = []

    return DemandInsights(
        top_searches=top_searches,
        trend_keywords=trend_keywords,
        gaps=gaps,
        product_categories=product_categories,
    )


# ── /insights/{store_id}/store ────────────────────────────────────────────────

@router.get("/{store_id}/store", response_model=StoreInsights)
async def store_insights(store_id: str, db: AsyncSession = Depends(get_db)):
    store = await _get_store_or_404(store_id, db)

    # Top sellers: products most purchased (LEFT JOIN so unsynced products still appear)
    from sqlalchemy import cast, Text as SAText
    purchase_rows = await db.execute(
        select(
            func.coalesce(Product.name, func.cast(CartEvent.wc_product_id, SAText)).label("name"),
            func.count(CartEvent.id).label("purchase_count"),
        )
        .select_from(CartEvent)
        .join(Product, CartEvent.product_id == Product.id, isouter=True)
        .where(
            CartEvent.store_id == store.id,
            CartEvent.event_type == "purchase",
        )
        .group_by(func.coalesce(Product.name, func.cast(CartEvent.wc_product_id, SAText)))
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

    # High abandonment products — baseline is add_to_cart (LEFT JOIN handles unsynced products)
    from sqlalchemy import cast, Text as SAText  # noqa: F811
    atc_rows = await db.execute(
        select(
            func.coalesce(Product.name, func.cast(CartEvent.wc_product_id, SAText)).label("product_key"),
            func.count(CartEvent.id).label("atc_count"),
        )
        .select_from(CartEvent)
        .join(Product, CartEvent.product_id == Product.id, isouter=True)
        .where(CartEvent.store_id == store.id, CartEvent.event_type == "add_to_cart")
        .group_by(func.coalesce(Product.name, func.cast(CartEvent.wc_product_id, SAText)))
    )
    atc_map = {r.product_key: r.atc_count for r in atc_rows.all()}

    abandon_rows = await db.execute(
        select(
            func.coalesce(Product.name, func.cast(CartEvent.wc_product_id, SAText)).label("product_key"),
            func.count(CartEvent.id).label("abandons"),
        )
        .select_from(CartEvent)
        .join(Product, CartEvent.product_id == Product.id, isouter=True)
        .where(CartEvent.store_id == store.id, CartEvent.event_type == "abandoned")
        .group_by(func.coalesce(Product.name, func.cast(CartEvent.wc_product_id, SAText)))
    )
    abandon_map = {r.product_key: r.abandons for r in abandon_rows.all()}

    high_abandon_products = []
    for key in set(atc_map.keys()) | set(abandon_map.keys()):
        atc = atc_map.get(key, 0)
        abandons = abandon_map.get(key, 0)
        rate = round(abandons / atc, 4) if atc > 0 else 0.0
        if rate > 0:
            high_abandon_products.append(
                HighAbandonProduct(
                    product_name=key,
                    views=atc,
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
async def activity_insights(
    store_id: str,
    period: str = Query("week", regex="^(day|week|month)$"),
    db: AsyncSession = Depends(get_db),
):
    store = await _get_store_or_404(store_id, db)

    cutoff_days = {"day": 1, "week": 7, "month": 30}
    cutoff = datetime.utcnow() - timedelta(days=cutoff_days[period])

    log_rows = await db.execute(
        select(ActivityLog)
        .where(ActivityLog.store_id == store.id, ActivityLog.hour_bucket >= cutoff)
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

    # Peak hours + daily stats
    hour_totals: dict = defaultdict(int)
    day_users: dict = defaultdict(int)
    day_views: dict = defaultdict(int)

    for log in logs:
        hour_totals[log.hour_bucket.hour] += log.active_users
        date_key = log.hour_bucket.strftime("%Y-%m-%d")
        day_users[date_key] += log.active_users
        day_views[date_key] += log.page_views

    sorted_hours = sorted(hour_totals.items(), key=lambda x: x[1], reverse=True)
    peak_hours = [f"{h:02d}:00" for h, _ in sorted_hours[:3]]

    avg_daily_users = round(sum(day_users.values()) / len(day_users), 2) if day_users else 0.0

    daily = [
        DailyActivity(date=date, active_users=day_users[date], page_views=day_views[date])
        for date in sorted(day_users.keys())
    ]

    return ActivityInsights(
        heatmap=heatmap,
        daily=daily,
        peak_hours=peak_hours,
        avg_daily_users=avg_daily_users,
    )


# ── /insights/{store_id}/demand/refresh ──────────────────────────────────────

@router.post("/{store_id}/demand/refresh", response_model=DemandInsights)
async def refresh_demand(
    store_id: str,
    db: AsyncSession = Depends(get_db),
    auth_store: Store = Depends(get_store_from_jwt),
):
    if str(auth_store.id) != store_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Store ID does not match token")

    store = await _get_store_or_404(store_id, db)

    # Build keyword list from niche + product categories
    keywords: List[str] = []
    if store.niche:
        keywords.append(store.niche)

    cat_rows = await db.execute(
        select(Product.category)
        .where(Product.store_id == store.id, Product.category.isnot(None))
        .distinct()
        .limit(9)
    )
    for row in cat_rows.all():
        if row.category and row.category not in keywords:
            keywords.append(row.category)

    # Purge stale trend cache entries (keywords no longer in niche or product categories)
    if keywords:
        await db.execute(
            sql_delete(TrendCache).where(
                TrendCache.store_id == store.id,
                TrendCache.keyword.not_in(keywords),
            )
        )
        await db.commit()

    # Refresh trend cache synchronously
    if keywords:
        geo = store.location_country or "US"

        def _run_trends() -> dict:
            from pytrends.request import TrendReq
            results: dict = {}
            pt = TrendReq(hl="en-US", tz=0)
            for i in range(0, len(keywords), 5):
                batch = keywords[i: i + 5]
                try:
                    pt.build_payload(batch, geo=geo, timeframe="now 7-d")
                    df = pt.interest_over_time()
                    if df is not None and not df.empty:
                        for kw in batch:
                            results[kw] = int(df[kw].mean()) if kw in df.columns else 0
                    else:
                        for kw in batch:
                            results[kw] = 0
                except Exception:
                    for kw in batch:
                        results[kw] = 0
            return results

        try:
            trend_scores = await asyncio.get_event_loop().run_in_executor(None, _run_trends)
            fetched_at = datetime.utcnow()
            for keyword, interest in trend_scores.items():
                tc_result = await db.execute(
                    select(TrendCache).where(
                        TrendCache.store_id == store.id, TrendCache.keyword == keyword
                    )
                )
                tc = tc_result.scalars().first()
                if tc:
                    tc.trend_data = {"interest": interest}
                    tc.geo = geo
                    tc.fetched_at = fetched_at
                else:
                    db.add(TrendCache(
                        store_id=store.id, keyword=keyword, geo=geo,
                        trend_data={"interest": interest}, fetched_at=fetched_at,
                    ))
            await db.commit()
        except Exception:
            pass  # trend refresh best-effort; demand analysis still runs

    # Re-run demand analysis with fresh trend cache
    return await demand_insights(store_id, db)
