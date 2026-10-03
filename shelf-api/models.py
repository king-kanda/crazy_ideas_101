import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Boolean, Numeric,
    ForeignKey, DateTime, JSON, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base


class Merchant(Base):
    __tablename__ = "merchants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    business_name = Column(Text, nullable=False)
    email = Column(Text, unique=True, nullable=False, index=True)
    # Nullable: OAuth-only merchants (e.g. Google sign-in) have no local password.
    password_hash = Column(Text, nullable=True)
    status = Column(Text, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)

    workspaces = relationship("Workspace", back_populates="merchant", cascade="all, delete-orphan")
    oauth_accounts = relationship("OAuthAccount", back_populates="merchant", cascade="all, delete-orphan")


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id = Column(UUID(as_uuid=True), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    provider = Column(Text, nullable=False)  # "google"
    provider_account_id = Column(Text, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    merchant = relationship("Merchant", back_populates="oauth_accounts")

    __table_args__ = (
        UniqueConstraint("provider", "provider_account_id", name="uq_oauth_provider_account"),
    )


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id = Column(UUID(as_uuid=True), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    timezone = Column(Text, default="Africa/Nairobi")
    currency = Column(Text, default="KES")
    created_at = Column(DateTime, default=datetime.utcnow)

    merchant = relationship("Merchant", back_populates="workspaces")
    stores = relationship("Store", back_populates="workspace")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    merchant_id = Column(UUID(as_uuid=True), ForeignKey("merchants.id", ondelete="CASCADE"), nullable=False, index=True)
    token = Column(Text, unique=True, nullable=False, index=True)
    kind = Column(Text, default="auth")  # "auth" | "reset"
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Store(Base):
    __tablename__ = "stores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True, index=True)
    owner_email = Column(Text, nullable=False)
    # Nullable: stores created under an OAuth-only merchant have no local password.
    owner_password_hash = Column(Text, nullable=True)
    store_name = Column(Text, nullable=False)
    store_url = Column(Text, nullable=False)
    platform = Column(Text, default="woocommerce")
    niche = Column(Text)
    location_country = Column(Text)
    location_city = Column(Text)
    api_key = Column(Text, unique=True, nullable=False)
    plugin_site_url = Column(Text, nullable=True)
    demo_loaded = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    workspace = relationship("Workspace", back_populates="stores")

    products = relationship("Product", back_populates="store", cascade="all, delete-orphan")
    search_events = relationship("SearchEvent", back_populates="store", cascade="all, delete-orphan")
    cart_events = relationship("CartEvent", back_populates="store", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="store", cascade="all, delete-orphan")
    trend_cache = relationship("TrendCache", back_populates="store", cascade="all, delete-orphan")


class MetaConnection(Base):
    """One row per (workspace, platform) Meta Embedded Signup connection.

    `access_token_encrypted` holds a Fernet-wrapped long-lived token; it must
    never be returned in an API response. `status` is 'active' | 'expired' |
    'revoked' | 'error'. Platform is 'whatsapp' | 'instagram' | 'facebook'.
    """
    __tablename__ = "meta_connections"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    platform = Column(Text, nullable=False)
    meta_business_id = Column(Text, nullable=True)
    meta_account_id = Column(Text, nullable=True, index=True)  # waba_id / ig_user_id / page_id
    display_name = Column(Text, nullable=True)
    access_token_encrypted = Column(Text, nullable=False)
    token_expires_at = Column(DateTime, nullable=True)
    scopes = Column(JSON, nullable=True)
    status = Column(Text, default="active", index=True)
    last_health_check_at = Column(DateTime, nullable=True)
    last_error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

    subscriptions = relationship("WebhookSubscription", back_populates="connection", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("workspace_id", "platform", name="uq_meta_workspace_platform"),
    )


class WebhookSubscription(Base):
    __tablename__ = "webhook_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    connection_id = Column(UUID(as_uuid=True), ForeignKey("meta_connections.id", ondelete="CASCADE"), nullable=False, index=True)
    topic = Column(Text, nullable=False)  # e.g. "messages", "message_echoes", "comments"
    status = Column(Text, default="subscribed")
    created_at = Column(DateTime, default=datetime.utcnow)

    connection = relationship("MetaConnection", back_populates="subscriptions")

    __table_args__ = (
        UniqueConstraint("connection_id", "topic", name="uq_webhook_connection_topic"),
    )


class WebhookEvent(Base):
    """Idempotency log + raw-payload buffer for Meta webhooks.

    `event_id` is the dedupe key (Meta's message/change id). The receiver
    writes the row and enqueues Celery; the worker picks up by `id`.
    """
    __tablename__ = "webhook_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    platform = Column(Text, nullable=False, index=True)
    event_id = Column(Text, nullable=False, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=True, index=True)
    payload = Column(JSON, nullable=False)
    received_at = Column(DateTime, default=datetime.utcnow, index=True)
    processed_at = Column(DateTime, nullable=True)
    status = Column(Text, default="pending", index=True)  # pending | processed | failed

    __table_args__ = (
        UniqueConstraint("platform", "event_id", name="uq_webhook_event_dedupe"),
    )


class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    wc_product_id = Column(Integer, nullable=False)
    name = Column(Text, nullable=False)
    category = Column(Text)
    price = Column(Numeric(10, 2))
    stock_status = Column(Text)
    is_demo = Column(Boolean, default=False)
    synced_at = Column(DateTime, default=datetime.utcnow)

    store = relationship("Store", back_populates="products")
    cart_events = relationship("CartEvent", back_populates="product")


class SearchEvent(Base):
    __tablename__ = "search_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    query = Column(Text, nullable=False)
    results_count = Column(Integer, default=0)
    user_found_product = Column(Boolean, default=False)
    is_demo = Column(Boolean, default=False)
    occurred_at = Column(DateTime, nullable=False)

    store = relationship("Store", back_populates="search_events")


class CartEvent(Base):
    __tablename__ = "cart_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(Text, nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    wc_product_id = Column(Integer, nullable=True)
    session_id = Column(Text)
    is_demo = Column(Boolean, default=False)
    occurred_at = Column(DateTime, nullable=False)

    store = relationship("Store", back_populates="cart_events")
    product = relationship("Product", back_populates="cart_events")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    hour_bucket = Column(DateTime, nullable=False)
    active_users = Column(Integer, default=0)
    page_views = Column(Integer, default=0)
    is_demo = Column(Boolean, default=False)

    store = relationship("Store", back_populates="activity_logs")


class TrendCache(Base):
    __tablename__ = "trend_cache"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    keyword = Column(Text, nullable=False)
    geo = Column(Text)
    trend_data = Column(JSON)
    fetched_at = Column(DateTime, default=datetime.utcnow)

    store = relationship("Store", back_populates="trend_cache")
