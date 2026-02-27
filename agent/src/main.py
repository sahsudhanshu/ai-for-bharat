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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.routes.conversations import router as conversations_router
from src.routes.messages import router as messages_router
from src.routes.compat import router as compat_router

app = FastAPI(
    title="OceanAI Agent",
    description="AI-powered fisherman's companion — LangGraph + Bedrock",
    version="1.0.0",
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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "oceanai-agent"}
