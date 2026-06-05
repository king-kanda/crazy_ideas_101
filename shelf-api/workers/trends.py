import asyncio
import os
from datetime import datetime

from pytrends.request import TrendReq
from sqlalchemy import select

from celery_app import celery
from database import AsyncSessionLocal
from models import Store, Product, TrendCache


def _fetch_pytrends(keywords: list[str], geo: str, timeframe: str = "now 7-d") -> dict[str, int]:
    """
    Use pytrends to fetch interest over time for a list of keywords.
    Returns a dict of {keyword: average_interest_score}.
    """
    pytrends = TrendReq(hl="en-US", tz=0)
    # pytrends accepts max 5 keywords per request
    results: dict[str, int] = {}
    batch_size = 5
    for i in range(0, len(keywords), batch_size):
        batch = keywords[i : i + batch_size]
        try:
            pytrends.build_payload(batch, geo=geo, timeframe=timeframe)
            df = pytrends.interest_over_time()
            if df is not None and not df.empty:
                for kw in batch:
                    if kw in df.columns:
                        results[kw] = int(df[kw].mean())
                    else:
                        results[kw] = 0
            else:
                for kw in batch:
                    results[kw] = 0
        except Exception:
            for kw in batch:
                results[kw] = 0
    return results


async def _run_fetch_for_store(store_id: str) -> None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Store).where(Store.id == store_id))
        store = result.scalars().first()
        if not store:
            return

        # Derive keywords: niche + top product categories
        keywords: list[str] = []
        if store.niche:
            keywords.append(store.niche)

        cat_rows = await session.execute(
            select(Product.category)
            .where(Product.store_id == store.id, Product.category.isnot(None))
            .distinct()
            .limit(10)
        )
        for row in cat_rows.all():
            if row.category and row.category not in keywords:
                keywords.append(row.category)

        if not keywords:
            return

        geo = store.location_country or "US"
        trend_scores = _fetch_pytrends(keywords, geo=geo)

        fetched_at = datetime.utcnow()
        for keyword, interest in trend_scores.items():
            # Upsert by (store_id, keyword)
            existing = await session.execute(
                select(TrendCache).where(
                    TrendCache.store_id == store.id,
                    TrendCache.keyword == keyword,
                )
            )
            tc = existing.scalars().first()
            if tc:
                tc.geo = geo
                tc.trend_data = {"interest": interest}
                tc.fetched_at = fetched_at
            else:
                session.add(
                    TrendCache(
                        store_id=store.id,
                        keyword=keyword,
                        geo=geo,
                        trend_data={"interest": interest},
                        fetched_at=fetched_at,
                    )
                )

        await session.commit()


@celery.task(name="workers.trends.fetch_trends_for_store")
def fetch_trends_for_store(store_id: str) -> None:
    """Celery task: fetch Google Trends data for a single store."""
    asyncio.run(_run_fetch_for_store(store_id))


async def _run_fetch_all_stores() -> None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Store.id))
        store_ids = [str(row.id) for row in result.all()]

    for store_id in store_ids:
        fetch_trends_for_store.delay(store_id)


@celery.task(name="workers.trends.fetch_trends_all_stores")
def fetch_trends_all_stores() -> None:
    """Celery beat task: enqueue trend fetches for every store — runs daily."""
    asyncio.run(_run_fetch_all_stores())
