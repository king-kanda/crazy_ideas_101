"""Meta webhook receivers (WhatsApp / Instagram / Facebook).

Contract per Meta Graph:
  GET  /webhooks/{platform}?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
       → echo back `hub.challenge` when verify_token matches.
  POST /webhooks/{platform} with header `X-Hub-Signature-256: sha256=<hex>`
       → HMAC-SHA256(body, META_APP_SECRET) must match; dedupe by event id;
         persist raw payload; enqueue Celery; return 200 fast.
"""
import os
import hmac
import json
import hashlib
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response, status, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from database import get_db
from models import WebhookEvent, MetaConnection
from schemas import WebhookAck

log = logging.getLogger("palda.webhooks")
router = APIRouter()

META_APP_SECRET = os.environ.get("META_APP_SECRET", "")
META_WEBHOOK_VERIFY_TOKEN = os.environ.get("META_WEBHOOK_VERIFY_TOKEN", "")

SUPPORTED_PLATFORMS = {"whatsapp", "instagram", "facebook"}


def _verify_signature(raw_body: bytes, signature_header: Optional[str]) -> bool:
    """Verify X-Hub-Signature-256. In dev — when META_APP_SECRET is unset —
    signature is skipped so local testing is possible.
    """
    if not META_APP_SECRET:
        log.warning("META_APP_SECRET not configured — skipping signature verify (dev only)")
        return True
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(META_APP_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header.split("=", 1)[1])


def _extract_event_id(payload: dict, platform: str) -> Optional[str]:
    """Pull Meta's per-event id out of the payload for idempotent dedupe.

    Meta nests structure differently per platform; we walk the common shapes
    and fall back to a hash of the payload when nothing matches so we never
    drop legitimate traffic.
    """
    try:
        entries = payload.get("entry", [])
        if entries:
            first = entries[0]
            # WhatsApp Cloud API
            changes = first.get("changes", [])
            if changes:
                value = changes[0].get("value", {})
                messages = value.get("messages", [])
                if messages and messages[0].get("id"):
                    return messages[0]["id"]
                statuses = value.get("statuses", [])
                if statuses and statuses[0].get("id"):
                    return f"status:{statuses[0]['id']}"
            # IG / FB messaging
            messaging = first.get("messaging", [])
            if messaging and messaging[0].get("message", {}).get("mid"):
                return messaging[0]["message"]["mid"]
            if first.get("id") and first.get("time"):
                return f"{first['id']}:{first['time']}"
    except (KeyError, IndexError, TypeError):
        pass
    return "hash:" + hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:32]


async def _lookup_workspace_id(payload: dict, platform: str, db: AsyncSession) -> Optional[str]:
    """Best-effort reverse lookup from Meta IDs → workspace_id.

    Keeps webhook payloads tenant-scoped before Celery picks them up.
    """
    try:
        entry = payload.get("entry", [{}])[0]
        meta_account_id = None
        if platform == "whatsapp":
            meta_account_id = entry.get("changes", [{}])[0].get("value", {}).get("metadata", {}).get("phone_number_id")
        elif platform in ("instagram", "facebook"):
            meta_account_id = entry.get("id")
        if not meta_account_id:
            return None
        row = (
            await db.execute(
                select(MetaConnection).where(
                    MetaConnection.platform == platform,
                    MetaConnection.meta_account_id == str(meta_account_id),
                )
            )
        ).scalars().first()
        return row.workspace_id if row else None
    except (KeyError, IndexError, TypeError):
        return None


def _enqueue_event(event_db_id: str, platform: str) -> None:
    """Hand off to Celery for actual processing. Imported lazily so webhook
    receivers don't drag in the Celery app at import time.
    """
    try:
        from workers.meta_events import process_webhook_event
        process_webhook_event.delay(str(event_db_id), platform)
    except Exception:
        log.exception("Failed to enqueue webhook event %s", event_db_id)


@router.get("/{platform}", response_class=PlainTextResponse)
async def verify(platform: str, request: Request):
    """Meta's subscription verification handshake."""
    if platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown platform")

    params = request.query_params
    mode = params.get("hub.mode")
    verify_token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and verify_token and verify_token == META_WEBHOOK_VERIFY_TOKEN:
        return PlainTextResponse(content=challenge or "", status_code=200)
    raise HTTPException(status.HTTP_403_FORBIDDEN, "Verification failed")


@router.post("/{platform}", response_model=WebhookAck)
async def receive(
    platform: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    if platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown platform")

    raw_body = await request.body()
    signature = request.headers.get("x-hub-signature-256") or request.headers.get("X-Hub-Signature-256")
    if not _verify_signature(raw_body, signature):
        log.warning("Rejected webhook POST /%s — bad signature", platform)
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bad signature")

    try:
        payload = json.loads(raw_body or b"{}")
    except json.JSONDecodeError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Malformed JSON")

    event_id = _extract_event_id(payload, platform)
    workspace_id = await _lookup_workspace_id(payload, platform, db)

    event = WebhookEvent(
        platform=platform,
        event_id=event_id,
        workspace_id=workspace_id,
        payload=payload,
        status="pending",
    )
    db.add(event)
    try:
        await db.commit()
        await db.refresh(event)
        _enqueue_event(event.id, platform)
    except IntegrityError:
        # Dedupe hit — Meta is retrying. Silently 200 so they stop.
        await db.rollback()
        log.info("Dropped duplicate webhook event platform=%s event_id=%s", platform, event_id)

    return WebhookAck(received=True)
