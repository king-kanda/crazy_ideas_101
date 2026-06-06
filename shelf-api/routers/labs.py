import asyncio
import os
import random
import time
import uuid as uuid_module
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete as sql_delete, select, func
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_store_from_jwt
from database import get_db
from models import Store, Product, CartEvent, SearchEvent, ActivityLog
from groq import Groq

router = APIRouter()

groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))


# ── Demo catalog ───────────────────────────────────────────────────────────────

_CATALOG: dict[str, list[tuple[str, str, float]]] = {
    "electronics": [
        ("iPhone 15 Silicone Case", "Accessories", 14.99),
        ("USB-C Hub 7-Port Aluminium", "Accessories", 49.99),
        ("Mechanical Keyboard TKL RGB", "Keyboards", 89.99),
        ("Gaming Mouse 16000 DPI", "Peripherals", 59.99),
        ("Wireless Earbuds ANC Pro", "Audio", 129.99),
        ("27in IPS Monitor 144Hz", "Displays", 299.99),
        ("1080p Webcam Auto-Focus", "Cameras", 79.99),
        ("1TB NVMe SSD M.2", "Storage", 119.99),
        ("Laptop Stand Adjustable", "Accessories", 34.99),
        ("Power Bank 20000mAh PD", "Power", 44.99),
        ("Laptop Sleeve 15in Neoprene", "Accessories", 24.99),
        ("Smart Plug WiFi 4-pack", "Smart Home", 36.99),
    ],
    "fashion": [
        ("Slim Fit Chino Pants", "Bottoms", 49.99),
        ("Premium Cotton T-Shirt", "Tops", 29.99),
        ("Low Top Canvas Sneakers", "Footwear", 69.99),
        ("Bifold Leather Wallet", "Accessories", 39.99),
        ("Polarised Aviator Sunglasses", "Eyewear", 54.99),
        ("Zip-Up Fleece Hoodie", "Tops", 64.99),
        ("Chelsea Ankle Boots", "Footwear", 89.99),
        ("Waxed Canvas Tote Bag", "Bags", 44.99),
        ("Minimalist Quartz Watch", "Accessories", 119.99),
        ("5-Panel Structured Cap", "Headwear", 24.99),
        ("Linen Button-Down Shirt", "Tops", 54.99),
        ("Slim Fit Denim Jacket", "Outerwear", 79.99),
    ],
    "furniture": [
        ("Ergonomic Mesh Office Chair", "Seating", 299.99),
        ("Height-Adjustable Standing Desk 140cm", "Desks", 449.99),
        ("5-Shelf Bookcase Pine", "Storage", 129.99),
        ("Round Marble Coffee Table", "Tables", 249.99),
        ("LED Architect Desk Lamp", "Lighting", 59.99),
        ("Dual Monitor Arm VESA", "Accessories", 79.99),
        ("4-Drawer Storage Cabinet", "Storage", 189.99),
        ("Counter-Height Bar Stool Set/2", "Seating", 149.99),
        ("Anti-Fatigue Kitchen Mat", "Accessories", 44.99),
        ("Floating Wall Shelves Set/3", "Storage", 49.99),
        ("Nightstand with USB Charging", "Bedroom", 89.99),
        ("TV Media Console 180cm", "Living Room", 349.99),
    ],
    "beauty": [
        ("Vitamin C Brightening Serum", "Skincare", 38.99),
        ("Mineral SPF 50 Sunscreen", "Skincare", 29.99),
        ("Daily Hydrating Moisturiser", "Skincare", 32.99),
        ("Gentle Foaming Face Wash", "Skincare", 19.99),
        ("Rose Water Balancing Toner", "Skincare", 24.99),
        ("Full Coverage Foundation", "Makeup", 42.99),
        ("Volumising Mascara", "Makeup", 22.99),
        ("12-Pan Nude Eye Shadow Palette", "Makeup", 49.99),
        ("Jasmine & Oud Body Lotion", "Bodycare", 27.99),
        ("Deep Repair Hair Mask 300ml", "Haircare", 26.99),
        ("Hyaluronic Acid Plumping Mist", "Skincare", 34.99),
        ("Retinol Night Cream 1%", "Skincare", 44.99),
    ],
    "food": [
        ("Whey Protein Vanilla 1kg", "Supplements", 54.99),
        ("Cold Brew Coffee Beans 500g", "Beverages", 22.99),
        ("Extra Virgin Olive Oil 500ml", "Pantry", 18.99),
        ("Signature Hot Sauce 150ml", "Condiments", 9.99),
        ("Oats & Honey Granola 400g", "Breakfast", 12.99),
        ("Organic Green Tea 50 bags", "Beverages", 14.99),
        ("Raw Wildflower Honey 500g", "Sweeteners", 16.99),
        ("Smooth Almond Butter 350g", "Spreads", 12.99),
        ("70% Dark Chocolate Bar", "Snacks", 5.99),
        ("Chia Seeds 500g Organic", "Superfoods", 11.99),
        ("Vegan Protein Bar 12-pack", "Supplements", 28.99),
        ("Turmeric Golden Milk Mix 200g", "Beverages", 17.99),
    ],
}
_CATALOG["other"] = [
    (f"Premium Product {chr(65 + i)}", "General", round(19.99 + i * 10, 2))
    for i in range(12)
]

_ZERO_SEARCHES: dict[str, list[str]] = {
    "electronics": [
        "wireless charging stand 3-in-1",
        "4k webcam streaming setup",
        "mechanical numpad bluetooth",
        "usb4 thunderbolt cable 2m",
    ],
    "fashion": [
        "wide-fit running shoes",
        "sustainable organic denim jacket",
        "waterproof trail chelsea boots",
        "oversized linen summer dress",
    ],
    "furniture": [
        "standing desk cable management tray",
        "ergonomic kneeling chair",
        "murphy wall bed with folding desk",
        "bamboo floating corner shelf",
    ],
    "beauty": [
        "retinol serum 0.5% sensitive skin",
        "mineral zinc sunscreen tinted spf50",
        "niacinamide serum 10% pore-minimising",
        "vegan collagen face cream overnight",
    ],
    "food": [
        "plant-based protein powder 5kg",
        "cold brew coffee concentrate ready-to-drink",
        "grass-fed ghee 500g",
        "organic ceremonial matcha powder",
    ],
    "other": [
        "premium bundle pack",
        "limited edition collector set",
        "bulk wholesale order",
        "custom branded gift box",
    ],
}

# Hourly traffic weights (index = hour of day 0-23)
_HOUR_WEIGHTS = [2, 1, 1, 1, 1, 2, 4, 6, 8, 10, 10, 9, 8, 8, 9, 8, 7, 8, 10, 10, 9, 7, 6, 4]


# ── Groq / LLM ────────────────────────────────────────────────────────────────

@router.get("/groq")
async def test_groq(store=Depends(get_store_from_jwt)):
    api_key = os.environ.get("GROQ_API_KEY", "")
    if not api_key:
        return {"ok": False, "error": "GROQ_API_KEY is not set in environment"}

    start = time.monotonic()
    try:
        response = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": "Reply with exactly: OK"}],
            temperature=0,
            max_tokens=10,
        )
        elapsed_ms = round((time.monotonic() - start) * 1000)
        reply = response.choices[0].message.content.strip()
        return {"ok": True, "model": "llama-3.3-70b-versatile", "response": reply, "response_time_ms": elapsed_ms}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


# ── Celery workers ────────────────────────────────────────────────────────────

@router.get("/celery")
async def test_celery(store=Depends(get_store_from_jwt)):
    if not os.environ.get("REDIS_URL"):
        return {"ok": False, "error": "REDIS_URL is not set in environment"}

    def _ping():
        from celery_app import celery as celery_app
        return celery_app.control.inspect(timeout=4).ping()

    try:
        pong = await asyncio.get_event_loop().run_in_executor(None, _ping)
        if pong:
            workers = list(pong.keys())
            return {"ok": True, "workers": workers, "count": len(workers)}
        return {"ok": False, "error": "No Celery workers responded (broker reachable but no workers running)"}
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


# ── Google Trends ─────────────────────────────────────────────────────────────

@router.get("/trends")
async def test_trends(store=Depends(get_store_from_jwt)):
    def _fetch():
        from pytrends.request import TrendReq
        start = time.monotonic()
        pt = TrendReq(hl="en-US", tz=0)
        pt.build_payload(["shoes"], geo="US", timeframe="now 7-d")
        df = pt.interest_over_time()
        elapsed_ms = round((time.monotonic() - start) * 1000)
        if df is not None and not df.empty and "shoes" in df.columns:
            return {"ok": True, "keyword": "shoes", "geo": "US", "avg_interest": int(df["shoes"].mean()), "response_time_ms": elapsed_ms}
        return {"ok": False, "error": "pytrends returned empty data (Google may be rate-limiting)"}

    try:
        return await asyncio.get_event_loop().run_in_executor(None, _fetch)
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


# ── Demo: status ──────────────────────────────────────────────────────────────

@router.get("/demo/status")
async def demo_status(
    store=Depends(get_store_from_jwt),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Store).where(Store.id == store.id))
    db_store = result.scalars().first()

    counts: dict = {}
    if db_store and db_store.demo_loaded:
        for model, label in [
            (Product, "products"),
            (CartEvent, "cart_events"),
            (SearchEvent, "search_events"),
            (ActivityLog, "activity_logs"),
        ]:
            r = await db.execute(
                select(func.count()).select_from(model).where(
                    model.store_id == db_store.id,
                    model.is_demo == True,
                )
            )
            counts[label] = r.scalar() or 0

    return {
        "loaded": bool(db_store and db_store.demo_loaded),
        "counts": counts,
    }


# ── Demo: load ────────────────────────────────────────────────────────────────

@router.post("/demo/load")
async def load_demo(
    store=Depends(get_store_from_jwt),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Store).where(Store.id == store.id))
    db_store = result.scalars().first()
    if not db_store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")

    niche = (db_store.niche or "other").lower()
    catalog = _CATALOG.get(niche, _CATALOG["other"])
    zero_searches = _ZERO_SEARCHES.get(niche, _ZERO_SEARCHES["other"])

    # ── Products ──────────────────────────────────────────────────────────────
    existing_result = await db.execute(
        select(Product).where(Product.store_id == db_store.id, Product.is_demo == False)
    )
    real_products = existing_result.scalars().all()

    if len(real_products) >= 5:
        work_products = list(real_products)
        created_products = 0
    else:
        work_products = []
        for i, (name, category, price) in enumerate(catalog):
            p = Product(
                store_id=db_store.id,
                wc_product_id=90000 + i,
                name=name,
                category=category,
                price=price,
                stock_status="instock",
                is_demo=True,
            )
            db.add(p)
            work_products.append(p)
        await db.flush()
        created_products = len(catalog)

    # ── Cart events ───────────────────────────────────────────────────────────
    now = datetime.utcnow()
    cart_count = 0
    n_work = min(10, len(work_products))
    selected = work_products[:n_work]

    def _rnd_dt(max_days: int = 30) -> datetime:
        return now - timedelta(
            days=random.randint(0, max_days),
            hours=random.randint(0, 23),
            minutes=random.randint(0, 59),
        )

    for i, product in enumerate(selected):
        prod_id = product.id
        wc_id = product.wc_product_id

        if i < n_work // 3:          # top sellers
            atc, purchases, abandons = (random.randint(15, 25), random.randint(8, 14), random.randint(2, 5))
        elif i < 2 * n_work // 3:    # high abandonment
            atc, purchases, abandons = (random.randint(12, 20), random.randint(1, 3), random.randint(7, 14))
        else:                         # normal
            atc = random.randint(5, 12)
            purchases = random.randint(2, 5)
            abandons = max(0, atc - purchases - random.randint(0, 2))

        for event_type, count in [("add_to_cart", atc), ("purchase", purchases), ("abandoned", abandons)]:
            for _ in range(count):
                db.add(CartEvent(
                    store_id=db_store.id,
                    event_type=event_type,
                    product_id=prod_id,
                    wc_product_id=wc_id,
                    session_id=f"demo-{uuid_module.uuid4().hex[:8]}",
                    occurred_at=_rnd_dt(),
                    is_demo=True,
                ))
                cart_count += 1

    # ── Search events ─────────────────────────────────────────────────────────
    search_count = 0
    for product in selected[:6]:
        for _ in range(random.randint(3, 12)):
            db.add(SearchEvent(
                store_id=db_store.id,
                query=product.name.lower(),
                results_count=random.randint(1, 5),
                user_found_product=True,
                occurred_at=_rnd_dt(),
                is_demo=True,
            ))
            search_count += 1

    for query in zero_searches:
        for _ in range(random.randint(5, 18)):
            db.add(SearchEvent(
                store_id=db_store.id,
                query=query,
                results_count=0,
                user_found_product=False,
                occurred_at=_rnd_dt(),
                is_demo=True,
            ))
            search_count += 1

    # ── Activity logs ─────────────────────────────────────────────────────────
    activity_count = 0
    for day in range(7):
        for hour in range(24):
            users = max(1, int(_HOUR_WEIGHTS[hour] * random.uniform(0.7, 1.4)))
            db.add(ActivityLog(
                store_id=db_store.id,
                hour_bucket=(now - timedelta(days=day)).replace(
                    hour=hour, minute=0, second=0, microsecond=0
                ),
                active_users=users,
                page_views=users * random.randint(2, 5),
                is_demo=True,
            ))
            activity_count += 1

    db_store.demo_loaded = True
    await db.commit()

    return {
        "loaded": True,
        "products_created": created_products,
        "used_real_products": created_products == 0,
        "cart_events": cart_count,
        "search_events": search_count,
        "activity_logs": activity_count,
    }


# ── Demo: delete ──────────────────────────────────────────────────────────────

@router.delete("/demo")
async def delete_demo(
    store=Depends(get_store_from_jwt),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Store).where(Store.id == store.id))
    db_store = result.scalars().first()
    if not db_store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")

    for model in [CartEvent, SearchEvent, ActivityLog, Product]:
        await db.execute(
            sql_delete(model).where(
                model.store_id == db_store.id,
                model.is_demo == True,
            )
        )

    db_store.demo_loaded = False
    await db.commit()
    return {"deleted": True}
