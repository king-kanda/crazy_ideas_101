import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from dotenv import load_dotenv

load_dotenv()

from database import init_db
from auth import limiter
from routers.auth import router as auth_router
from routers.workspace import router as workspace_router
from routers.ingest import router as ingest_router
from routers.insights import router as insights_router
from routers.labs import router as labs_router
from routers.integrations_meta import router as integrations_meta_router
from routers.webhooks import router as webhooks_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Palda Commerce API",
    description="Backend API for Palda Commerce — the always-on layer between merchants' ads, inbox, and checkout.",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(workspace_router, prefix="/workspace", tags=["Workspace"])
app.include_router(ingest_router, prefix="/ingest", tags=["Ingest"])
app.include_router(insights_router, prefix="/insights", tags=["Insights"])
app.include_router(labs_router, prefix="/labs", tags=["Labs"])
app.include_router(integrations_meta_router, prefix="/integrations/meta", tags=["Integrations: Meta"])
app.include_router(webhooks_router, prefix="/webhooks", tags=["Webhooks"])


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}
