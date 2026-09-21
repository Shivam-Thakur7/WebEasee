"""
WebEase Backend — FastAPI Entry Point
Run with:  uvicorn main:app --reload --host 127.0.0.1 --port 8000
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config
from routes import voice, commands, documents, history

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)s  %(message)s")
logger = logging.getLogger("webease")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    missing = config.validate_config()
    if missing:
        logger.warning(f"Missing env vars: {missing}  — some features will not work.")
    else:
        logger.info("All Azure credentials loaded OK.")
    yield
    # Shutdown  (nothing to clean up yet)


app = FastAPI(
    title="WebEase API",
    version="2.4.0",
    description="AI-powered accessibility backend — Azure Speech + Azure AI Foundry",
    lifespan=lifespan,
)

# ── CORS ────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────────────────────────────
app.include_router(voice.router,     prefix="/voice",     tags=["Voice"])
app.include_router(commands.router,  prefix="/commands",  tags=["Commands"])
app.include_router(documents.router, prefix="/documents", tags=["Documents"])
app.include_router(history.router,   prefix="/history",   tags=["History"])


@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "WebEase API", "version": "2.4.0"}


@app.get("/health", tags=["Health"])
async def health():
    missing = config.validate_config()
    return {
        "status": "healthy" if not missing else "degraded",
        "missing_config": missing,
    }
