import asyncio
import os
import time

from fastapi import APIRouter, Depends
from groq import Groq

from auth import get_store_from_jwt

router = APIRouter()

groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY", ""))


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
            messages=[
                {"role": "user", "content": "Reply with exactly: OK"}
            ],
            temperature=0,
            max_tokens=10,
        )
        elapsed_ms = round((time.monotonic() - start) * 1000)
        reply = response.choices[0].message.content.strip()
        return {
            "ok": True,
            "model": "llama-3.3-70b-versatile",
            "response": reply,
            "response_time_ms": elapsed_ms,
        }
    except Exception as exc:
        return {"ok": False, "error": str(exc)}


# ── Celery workers ────────────────────────────────────────────────────────────

@router.get("/celery")
async def test_celery(store=Depends(get_store_from_jwt)):
    redis_url = os.environ.get("REDIS_URL", "")
    if not redis_url:
        return {"ok": False, "error": "REDIS_URL is not set in environment"}

    def _ping():
        from celery_app import celery as celery_app
        inspector = celery_app.control.inspect(timeout=4)
        return inspector.ping()

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
            score = int(df["shoes"].mean())
            return {"ok": True, "keyword": "shoes", "geo": "US", "avg_interest": score, "response_time_ms": elapsed_ms}
        return {"ok": False, "error": "pytrends returned empty data (Google may be rate-limiting)"}

    try:
        result = await asyncio.get_event_loop().run_in_executor(None, _fetch)
        return result
    except Exception as exc:
        return {"ok": False, "error": str(exc)}
