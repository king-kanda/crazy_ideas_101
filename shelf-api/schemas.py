from __future__ import annotations
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, EmailStr, UUID4


# ── Auth ──────────────────────────────────────────────────────────────────────

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    store_name: str
    store_url: str
    niche: Optional[str] = None
    location_country: Optional[str] = None
    location_city: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SignupResponse(BaseModel):
    token: str
    api_key: str
    store_id: str


class VerifyResponse(BaseModel):
    verified: bool
    store_name: str
    store_id: str


class RegenerateKeyResponse(BaseModel):
    api_key: str


class StoreProfileResponse(BaseModel):
    store_name: str
    store_url: str
    niche: Optional[str]
    location_country: Optional[str]
    location_city: Optional[str]
    plugin_site_url: Optional[str]


class UpdateProfileRequest(BaseModel):
    store_name: Optional[str] = None
    store_url: Optional[str] = None
    niche: Optional[str] = None
    location_country: Optional[str] = None
    location_city: Optional[str] = None


# ── Ingest: Products ──────────────────────────────────────────────────────────

class ProductIn(BaseModel):
    wc_product_id: int
    name: str
    category: Optional[str] = None
    price: Optional[float] = None
    stock_status: Optional[str] = None


class IngestProductsRequest(BaseModel):
    products: List[ProductIn]


class IngestResponse(BaseModel):
    inserted: int
    updated: int


# ── Ingest: Searches ──────────────────────────────────────────────────────────

class SearchEventIn(BaseModel):
    query: str
    results_count: int = 0
    user_found_product: bool = False
    occurred_at: datetime


class IngestSearchesRequest(BaseModel):
    events: List[SearchEventIn]


# ── Ingest: Cart Events ───────────────────────────────────────────────────────

class CartEventIn(BaseModel):
    event_type: str
    wc_product_id: Optional[int] = None
    session_id: Optional[str] = None
    occurred_at: datetime


class IngestCartEventsRequest(BaseModel):
    events: List[CartEventIn]


# ── Ingest: Activity ──────────────────────────────────────────────────────────

class ActivityLogIn(BaseModel):
    hour_bucket: datetime
    active_users: int = 0
    page_views: int = 0


class IngestActivityRequest(BaseModel):
    logs: List[ActivityLogIn]


# ── Insights: Demand ──────────────────────────────────────────────────────────

class TopSearch(BaseModel):
    query: str
    count: int
    zero_results: bool


class TrendKeyword(BaseModel):
    keyword: str
    interest: int
    geo: str


class DemandGap(BaseModel):
    signal: str
    severity: str


class DemandInsights(BaseModel):
    top_searches: List[TopSearch]
    trend_keywords: List[TrendKeyword]
    gaps: List[DemandGap]


# ── Insights: Store ───────────────────────────────────────────────────────────

class TopSeller(BaseModel):
    product_name: str
    purchase_count: int


class DeadStock(BaseModel):
    product_name: str
    stock_status: str
    days_since_synced: int


class HighAbandonProduct(BaseModel):
    product_name: str
    views: int
    abandons: int
    abandon_rate: float


class CartFunnel(BaseModel):
    add_to_cart: int
    abandoned: int
    purchased: int


class StoreInsights(BaseModel):
    top_sellers: List[TopSeller]
    dead_stock: List[DeadStock]
    abandonment_rate: float
    high_abandon_products: List[HighAbandonProduct]
    cart_funnel: CartFunnel


# ── Insights: Activity ────────────────────────────────────────────────────────

class HeatmapEntry(BaseModel):
    hour: str
    active_users: int


class ActivityInsights(BaseModel):
    heatmap: List[HeatmapEntry]
    peak_hours: List[str]
    avg_daily_users: float
