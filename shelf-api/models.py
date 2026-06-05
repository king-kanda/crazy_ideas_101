import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Text, Integer, Boolean, Numeric,
    ForeignKey, DateTime, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from database import Base


class Store(Base):
    __tablename__ = "stores"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_email = Column(Text, nullable=False)
    owner_password_hash = Column(Text, nullable=False)
    store_name = Column(Text, nullable=False)
    store_url = Column(Text, nullable=False)
    platform = Column(Text, default="woocommerce")
    niche = Column(Text)
    location_country = Column(Text)
    location_city = Column(Text)
    api_key = Column(Text, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    products = relationship("Product", back_populates="store", cascade="all, delete-orphan")
    search_events = relationship("SearchEvent", back_populates="store", cascade="all, delete-orphan")
    cart_events = relationship("CartEvent", back_populates="store", cascade="all, delete-orphan")
    activity_logs = relationship("ActivityLog", back_populates="store", cascade="all, delete-orphan")
    trend_cache = relationship("TrendCache", back_populates="store", cascade="all, delete-orphan")


class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    wc_product_id = Column(Integer, nullable=False)
    name = Column(Text, nullable=False)
    category = Column(Text)
    price = Column(Numeric(10, 2))
    stock_status = Column(Text)
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
    occurred_at = Column(DateTime, nullable=False)

    store = relationship("Store", back_populates="search_events")


class CartEvent(Base):
    __tablename__ = "cart_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    store_id = Column(UUID(as_uuid=True), ForeignKey("stores.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(Text, nullable=False)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True)
    session_id = Column(Text)
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
