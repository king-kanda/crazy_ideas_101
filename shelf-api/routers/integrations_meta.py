"""Meta Embedded Signup integration endpoints.

The real token exchange happens via Meta's Graph API:
    GET https://graph.facebook.com/v19.0/oauth/access_token
        ?client_id=<APP_ID>&client_secret=<APP_SECRET>
        &redirect_uri=<URI>&code=<CODE>

We then upsert a MetaConnection row keyed by (workspace_id, platform). Tokens
are stored Fernet-encrypted and never returned over the wire.
"""
import os
import logging
from datetime import datetime, timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import get_workspace_from_jwt, limiter
from crypto import encrypt
from database import get_db
from models import MetaConnection, Workspace
from schemas import (
    MetaESCallbackRequest, MetaStatusResponse, MetaConnectionStatus,
    MetaDisconnectResponse,
)

log = logging.getLogger("palda.integrations.meta")
router = APIRouter()

META_APP_ID = os.environ.get("META_APP_ID", "")
META_APP_SECRET = os.environ.get("META_APP_SECRET", "")
META_GRAPH_VERSION = os.environ.get("META_GRAPH_VERSION", "v19.0")
META_REDIRECT_URI = os.environ.get("META_REDIRECT_URI", "")

SUPPORTED_PLATFORMS = {"whatsapp", "instagram", "facebook"}


async def _exchange_code(code: str) -> dict:
    """Exchange an ES auth code for a long-lived token via Meta Graph API.

    Returns {"access_token": str, "expires_in": int|None}. Raises HTTPException
    on failure. In dev — when META_APP_SECRET is unset — returns a sentinel so
    the rest of the flow can be exercised without Meta creds.
    """
    if not META_APP_SECRET or not META_APP_ID:
        log.warning("META_APP_ID/SECRET not configured — returning dev sentinel token")
        return {"access_token": f"dev-token-{code[:12]}", "expires_in": 60 * 60 * 24 * 60}

    url = f"https://graph.facebook.com/{META_GRAPH_VERSION}/oauth/access_token"
    params = {
        "client_id": META_APP_ID,
        "client_secret": META_APP_SECRET,
        "redirect_uri": META_REDIRECT_URI,
        "code": code,
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(url, params=params)
    if resp.status_code != 200:
        log.error("Meta token exchange failed: %s %s", resp.status_code, resp.text)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Meta token exchange failed",
        )
    data = resp.json()
    return {
        "access_token": data["access_token"],
        "expires_in": data.get("expires_in"),
    }


@router.post("/es-callback")
@limiter.limit("20/minute")
async def es_callback(
    request: Request,
    body: MetaESCallbackRequest,
    workspace: Workspace = Depends(get_workspace_from_jwt),
    db: AsyncSession = Depends(get_db),
):
    if body.platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported platform")

    token_data = await _exchange_code(body.code)
    expires_at = None
    if token_data.get("expires_in"):
        expires_at = datetime.utcnow() + timedelta(seconds=int(token_data["expires_in"]))

    existing = (
        await db.execute(
            select(MetaConnection).where(
                MetaConnection.workspace_id == workspace.id,
                MetaConnection.platform == body.platform,
            )
        )
    ).scalars().first()

    if existing:
        existing.access_token_encrypted = encrypt(token_data["access_token"])
        existing.token_expires_at = expires_at
        existing.meta_business_id = body.meta_business_id or existing.meta_business_id
        existing.meta_account_id = body.meta_account_id or existing.meta_account_id
        existing.display_name = body.display_name or existing.display_name
        existing.status = "active"
        existing.last_error = None
        existing.updated_at = datetime.utcnow()
        connection = existing
    else:
        connection = MetaConnection(
            workspace_id=workspace.id,
            platform=body.platform,
            meta_business_id=body.meta_business_id,
            meta_account_id=body.meta_account_id,
            display_name=body.display_name,
            access_token_encrypted=encrypt(token_data["access_token"]),
            token_expires_at=expires_at,
            status="active",
        )
        db.add(connection)

    await db.commit()
    await db.refresh(connection)
    return _to_status(connection, body.platform)


@router.get("/status", response_model=MetaStatusResponse)
async def status_endpoint(
    workspace: Workspace = Depends(get_workspace_from_jwt),
    db: AsyncSession = Depends(get_db),
):
    rows = (
        await db.execute(
            select(MetaConnection).where(MetaConnection.workspace_id == workspace.id)
        )
    ).scalars().all()
    by_platform = {r.platform: r for r in rows}

    connections = []
    for platform in ("whatsapp", "instagram", "facebook"):
        connections.append(_to_status(by_platform.get(platform), platform))
    return MetaStatusResponse(connections=connections)


@router.delete("/{platform}", response_model=MetaDisconnectResponse)
async def disconnect(
    platform: str,
    workspace: Workspace = Depends(get_workspace_from_jwt),
    db: AsyncSession = Depends(get_db),
):
    if platform not in SUPPORTED_PLATFORMS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Unsupported platform")

    row = (
        await db.execute(
            select(MetaConnection).where(
                MetaConnection.workspace_id == workspace.id,
                MetaConnection.platform == platform,
            )
        )
    ).scalars().first()
    if not row:
        return MetaDisconnectResponse(platform=platform, disconnected=False)

    await db.delete(row)
    await db.commit()
    return MetaDisconnectResponse(platform=platform, disconnected=True)


def _to_status(row: Optional[MetaConnection], platform: str) -> MetaConnectionStatus:
    if not row:
        return MetaConnectionStatus(platform=platform, connected=False, status="not_connected")
    return MetaConnectionStatus(
        platform=platform,
        connected=row.status == "active",
        status=row.status,
        display_name=row.display_name,
        meta_account_id=row.meta_account_id,
        token_expires_at=row.token_expires_at,
        last_health_check_at=row.last_health_check_at,
        last_error=row.last_error,
    )
