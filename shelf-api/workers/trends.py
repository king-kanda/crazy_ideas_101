import asyncio
import json
import logging
import os
import random
import time
from datetime import datetime

import redis as redis_lib
from pytrends.request import TrendReq
from sqlalchemy import select

from celery_app import celery
from database import AsyncSessionLocal
from models import Store, Product, TrendCache

logger = logging.getLogger(__name__)

_redis_client = None


def _get_redis():
    global _redis_client
    if _redis_client is None:
        _redis_client = redis_lib.from_url(
            os.environ.get("REDIS_URL", "redis://localhost:6379"),
            decode_responses=True,
        )
    return _redis_client


# Category → specific product-level keyword expansions for KE market
_CATEGORY_EXPANSIONS: dict[str, list[str]] = {
    "electronics": ["smartphone accessories kenya", "wireless earbuds", "laptop bags nairobi", "phone cases", "power banks"],
    "accessories": ["phone cases kenya", "laptop bags", "charging cables", "screen protectors", "smartwatch bands"],
    "audio": ["wireless earbuds", "bluetooth speakers", "noise cancelling headphones", "earphones", "soundbar"],
    "keyboards": ["mechanical keyboard", "wireless keyboard", "gaming keyboard", "office keyboard"],
    "peripherals": ["gaming mouse", "wireless mouse", "usb hub", "laptop cooling pad"],
    "displays": ["computer monitor kenya", "portable monitor", "monitor stand", "screen filter"],
    "cameras": ["webcam hd", "ring light", "tripod phone", "camera accessories"],
    "storage": ["external hard drive", "usb flash drive", "memory card 128gb", "nvme ssd"],
    "power": ["power bank 20000mah", "solar charger kenya", "wireless charger", "usb-c charger"],
    "smart home": ["smart plug wifi", "smart bulb", "wifi security camera", "smart speaker"],
    "fashion": ["men shirts nairobi", "women dresses kenya", "sneakers kenya", "handbags nairobi", "casual wear"],
    "tops": ["t-shirts men", "polo shirts", "women blouses", "crop tops", "hoodies"],
    "bottoms": ["chino pants men", "women jeans", "skirts", "shorts", "leggings"],
    "footwear": ["sneakers kenya", "boots women", "sandals men", "loafers", "running shoes"],
    "bags": ["handbags women", "backpacks school", "tote bags", "laptop bags", "purses"],
    "eyewear": ["sunglasses men", "women sunglasses", "reading glasses", "blue light glasses"],
    "outerwear": ["jackets men kenya", "coats women", "hoodies unisex", "windbreakers", "rain jacket"],
    "headwear": ["caps snapback", "beanies", "bucket hats", "sun hats"],
    "furniture": ["office furniture nairobi", "home furniture kenya", "sofas nairobi", "beds", "study desks"],
    "seating": ["office chair ergonomic", "gaming chair", "bar stools", "accent chairs"],
    "desks": ["office desk kenya", "standing desk", "study table", "computer desk"],
    "tables": ["coffee table", "dining table", "side table", "console table"],
    "lighting": ["desk lamp led", "floor lamp", "led strip lights", "pendant light"],
    "bedroom": ["bed frame", "mattress kenya", "nightstand", "bedding set"],
    "living room": ["sofa set kenya", "tv stand", "curtains nairobi", "rugs"],
    "skincare": ["vitamin c serum kenya", "moisturizer", "sunscreen spf50", "face wash", "toner skin"],
    "makeup": ["foundation makeup", "mascara", "lipstick", "eyeshadow palette", "setting spray"],
    "haircare": ["shampoo", "conditioner", "hair growth oil kenya", "hair mask", "natural hair products"],
    "bodycare": ["body lotion", "body scrub", "deodorant", "shower gel", "body oil"],
    "supplements": ["protein powder kenya", "multivitamins", "omega 3", "collagen supplement", "creatine"],
    "beverages": ["coffee beans kenya", "green tea", "protein shake", "energy drinks", "herbal tea"],
    "pantry": ["olive oil", "coconut oil", "honey kenya", "spices", "cooking sauces"],
    "condiments": ["hot sauce", "ketchup", "mayonnaise", "salad dressing", "soy sauce"],
    "breakfast": ["granola", "oats", "nut butter", "cereal", "muesli"],
    "sweeteners": ["honey raw kenya", "maple syrup", "stevia", "coconut sugar", "dates"],
    "spreads": ["almond butter", "peanut butter kenya", "jam", "nutella", "tahini"],
    "snacks": ["dark chocolate", "protein bars", "mixed nuts", "dried fruits", "popcorn"],
    "superfoods": ["chia seeds", "spirulina kenya", "moringa powder", "matcha powder", "turmeric"],
    "general": ["trending products kenya", "popular items nairobi", "best sellers online", "household items kenya"],
}


def _expand_category_seeds(category: str) -> list[str]:
    cat = category.lower().strip()
    if cat in _CATEGORY_EXPANSIONS:
        return _CATEGORY_EXPANSIONS[cat][:5]
    return [
        f"{cat} kenya",
        f"best {cat}",
        f"{cat} nairobi",
        f"affordable {cat}",
        f"buy {cat} online",
    ]


def _cache_key(store_id: str, geo: str, timeframe: str) -> str:
    return f"shelf:trends:v2:{store_id}:{geo}:{timeframe}"


def _get_cached(store_id: str, geo: str, timeframe: str) -> dict | None:
    try:
        data = _get_redis().get(_cache_key(store_id, geo, timeframe))
        if data:
            return json.loads(data)
    except Exception as e:
        logger.warning("Redis cache read failed: %s", e)
    return None


def _set_cached(store_id: str, geo: str, timeframe: str, data: dict) -> None:
    try:
        _get_redis().setex(
            _cache_key(store_id, geo, timeframe),
            86400,  # 24 hours
            json.dumps(data, default=str),
        )
    except Exception as e:
        logger.warning("Redis cache write failed: %s", e)


def _backoff_sleep(attempt: int) -> None:
    base = 2 ** attempt
    time.sleep(base + random.uniform(0, base * 0.3))


def _fetch_related_queries_batch(
    pytrends: TrendReq,
    batch: list[str],
    geo: str,
    timeframe: str,
    max_retries: int = 3,
) -> tuple[dict, bool]:
    """
    Fetch related queries for one batch. Returns (results_dict, rate_limited).
    results_dict: {keyword: {"top": [...], "rising": [...]}}
    """
    for attempt in range(max_retries + 1):
        try:
            pytrends.build_payload(batch, geo=geo, timeframe=timeframe)
            related = pytrends.related_queries()
            results = {}
            for kw in batch:
                kw_data = related.get(kw, {})
                top_df = kw_data.get("top")
                rising_df = kw_data.get("rising")

                top_items = []
                if top_df is not None and not top_df.empty:
                    for _, row in top_df.head(10).iterrows():
                        top_items.append({"query": str(row.get("query", "")), "value": int(row.get("value", 0))})

                rising_items = []
                if rising_df is not None and not rising_df.empty:
                    for _, row in rising_df.head(10).iterrows():
                        rising_items.append({"query": str(row.get("query", "")), "value": int(row.get("value", 0))})

                results[kw] = {"top": top_items, "rising": rising_items}
            return results, False

        except Exception as e:
            err = str(e).lower()
            is_rate_limit = any(x in err for x in ("429", "rate", "too many", "quota"))
            if is_rate_limit and attempt < max_retries:
                logger.warning("Rate limited (attempt %d), backing off...", attempt + 1)
                _backoff_sleep(attempt)
            else:
                if is_rate_limit:
                    logger.error("Rate limited after %d retries for batch: %s", max_retries, batch)
                    return {kw: {"top": [], "rising": []} for kw in batch}, True
                logger.error("pytrends error for batch %s: %s", batch, e)
                return {kw: {"top": [], "rising": []} for kw in batch}, False

    return {kw: {"top": [], "rising": []} for kw in batch}, False


def _fetch_all_related_queries(
    pytrends: TrendReq,
    keywords: list[str],
    geo: str,
    timeframe: str,
) -> tuple[dict, bool]:
    """Fetch related queries for all keywords in batches of 5."""
    all_results: dict = {}
    any_rate_limited = False

    for i in range(0, len(keywords), 5):
        batch = keywords[i : i + 5]
        results, rate_limited = _fetch_related_queries_batch(pytrends, batch, geo, timeframe)
        all_results.update(results)
        if rate_limited:
            any_rate_limited = True
        if i + 5 < len(keywords):
            _backoff_sleep(0)  # small polite delay between batches

    return all_results, any_rate_limited


def _check_inventory(query: str, product_titles: list[str], product_categories: list[str]) -> bool:
    """Return True if query meaningfully matches any product title or category."""
    q = query.lower()
    q_words = set(q.split())
    stopwords = {"a", "an", "the", "and", "or", "for", "in", "of", "with", "to", "buy", "best", "kenya", "nairobi"}
    q_meaningful = q_words - stopwords

    for title in product_titles:
        t = title.lower()
        if q in t or t in q:
            return True
        t_words = set(t.split()) - stopwords
        if len(q_meaningful) > 0 and len(q_meaningful & t_words) >= min(2, len(q_meaningful)):
            return True

    for cat in product_categories:
        c = cat.lower()
        if c in q or q in c:
            return True

    return False


def _build_entry(
    query: str,
    seed: str,
    signal: str,
    value: int,
    product_titles: list[str],
    product_categories: list[str],
) -> dict:
    in_inventory = _check_inventory(query, product_titles, product_categories)
    return {
        "query": query,
        "seed": seed,
        "signal": signal,
        "value": value,
        "in_store_inventory": in_inventory,
        "gap": not in_inventory,
    }


def extract_trends_for_store(
    store_id: str,
    niche: str,
    location_country: str,
    product_titles: list[str],
    product_categories: list[str],
    timeframe: str = "today 3-m",
) -> dict:
    """
    Extract structured Google Trends data for a store. Geo-locked to KE.
    Never raises — returns partial results with rate_limited=True if blocked.
    """
    geo = "KE"

    cached = _get_cached(store_id, geo, timeframe)
    if cached:
        logger.info("Returning cached trends for store %s", store_id)
        return cached

    # Build seeds: niche expansions + categories + product titles
    seen: set[str] = set()
    seeds: list[str] = []

    def _add(s: str) -> None:
        s = s.strip().lower()
        if s and s not in seen:
            seen.add(s)
            seeds.append(s)

    if niche:
        _add(niche)
        for kw in _expand_category_seeds(niche):
            _add(kw)

    for cat in product_categories:
        _add(cat)
        for kw in _expand_category_seeds(cat):
            _add(kw)

    for title in product_titles[:10]:
        words = title.split()
        if len(words) <= 4:
            _add(title.lower())

    seeds_used = seeds[:]
    rate_limited = False
    emerging: list[dict] = []
    established: list[dict] = []
    global_opps: list[dict] = []
    seen_emerging: set[str] = set()
    seen_established: set[str] = set()
    seen_global: set[str] = set()

    try:
        pytrends = TrendReq(hl="en-US", tz=180)  # UTC+3 Nairobi

        ke_results, rl = _fetch_all_related_queries(pytrends, seeds, geo="KE", timeframe=timeframe)
        if rl:
            rate_limited = True

        for seed, data in ke_results.items():
            for item in data.get("rising", []):
                q = item["query"]
                if q and q not in seen_emerging:
                    seen_emerging.add(q)
                    emerging.append(_build_entry(q, seed, "emerging", item["value"], product_titles, product_categories))

            for item in data.get("top", []):
                q = item["query"]
                if q and q not in seen_established:
                    seen_established.add(q)
                    established.append(_build_entry(q, seed, "established", item["value"], product_titles, product_categories))

        # Global pull — flag anything trending globally but not in KE results
        _backoff_sleep(0)
        global_results, rl_global = _fetch_all_related_queries(
            pytrends, seeds[:10], geo="", timeframe=timeframe
        )
        if rl_global:
            rate_limited = True

        ke_all = seen_emerging | seen_established
        for seed, data in global_results.items():
            for item in data.get("rising", []) + data.get("top", []):
                q = item["query"]
                if q and q not in ke_all and q not in seen_global:
                    seen_global.add(q)
                    entry = _build_entry(q, seed, "established", item["value"], product_titles, product_categories)
                    entry["opportunity"] = "potential"
                    global_opps.append(entry)

    except Exception as e:
        logger.error("Fatal error extracting trends for store %s: %s", store_id, e)

    result = {
        "store_id": store_id,
        "extracted_at": datetime.utcnow().isoformat(),
        "seeds_used": seeds_used,
        "rate_limited": rate_limited,
        "emerging_queries": emerging,
        "established_queries": established,
        "global_opportunities": global_opps,
    }

    if not rate_limited:
        _set_cached(store_id, geo, timeframe, result)

    return result


async def _run_fetch_for_store(store_id: str) -> None:
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Store).where(Store.id == store_id))
        store = result.scalars().first()
        if not store:
            return

        prod_rows = await session.execute(
            select(Product.name, Product.category)
            .where(Product.store_id == store.id)
            .limit(50)
        )
        products = prod_rows.all()
        product_titles = [p.name for p in products if p.name]
        product_categories = list({p.category for p in products if p.category})

        trends_data = extract_trends_for_store(
            store_id=str(store.id),
            niche=store.niche or "",
            location_country=store.location_country or "KE",
            product_titles=product_titles,
            product_categories=product_categories,
        )

        fetched_at = datetime.utcnow()
        geo = "KE"

        # Persist structured data as a single special-key cache row
        structured_payload = {
            "v2": True,
            "emerging_queries": trends_data["emerging_queries"],
            "established_queries": trends_data["established_queries"],
            "global_opportunities": trends_data["global_opportunities"],
            "seeds_used": trends_data["seeds_used"],
            "rate_limited": trends_data.get("rate_limited", False),
        }

        existing = await session.execute(
            select(TrendCache).where(
                TrendCache.store_id == store.id,
                TrendCache.keyword == "__structured__",
            )
        )
        tc = existing.scalars().first()
        if tc:
            tc.geo = geo
            tc.trend_data = structured_payload
            tc.fetched_at = fetched_at
        else:
            session.add(TrendCache(
                store_id=store.id,
                keyword="__structured__",
                geo=geo,
                trend_data=structured_payload,
                fetched_at=fetched_at,
            ))

        # Also persist per-keyword rows for backward compatibility with insights endpoint
        all_kw: dict[str, int] = {}
        for item in trends_data["emerging_queries"] + trends_data["established_queries"]:
            kw = item["query"]
            if kw not in all_kw:
                all_kw[kw] = item["value"]

        for keyword, interest in list(all_kw.items())[:50]:
            existing_kw = await session.execute(
                select(TrendCache).where(
                    TrendCache.store_id == store.id,
                    TrendCache.keyword == keyword,
                )
            )
            tc_kw = existing_kw.scalars().first()
            if tc_kw:
                tc_kw.geo = geo
                tc_kw.trend_data = {"interest": min(interest, 100)}
                tc_kw.fetched_at = fetched_at
            else:
                session.add(TrendCache(
                    store_id=store.id,
                    keyword=keyword,
                    geo=geo,
                    trend_data={"interest": min(interest, 100)},
                    fetched_at=fetched_at,
                ))

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
