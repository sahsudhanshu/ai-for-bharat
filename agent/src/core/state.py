"""
LangGraph agent state — TypedDict that flows through every node.
"""
from __future__ import annotations
from typing import Any, Dict, List, Literal, Optional, TypedDict

from langchain_core.messages import BaseMessage


class AgentState(TypedDict, total=False):
    """
    Accumulated state passed through the LangGraph graph.
    """
    # ── Identifiers ──────────────────────────────────────────────────────────
    user_id: str
    conversation_id: str

    # ── Language ─────────────────────────────────────────────────────────────
    selected_language: str                 # e.g. "hi", "en", "ta" …
    language_accepted: bool                # set by language_guard node
    language_rejection: Optional[str]      # message to return if rejected

    # ── Messages ─────────────────────────────────────────────────────────────
    messages: List[BaseMessage]            # full chat history fed to the LLM
    human_input: str                       # latest user text

    # ── Context (injected before agent) ──────────────────────────────────────
    summary: Optional[str]                 # summary of older messages
    long_term_memory: Optional[str]        # persisted facts / preferences
    region_context: Optional[str]          # nearby ocean zones, markers
    catch_context: Optional[str]           # recent catch history snippet

    # ── Tool outputs ─────────────────────────────────────────────────────────
    tool_outputs: List[Dict[str, Any]]     # aggregated tool results

    # ── Control flow ─────────────────────────────────────────────────────────
    next_action: Literal["continue", "end"]
