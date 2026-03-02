"""
FastAPI application — HTTP layer for the OceanAI agent.

Routes:
  POST /conversations               → create conversation
  GET  /conversations               → list conversations
  GET  /conversations/{id}          → get conversation detail
  DELETE /conversations/{id}        → delete conversation
  POST /conversations/{id}/messages → send message (streaming / sync)
  GET  /conversations/{id}/messages → get message history

Deployed on Lambda via Mangum (handler.py).
"""
from __future__ import annotations
import logging

from dotenv import load_dotenv
load_dotenv()

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.routes.conversations import router as conversations_router
from src.routes.messages import router as messages_router
from src.routes.compat import router as compat_router
from src.config.settings import TELEGRAM_BOT_TOKEN, TELEGRAM_ALERTS_ENABLED

logger = logging.getLogger(__name__)

# ── Telegram bot + scheduler lifecycle ───────────────────────────────────────
_telegram_app = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup/shutdown: run diagnostics, launch Telegram bot polling + alert scheduler."""
    global _telegram_app

    # ── Run startup diagnostics ──────────────────────────────────────────────
    from src.utils.startup_check import run_startup_checks
    diagnostics = await run_startup_checks()
    if not diagnostics.get('ok', True):
        logger.error("Critical startup checks failed — see diagnostics above")

    if TELEGRAM_BOT_TOKEN:
        try:
            from src.telegram.bot import create_telegram_app
            from src.telegram.scheduler import start_scheduler, stop_scheduler

            _telegram_app = create_telegram_app()
            await _telegram_app.initialize()
            await _telegram_app.start()
            # Start polling in the background (non-blocking)
            await _telegram_app.updater.start_polling(drop_pending_updates=True)
            logger.info("Telegram bot started polling")

            if TELEGRAM_ALERTS_ENABLED:
                start_scheduler()
                logger.info("Alert scheduler started")
        except Exception as e:
            logger.error(f"Telegram bot startup failed: {e}")
    else:
        logger.info("TELEGRAM_BOT_TOKEN not set — Telegram features disabled")

    yield  # app is running

    # Shutdown
    if _telegram_app:
        try:
            from src.telegram.scheduler import stop_scheduler
            stop_scheduler()
            await _telegram_app.updater.stop()
            await _telegram_app.stop()
            await _telegram_app.shutdown()
            logger.info("Telegram bot stopped")
        except Exception as e:
            logger.error(f"Telegram bot shutdown error: {e}")


app = FastAPI(
    title="OceanAI Agent",
    description="AI-powered fisherman's companion — LangGraph + Gemini",
    version="1.1.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],           # TODO: lock to frontend domain in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routes ───────────────────────────────────────────────────────────────────
app.include_router(conversations_router, prefix="/conversations", tags=["conversations"])
app.include_router(messages_router, prefix="/conversations", tags=["messages"])
app.include_router(compat_router, prefix="/chat", tags=["chat-compat"])

# Telegram admin routes (only active when token is set)
from src.routes.telegram_admin import router as telegram_router
app.include_router(telegram_router, prefix="/telegram", tags=["telegram"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "oceanai-agent"}
