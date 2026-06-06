import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from database import init_db
from routers.auth import router as auth_router
from routers.ingest import router as ingest_router
from routers.insights import router as insights_router
from routers.labs import router as labs_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="Shelf — Buyer Intelligence API",
    description="Backend API for the Shelf buyer intelligence SaaS platform.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["Auth"])
app.include_router(ingest_router, prefix="/ingest", tags=["Ingest"])
app.include_router(insights_router, prefix="/insights", tags=["Insights"])
app.include_router(labs_router, prefix="/labs", tags=["Labs"])


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}
