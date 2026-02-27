"""
Message routes — send a message (invokes LangGraph) and retrieve history.

  POST /conversations/{id}/messages   → send message
  GET  /conversations/{id}/messages   → get history
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from langchain_core.messages import AIMessage

from src.utils.auth import TokenPayload, verify_token
from src.memory.dynamodb_store import (
    get_conversation,
    get_messages,
    save_message,
    update_conversation,
)
from src.memory.manager import maybe_update_summary
from src.core.graph import graph

router = APIRouter()


# ── Request / Response models ────────────────────────────────────────────────

class SendMessageRequest(BaseModel):
    message: str
    language: str | None = None   # override per-message (rare)


# ── Send message — invokes the full LangGraph pipeline ──────────────────────

@router.post("/{conversation_id}/messages")
async def send_message(
    conversation_id: str,
    body: SendMessageRequest,
    user: TokenPayload = Depends(verify_token),
):
    # ── Validate conversation ownership ──────────────────────────────────
    conv = get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("userId") != user.sub:
        raise HTTPException(status_code=403, detail="Not your conversation")

    language = body.language or conv.get("language", "en")

    # ── Persist user message ─────────────────────────────────────────────
    save_message(conversation_id, role="user", content=body.message)

    # ── Invoke the LangGraph agent ───────────────────────────────────────
    initial_state = {
        "user_id": user.sub,
        "conversation_id": conversation_id,
        "selected_language": language,
        "human_input": body.message,
        "messages": [],
        "tool_outputs": [],
    }

    try:
        result = await graph.ainvoke(initial_state)
    except Exception as e:
        # Save an error message so the user gets some feedback
        error_msg = f"I'm sorry, I encountered an error processing your request. Please try again. ({type(e).__name__})"
        save_message(conversation_id, role="assistant", content=error_msg)
        return {
            "success": False,
            "error": str(e),
            "response": {"role": "assistant", "content": error_msg},
        }

    # ── Check for language rejection ─────────────────────────────────────
    if not result.get("language_accepted"):
        rejection = result.get("language_rejection", "Please use the selected language.")
        save_message(conversation_id, role="assistant", content=rejection)
        return {
            "success": True,
            "response": {
                "role": "assistant",
                "content": rejection,
                "language_rejected": True,
            },
        }

    # ── Extract the final AI response ────────────────────────────────────
    ai_content = ""
    tool_calls_meta = []
    for msg in reversed(result.get("messages", [])):
        if isinstance(msg, AIMessage) and msg.content and not msg.tool_calls:
            ai_content = msg.content
            break

    # Collect tool calls for metadata
    for msg in result.get("messages", []):
        if isinstance(msg, AIMessage) and msg.tool_calls:
            for tc in msg.tool_calls:
                tool_calls_meta.append({"name": tc["name"], "args": tc["args"]})

    if not ai_content:
        ai_content = "I processed your request but couldn't generate a response. Please try again."

    # ── Persist assistant message ────────────────────────────────────────
    saved_msg = save_message(
        conversation_id,
        role="assistant",
        content=ai_content,
        tool_calls=tool_calls_meta if tool_calls_meta else None,
    )

    # ── Update conversation metadata ─────────────────────────────────────
    msg_count = conv.get("messageCount", 0) + 2  # user + assistant
    title = conv.get("title", "New Chat")
    if title == "New Chat" and body.message:
        # Auto-title from first message
        title = body.message[:60] + ("…" if len(body.message) > 60 else "")

    update_conversation(conversation_id, messageCount=msg_count, title=title)

    # ── Re-summarise if needed (async-ish, don't block response) ─────────
    try:
        await maybe_update_summary(conversation_id)
    except Exception:
        pass

    return {
        "success": True,
        "response": {
            "role": "assistant",
            "content": ai_content,
            "messageId": saved_msg.get("messageId"),
            "toolCalls": tool_calls_meta if tool_calls_meta else None,
        },
    }


# ── Get message history ─────────────────────────────────────────────────────

@router.get("/{conversation_id}/messages")
async def get_message_history(
    conversation_id: str,
    limit: int = 50,
    user: TokenPayload = Depends(verify_token),
):
    conv = get_conversation(conversation_id)
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if conv.get("userId") != user.sub:
        raise HTTPException(status_code=403, detail="Not your conversation")

    messages = get_messages(conversation_id, limit=limit, ascending=True)
    return {
        "success": True,
        "messages": messages,
        "summary": conv.get("summary"),
    }
