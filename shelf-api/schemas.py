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


class OAuthRequest(BaseModel):
    provider: str  # "google"
    email: EmailStr
    name: Optional[str] = None
    provider_account_id: str


class SignupResponse(BaseModel):
    token: str
    api_key: str
    store_id: str
    workspace_id: str
    merchant_id: str


class LogoutResponse(BaseModel):
    logged_out: bool


class ResetPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordResponse(BaseModel):
    accepted: bool
    # dev-only echo of the reset token so we can exercise the flow before
    # transactional email is wired up (see PRD §MVP: no user-facing email yet).
    dev_token: Optional[str] = None


class ResetPasswordConfirmRequest(BaseModel):
    token: str
    new_password: str


class ResetPasswordConfirmResponse(BaseModel):
    reset: bool


class CreateStoreRequest(BaseModel):
    store_name: str
    store_url: str
    niche: Optional[str] = None
    location_country: Optional[str] = None
    location_city: Optional[str] = None


class CreateStoreResponse(BaseModel):
    store_id: str
    api_key: str
    store_name: str
    store_url: str


class WorkspaceMeResponse(BaseModel):
    merchant_id: str
    workspace_id: str
    business_name: str
    email: str
    timezone: str
    currency: str
    has_store: bool
    store_id: Optional[str] = None
    store_name: Optional[str] = None


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
    category: Optional[str] = None
    action: Optional[str] = None


class DemandInsights(BaseModel):
    top_searches: List[TopSearch]
    trend_keywords: List[TrendKeyword]
    gaps: List[DemandGap]
    product_categories: List[str] = []


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


class DailyActivity(BaseModel):
    date: str
    active_users: int
    page_views: int


class ActivityInsights(BaseModel):
    heatmap: List[HeatmapEntry]
    daily: List[DailyActivity]
    peak_hours: List[str]
    avg_daily_users: float


# ── Meta Integrations ─────────────────────────────────────────────────────────

class MetaESCallbackRequest(BaseModel):
    """Payload posted by the frontend after Embedded Signup completes.

    `code` is the auth code Meta's SDK hands back; the backend exchanges it
    for a long-lived token. `platform` is one of 'whatsapp' | 'instagram' |
    'facebook'. `meta_account_id` is the waba_id / ig_user_id / page_id the
    merchant selected inside the ES popup.
    """
    platform: str
    code: str
    meta_business_id: Optional[str] = None
    meta_account_id: Optional[str] = None
    display_name: Optional[str] = None


class MetaConnectionStatus(BaseModel):
    platform: str
    connected: bool
    status: str  # "active" | "expired" | "revoked" | "error" | "not_connected"
    display_name: Optional[str] = None
    meta_account_id: Optional[str] = None
    token_expires_at: Optional[datetime] = None
    last_health_check_at: Optional[datetime] = None
    last_error: Optional[str] = None


class MetaStatusResponse(BaseModel):
    connections: List[MetaConnectionStatus]


class MetaDisconnectResponse(BaseModel):
    platform: str
    disconnected: bool


class WebhookAck(BaseModel):
    received: bool = True
