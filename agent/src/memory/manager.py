"""
Memory manager — orchestrates short-term + long-term memory for the agent.

Short-term: Last N messages verbatim, older messages summarised.
Long-term: Facts / preferences extracted by the LLM and persisted.
"""
from __future__ import annotations
from typing import Dict, List, Optional, Tuple

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from src.config.settings import SHORT_TERM_MESSAGE_LIMIT
from src.memory.dynamodb_store import (
    get_messages,
    get_long_term_memory,
    get_conversation,
    update_conversation,
    update_long_term_memory,
    count_messages,
)


async def _call_bedrock_for_text(prompt: str) -> str:
    """Quick helper to call Gemini for a short text-generation task. Falls back gracefully."""
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        llm = ChatGoogleGenerativeAI(
            model="gemini-1.5-flash",
            google_api_key="AIzaSyDfLiU7JiiuUQwbgiMRNyubTt6inGA-0m0",
            max_output_tokens=600,
            temperature=0.3,
        )
        resp = await llm.ainvoke([HumanMessage(content=prompt)])
        return resp.content
    except Exception:
        # LLM not available — return a simple fallback
        return "(Summary unavailable — LLM not configured)"


# ─────────────────────────────────────────────────────────────────────────────
# Short-term memory: build the message list fed to the LLM
# ─────────────────────────────────────────────────────────────────────────────

async def build_message_history(conversation_id: str) -> Tuple[list, Optional[str]]:
    """
    Returns:
        (recent_lc_messages, summary_text)
        - recent_lc_messages: LangChain BaseMessage list for the last N messages
        - summary_text: Summary of older messages (or None if all fit in window)
    """
    all_messages = get_messages(conversation_id, limit=500, ascending=True)
    total = len(all_messages)

    # Build LangChain messages for the last N
    recent_raw = all_messages[-SHORT_TERM_MESSAGE_LIMIT:] if total > SHORT_TERM_MESSAGE_LIMIT else all_messages
    recent_lc = _to_langchain_messages(recent_raw)

    # Check if we need a summary for older messages
    summary = None
    conv = get_conversation(conversation_id)
    if conv:
        summary = conv.get("summary") or None

    if total > SHORT_TERM_MESSAGE_LIMIT and not summary:
        # Generate summary for the older messages
        older = all_messages[:-SHORT_TERM_MESSAGE_LIMIT]
        summary = await _summarize_messages(older)
        if conv:
            update_conversation(conversation_id, summary=summary)

    return recent_lc, summary


async def maybe_update_summary(conversation_id: str) -> None:
    """Re-summarise if total messages exceeded the threshold since last summary."""
    total = count_messages(conversation_id)
    if total <= SHORT_TERM_MESSAGE_LIMIT:
        return

    all_messages = get_messages(conversation_id, limit=500, ascending=True)
    older = all_messages[:-SHORT_TERM_MESSAGE_LIMIT]
    summary = await _summarize_messages(older)
    update_conversation(conversation_id, summary=summary)


def _to_langchain_messages(raw: List[Dict]) -> list:
    """Convert DynamoDB message dicts → LangChain message objects."""
    result = []
    for m in raw:
        role = m.get("role", "user")
        content = m.get("content", "")
        if role in ("user", "human"):
            result.append(HumanMessage(content=content))
        elif role in ("assistant", "ai"):
            result.append(AIMessage(content=content))
        elif role == "system":
            result.append(SystemMessage(content=content))
    return result


async def _summarize_messages(messages: List[Dict]) -> str:
    """Ask the LLM to produce a concise conversation summary."""
    transcript = "\n".join(
        f"{'User' if m.get('role') in ('user', 'human') else 'Assistant'}: {m.get('content', '')[:300]}"
        for m in messages
    )
    prompt = (
        "Summarise the following conversation between a fisherman and an AI assistant. "
        "Keep the summary under 200 words. Focus on: topics discussed, decisions made, "
        "any specific data mentioned (species, locations, dates). Write in plain language.\n\n"
        f"{transcript}\n\nSummary:"
    )
    return await _call_bedrock_for_text(prompt)


# ─────────────────────────────────────────────────────────────────────────────
# Long-term memory: extract and persist facts
# ─────────────────────────────────────────────────────────────────────────────

async def extract_and_update_long_term_memory(
    user_id: str,
    user_message: str,
    assistant_response: str,
) -> None:
    """
    Ask the LLM whether the latest exchange reveals new persistent facts
    about the user. If yes, merge them into existing long-term memory.
    """
    existing = get_long_term_memory(user_id) or "No facts recorded yet."

    prompt = (
        "You are a memory extraction system. Given the EXISTING facts about a fisherman user "
        "and their LATEST conversation exchange, determine if there are any NEW permanent facts "
        "worth remembering (e.g. home port, boat type, preferred fish, family details, experience).\n\n"
        f"EXISTING FACTS:\n{existing}\n\n"
        f"USER MESSAGE:\n{user_message}\n\n"
        f"ASSISTANT RESPONSE:\n{assistant_response}\n\n"
        "If there are new facts, output the COMPLETE updated fact list (merge old + new). "
        "If nothing new, output the existing facts unchanged. "
        "Keep the format as a simple bullet list. Be concise.\n\n"
        "UPDATED FACTS:"
    )
    updated = await _call_bedrock_for_text(prompt)
    if updated.strip():
        update_long_term_memory(user_id, updated.strip())
