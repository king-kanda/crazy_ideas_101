"""Celery tasks for Meta integrations: webhook processing + token health.

Processing logic is intentionally thin for now — the receiver has already
persisted the raw payload. These tasks exist so Phase 2 ships with the
plumbing in place; richer handlers land as Phase 4/5 features need them.
"""
import os
import logging
from datetime import datetime, timedelta

import httpx
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import Session

from celery_app import celery
from crypto import decrypt

log = logging.getLogger("palda.workers.meta")

DATABASE_URL = os.environ.get("DATABASE_URL", "")
META_GRAPH_VERSION = os.environ.get("META_GRAPH_VERSION", "v19.0")


def _sync_engine():
    # Celery workers use a plain sync engine. Convert async URL if needed.
    url = DATABASE_URL.replace("+asyncpg", "").replace("postgresql+asyncpg", "postgresql")
    return create_engine(url, pool_pre_ping=True)


@celery.task(name="workers.meta_events.process_webhook_event")
def process_webhook_event(event_db_id: str, platform: str) -> None:
    """Mark a WebhookEvent processed. Richer per-platform handlers land later."""
    from models import WebhookEvent  # local import — Celery worker boots models separately

    engine = _sync_engine()
    with Session(engine) as session:
        event = session.get(WebhookEvent, event_db_id)
        if not event:
            log.warning("process_webhook_event: no row for %s", event_db_id)
            return
        log.info("process_webhook_event platform=%s event_id=%s", platform, event.event_id)
        # TODO(phase-4/5): dispatch per platform.payload['field'] to downstream
        # handlers (inbound message → KB query, status → cart-recovery, etc.).
        event.processed_at = datetime.utcnow()
        event.status = "processed"
        session.commit()


@celery.task(name="workers.meta_events.meta_token_health_check")
def meta_token_health_check() -> None:
    """Hourly sweep: flag connections whose token is near expiry or returns an
    auth error from Meta. Does not auto-refresh — long-lived tokens from ES
    are 60-day tokens; we surface the state so the merchant can reconnect.
    """
    from models import MetaConnection

    engine = _sync_engine()
    now = datetime.utcnow()
    warn_window = now + timedelta(days=3)

    with Session(engine) as session:
        rows = session.execute(select(MetaConnection).where(MetaConnection.status != "revoked")).scalars().all()
        for row in rows:
            if row.token_expires_at and row.token_expires_at <= warn_window:
                _mark(session, row, "expired" if row.token_expires_at <= now else "active",
                      error=None if row.token_expires_at > now else "Token expired — reconnect required")
                continue
            plaintext = decrypt(row.access_token_encrypted)
            if not plaintext:
                _mark(session, row, "error", error="Could not decrypt stored token")
                continue
            ok, err = _probe_token(plaintext)
            _mark(session, row, "active" if ok else "error", error=err)
        session.commit()


def _probe_token(token: str) -> tuple[bool, str | None]:
    url = f"https://graph.facebook.com/{META_GRAPH_VERSION}/me"
    try:
        resp = httpx.get(url, params={"access_token": token}, timeout=8.0)
    except httpx.HTTPError as exc:
        return False, f"Network error: {exc}"
    if resp.status_code == 200:
        return True, None
    try:
        detail = resp.json().get("error", {}).get("message")
    except ValueError:
        detail = resp.text[:200]
    return False, f"Meta: {detail or resp.status_code}"


def _mark(session: Session, row, status: str, error: str | None) -> None:
    row.status = status
    row.last_health_check_at = datetime.utcnow()
    row.last_error = error
