"""
Message routes — send a message (invokes LangGraph) and retrieve history.

  POST /conversations/{id}/messages   → send message
  GET  /conversations/{id}/messages   → get history
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
import json
import asyncio
from pydantic import BaseModel
from langchain_core.messages import AIMessage, AIMessageChunk

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


def _extract_text(content) -> str:
    """Normalize AIMessage.content — Gemini 2.5 may return a list of blocks."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, str):
                parts.append(block)
            elif isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
        return "\n".join(parts)
    return str(content)


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
    print(f"DEBUG /messages: Invoking graph with selected_language: '{language}'")

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
            ai_content = _extract_text(msg.content)
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


# ── Stream message — SSE chunks of AI response ──────────────────────────────

@router.post("/{conversation_id}/messages/stream")
async def send_message_stream(
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

    initial_state = {
        "user_id": user.sub,
        "conversation_id": conversation_id,
        "selected_language": language,
        "human_input": body.message,
        "messages": [],
        "tool_outputs": [],
    }

    async def event_generator():
        try:
            ai_content_chunks = []
            tool_calls_meta = []
            final_ai_msg_id = ""
            
            # Using astream_events handles yielding the tokens as they arrive
            async for event in graph.astream_events(initial_state, version="v2"):
                kind = event["event"]
                
                # Check for output from the LLM specific event
                if kind == "on_chat_model_stream":
                    chunk = event["data"]["chunk"]
                    if isinstance(chunk, AIMessageChunk) and chunk.content:
                        text = _extract_text(chunk.content)
                        if text:
                            ai_content_chunks.append(text)
                            yield f"data: {json.dumps({'type': 'chunk', 'text': text})}\n\n"
                            
                elif kind == "on_tool_start":
                    tool_name = event.get("name")
                    yield f"data: {json.dumps({'type': 'tool', 'name': tool_name})}\n\n"

            # After stream finishes, we need to save the final message properly
            # Run the graph again with invoke? No, since astream_events runs the graph completely,
            # we just collected all parts.
            
            ai_content = "".join(ai_content_chunks)
            if not ai_content:
                ai_content = "I processed your request but couldn't generate a text response."

            # We didn't collect tool_calls_meta properly from stream events so we might not have them easily,
            # but for simplicity we save the text content.
            saved_msg = save_message(
                conversation_id,
                role="assistant",
                content=ai_content,
                tool_calls=None,  # Not extracting parsed tool calls in stream easily yet
            )

            # Update conversation metadata
            msg_count = conv.get("messageCount", 0) + 2
            title = conv.get("title", "New Chat")
            if title == "New Chat" and body.message:
                title = body.message[:60] + ("…" if len(body.message) > 60 else "")

            update_conversation(conversation_id, messageCount=msg_count, title=title)

            # Re-summarize silently in background
            asyncio.create_task(maybe_update_summary(conversation_id))

            yield f"data: {json.dumps({'type': 'end', 'messageId': saved_msg.get('messageId')})}\n\n"
        except Exception as e:
            error_msg = f"Error during streaming: {str(e)}"
            save_message(conversation_id, role="assistant", content=error_msg)
            yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


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
