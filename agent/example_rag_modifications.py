"""
Example Updated AgentState with RAG fields

Add these fields to your existing src/core/state.py in the AgentState TypedDict:
"""

# These are the new fields to ADD to AgentState in src/core/state.py:

STATE_UPDATE_CODE = '''
# ── RAG/Knowledge Base Fields ────────────────────────────────────────────
rag_context: Optional[str]              # Retrieved docs from Bedrock KB
rag_query: Optional[str]                # Query used for RAG retrieval
rag_documents_count: int                # Number of documents retrieved
rag_query_type: Optional[str]           # Type: "species", "policy", "general"
detected_species: Optional[str]         # Fish species from classifier
rag_error: Optional[str]                # Error message if retrieval fails
'''

# ═════════════════════════════════════════════════════════════════════════════
# COMPLETE UPDATED STATE FILE EXAMPLE
# ═════════════════════════════════════════════════════════════════════════════

COMPLETE_UPDATED_STATE = '''"""
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
    catch_context: Optional[str]           # local catch info, species

    # ── LLM & Reasoning ──────────────────────────────────────────────────────
    llm_output: Optional[Any]              # full output object from LLM
    tool_calls: Optional[List[Dict]]       # if LLM produced tool calls
    final_response: Optional[str]          # final answer to user

    # ── Memory Management ────────────────────────────────────────────────────
    should_persist_memory: bool            # whether to save to long-term

    # ────────────────────────────────────────────────────────────────────────
    # NEW: RAG/Knowledge Base Fields
    # ────────────────────────────────────────────────────────────────────────
    rag_context: Optional[str]              # Retrieved docs from Bedrock KB
    rag_query: Optional[str]                # Query used for RAG retrieval
    rag_documents_count: int                # Number of documents retrieved (default 0)
    rag_query_type: Optional[str]           # Type: "species", "policy", "general"
    detected_species: Optional[str]         # Fish species detected by classifier
    rag_error: Optional[str]                # Error message if retrieval fails
'''


# ═════════════════════════════════════════════════════════════════════════════
# EXAMPLE UPDATED PROMPT FUNCTION
# ═════════════════════════════════════════════════════════════════════════════

UPDATED_BUILD_SYSTEM_PROMPT = '''
def build_system_prompt(
    selected_language: str,
    summary: str | None = None,
    long_term_memory: str | None = None,
    region_context: str | None = None,
    catch_context: str | None = None,
    rag_context: str | None = None,  # ADD THIS PARAMETER
) -> str:
    """
    Compose a full system prompt with injected context blocks.
    """
    lang_label = LANGUAGE_LABELS.get(selected_language, "English")

    sections: list[str] = []

    # ── Core identity ────────────────────────────────────────────────────────
    sections.append(f"""You are **SagarMitra** (सागरमित्र) — an AI-powered companion for Indian fishermen.
    
    [... existing identity text ...]
    """)

    # ── Conversation summary (older messages) ─────────────────────────────
    if summary:
        sections.append(f"""## Earlier Conversation Summary
{summary}
""")

    # ── Long-term memory ──────────────────────────────────────────────────
    if long_term_memory:
        sections.append(f"""## Your Saved Information
{long_term_memory}
""")

    # ── Region context ────────────────────────────────────────────────────
    if region_context:
        sections.append(f"""## Your Local Fishing Area
{region_context}
""")

    # ── Catch context ────────────────────────────────────────────────────
    if catch_context:
        sections.append(f"""## Your Recent Catches
{catch_context}
""")

    # ── NEW: RAG CONTEXT ─────────────────────────────────────────────────
    if rag_context:
        sections.append(f"""## Fish Knowledge Base Context

The following verified information from fish knowledge databases:

{rag_context}

**Guidelines for using this context**:
- Use this information for accurate facts about fish species, breeding seasons, regulations
- Always prioritize specific knowledge base information over general knowledge
- Cite sources when relevant: "According to the knowledge base..."
- If information seems outdated, note that and provide current info if you have it
- This context is especially reliable for government policies and regulations
""")

    # ── Instructions ─────────────────────────────────────────────────────
    sections.append(f"""## Communication Guidelines

- CRITICAL: Respond ENTIRELY in **{lang_label} ({selected_language})**
- Use simple, clear language for fishermen with limited literacy
- Be practical and solution-focused
- Encourage and be respectful
- Use cultural references Indian fishermen relate to
- Translate all tool outputs, prices, and technical terms into {lang_label}
""")

    return "\\n\\n".join(sections)
'''


# ═════════════════════════════════════════════════════════════════════════════
# EXAMPLE UPDATED AGENT NODE
# ═════════════════════════════════════════════════════════════════════════════

UPDATED_AGENT_NODE = '''
async def agent_node(state: AgentState) -> Dict[str, Any]:
    """
    UPDATED: Now uses RAG context in system prompt
    """
    text = state["human_input"]
    lang = state.get("selected_language", "en")
    
    # ── Build system prompt WITH RAG CONTEXT ──────────────────────────────
    system_prompt = build_system_prompt(
        lang,
        summary=state.get("summary"),
        long_term_memory=state.get("long_term_memory"),
        region_context=state.get("region_context"),
        catch_context=state.get("catch_context"),
        rag_context=state.get("rag_context"),  # ADD THIS LINE
    )

    # ── Build messages ────────────────────────────────────────────────────
    messages = [
        SystemMessage(content=system_prompt),
        *build_message_history(state),
        HumanMessage(content=text),
    ]

    # ── Call LLM ──────────────────────────────────────────────────────────
    llm = _get_llm()
    output = llm.invoke(messages)

    # ── Extract tool calls ────────────────────────────────────────────────
    tool_calls = getattr(output, "tool_calls", None) or []

    return {
        "llm_output": output,
        "tool_calls": tool_calls,
    }
'''


# ═════════════════════════════════════════════════════════════════════════════
# EXAMPLE: ADD RAG NODE AND UPDATE GRAPH
# ═════════════════════════════════════════════════════════════════════════════

UPDATED_GRAPH_SETUP = '''
# At the top of src/core/graph.py, add imports:

from rag_agent_integration import (
    retrieve_rag_context,
    create_rag_tool,
    initialize_retriever
)

# ... other imports ...

# Initialize RAG retriever
try:
    _retriever = initialize_retriever()
    logger.info("✓ RAG Retriever initialized")
except Exception as e:
    logger.warning(f"⚠ RAG not available: {e}")
    _retriever = None


# Update TOOLS list to include RAG tool:

TOOLS = [
    get_weather,
    get_catch_history,
    get_catch_details,
    get_map_data,
    get_market_prices,
    create_rag_tool(),  # ADD THIS LINE
]


# NEW NODE: Retrieve RAG context

async def rag_node(state: AgentState) -> Dict[str, Any]:
    """
    Retrieve context from Bedrock Knowledge Base before LLM call
    """
    if not _retriever:
        logger.warning("RAG retriever not available, skipping")
        return {"rag_context": "", "rag_documents_count": 0}
    
    return retrieve_rag_context(state)


# In the build_graph() or create_graph() function:

def build_graph():
    graph = StateGraph(AgentState)

    # Add nodes (in order)
    graph.add_node("language_guard", language_guard)
    graph.add_node("load_context", load_context)
    graph.add_node("rag", rag_node)  # ADD THIS LINE
    graph.add_node("agent", agent_node)
    graph.add_node("tool_executor", tool_executor)
    graph.add_node("memory_update", memory_update)

    # Set entry
    graph.set_entry_point("language_guard")

    # Edges
    graph.add_conditional_edges(
        "language_guard",
        lambda x: "reject" if not x.get("language_accepted") else "load_context",
        {
            "reject": END,
            "load_context": "load_context",
        }
    )

    graph.add_edge("load_context", "rag")  # CHANGE THIS LINE (was "agent")
    graph.add_edge("rag", "agent")  # ADD THIS LINE

    graph.add_conditional_edges(
        "agent",
        lambda x: "tool_executor" if x.get("tool_calls") else "memory_update",
        {
            "tool_executor": "tool_executor",
        }
    )

    graph.add_edge("tool_executor", "agent")
    graph.add_edge("memory_update", END)

    return graph.compile()
'''


# ═════════════════════════════════════════════════════════════════════════════
# QUICK COPY-PASTE MODIFICATIONS
# ═════════════════════════════════════════════════════════════════════════════

QUICK_START = '''
QUICK START - 3 File Changes Required:

1. src/core/state.py
   - Add rag_context, rag_query, rag_documents_count, rag_query_type, 
     detected_species, rag_error to AgentState TypedDict

2. src/core/prompts.py
   - Add rag_context parameter to build_system_prompt()
   - Add RAG context section to sections list

3. src/core/graph.py
   - Add imports from rag_agent_integration
   - Add create_rag_tool() to TOOLS list
   - Add rag_node function
   - Changed edge "load_context" → "rag" (was "agent")
   - Add edge "rag" → "agent"
   - Update agent_node to pass rag_context to build_system_prompt()

That's it! The system now uses RAG.
'''


if __name__ == "__main__":
    print("=" * 70)
    print("BEDROCK RAG INTEGRATION - CODE EXAMPLES")
    print("=" * 70)
    
    print("\n\n## STATE UPDATE CODE")
    print("-" * 70)
    print(STATE_UPDATE_CODE)
    
    print("\n\n## UPDATED BUILD SYSTEM PROMPT")
    print("-" * 70)
    print(UPDATED_BUILD_SYSTEM_PROMPT[:500] + "...[truncated]")
    
    print("\n\n## UPDATED AGENT NODE")
    print("-" * 70)
    print(UPDATED_AGENT_NODE[:500] + "...[truncated]")
    
    print("\n\n## UPDATED GRAPH SETUP")
    print("-" * 70)
    print(UPDATED_GRAPH_SETUP[:500] + "...[truncated]")
    
    print("\n\n## QUICK START")
    print("-" * 70)
    print(QUICK_START)
    
    print("\n" + "=" * 70)
    print("For complete code, see this file source code")
    print("=" * 70)
