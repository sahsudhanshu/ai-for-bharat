"""
Bedrock RAG Integration Guide

This file provides step-by-step instructions to integrate 
Bedrock Knowledge Base RAG into your agent pipeline.
"""

# ═════════════════════════════════════════════════════════════════════════════
# STEP 1: Update AgentState (add to src/core/state.py)
# ═════════════════════════════════════════════════════════════════════════════

"""
Add these fields to the AgentState TypedDict in src/core/state.py:

    # ── RAG Fields ──────────────────────────────────────────────────────────
    rag_context: Optional[str]              # Retrieved knowledge base docs
    rag_query: Optional[str]                # Query used for retrieval
    rag_documents_count: int                # Number of docs retrieved
    rag_query_type: Optional[str]           # Type: 'species', 'general', etc.
    detected_species: Optional[str]         # Fish species detected by classifier
    rag_error: Optional[str]                # Error during retrieval (if any)
"""


# ═════════════════════════════════════════════════════════════════════════════
# STEP 2: Update System Prompt Builder (src/core/prompts.py)
# ═════════════════════════════════════════════════════════════════════════════

"""
Modify build_system_prompt() to accept and inject RAG context:

def build_system_prompt(
    selected_language: str,
    summary: str | None = None,
    long_term_memory: str | None = None,
    region_context: str | None = None,
    catch_context: str | None = None,
    rag_context: str | None = None,  # ADD THIS PARAMETER
) -> str:
    
    # ... existing code ...
    
    # ── RAG Context ──────────────────────────────────────────────────────
    if rag_context:  # ADD THIS SECTION
        sections.append(f\"\"\"## Fish Knowledge Base Context

The following verified information from fish knowledge databases is available:

{rag_context}

Use this context for accurate facts about fish species, seasons, regulations, 
and government schemes. Always cite information sources when applicable.\"\"\")
    
    # ... rest of function ...
"""


# ═════════════════════════════════════════════════════════════════════════════
# STEP 3: Update Agent Graph (src/core/graph.py)
# ═════════════════════════════════════════════════════════════════════════════

"""
Add RAG retrieval node and integrate into graph:

1. Add imports at the top:

    from rag_agent_integration import (
        retrieve_rag_context,
        inject_rag_context_into_prompt,
        create_rag_tool,
        initialize_retriever
    )

2. Initialize retriever after importing:

    # Initialize RAG retriever
    try:
        _retriever = initialize_retriever()
    except Exception as e:
        logger.warning(f"RAG not available: {e}")
        _retriever = None

3. Add fish_knowledge_search to TOOLS list:

    TOOLS = [
        get_weather,
        get_catch_history,
        get_catch_details,
        get_map_data,
        get_market_prices,
        create_rag_tool(),  # ADD THIS
    ]

4. Add RAG Node:

    async def rag_node(state: AgentState) -> Dict[str, Any]:
        # Retrieve context from Bedrock
        rag_result = retrieve_rag_context(state)
        return rag_result

5. Update agent_node to use RAG context:

    async def agent_node(state: AgentState) -> Dict[str, Any]:
        text = state["human_input"]
        lang = state.get("selected_language", "en")
        
        # Get RAG context
        rag_context = state.get("rag_context", "")
        
        # Build system prompt with RAG context
        system_prompt = build_system_prompt(lang, rag_context=rag_context)
        
        # Inject RAG context into prompt
        system_prompt = inject_rag_context_into_prompt(system_prompt, rag_context)
        
        # ... rest of agent_node ...

6. Update graph edges:

    # Old: graph.add_edge("load_context", "agent")
    # New: graph.add_edge("load_context", "rag")
    
    graph.add_node("rag", rag_node)
    graph.add_edge("load_context", "rag")
    graph.add_edge("rag", "agent")
"""


# ═════════════════════════════════════════════════════════════════════════════
# STEP 4: Environment Configuration
# ═════════════════════════════════════════════════════════════════════════════

"""
Add these to your backend/.env file:

    # Bedrock Knowledge Base Configuration
    BEDROCK_KB_ID=<knowledge_base_id_from_bedrock_setup>
    AWS_REGION=ap-south-1
    RETRIEVE_TOP_K=3
    
    # These are set automatically by bedrock_setup.py output
    
Or run: cat kb_config.json to get the values
"""


# ═════════════════════════════════════════════════════════════════════════════
# STEP 5: Complete Graph Setup Example
# ═════════════════════════════════════════════════════════════════════════════

"""
Here's what your complete graph should look like:

from langgraph.graph import StateGraph, END
from src.core.state import AgentState
from src.core.prompts import build_system_prompt

# ... imports ...

async def language_guard(state: AgentState) -> Dict[str, Any]:
    # Existing implementation
    pass

async def load_context(state: AgentState) -> Dict[str, Any]:
    # Existing implementation
    pass

async def rag_node(state: AgentState) -> Dict[str, Any]:
    \"\"\"NEW NODE: Retrieve RAG context\"\"\"
    rag_result = retrieve_rag_context(state)
    return rag_result

async def agent_node(state: AgentState) -> Dict[str, Any]:
    \"\"\"MODIFIED: Inject RAG context into prompt\"\"\"
    text = state["human_input"]
    lang = state.get("selected_language", "en")
    
    # Get RAG context if available
    rag_context = state.get("rag_context", "")
    
    # Build system prompt
    system_prompt = build_system_prompt(
        lang,
        summary=state.get("summary"),
        long_term_memory=state.get("long_term_memory"),
        region_context=state.get("region_context"),
        catch_context=state.get("catch_context"),
        rag_context=rag_context  # NEW PARAMETER
    )
    
    # Inject RAG context
    system_prompt = inject_rag_context_into_prompt(system_prompt, rag_context)
    
    # ... rest of agent logic ...

async def tool_executor(state: AgentState) -> Dict[str, Any]:
    # Existing implementation
    pass

async def memory_update(state: AgentState) -> Dict[str, Any]:
    # Existing implementation
    pass

# Build graph
def create_graph():
    graph = StateGraph(AgentState)
    
    # Add nodes
    graph.add_node("language_guard", language_guard)
    graph.add_node("load_context",  load_context)
    graph.add_node("rag", rag_node)  # NEW NODE
    graph.add_node("agent", agent_node)
    graph.add_node("tool_executor", tool_executor)
    graph.add_node("memory_update", memory_update)
    
    # Set entry point
    graph.set_entry_point("language_guard")
    
    # Add edges
    graph.add_conditional_edges(
        "language_guard",
        lambda x: "reject" if not x.get("language_accepted") else "load_context",
        {"reject": END, "load_context": "load_context"}
    )
    
    graph.add_edge("load_context", "rag")  # NEW EDGE
    graph.add_edge("rag", "agent")
    
    graph.add_conditional_edges(
        "agent",
        lambda x: "tool_executor" if x.get("tool_calls") else "memory_update",
        {"tool_executor": "tool_executor", "memory_update": "memory_update"}
    )
    
    graph.add_edge("tool_executor", "agent")
    graph.add_edge("memory_update", END)
    
    return graph.compile()
"""


# ═════════════════════════════════════════════════════════════════════════════
# STEP 6: Setup Instructions
# ═════════════════════════════════════════════════════════════════════════════

"""
To set up the complete system:

1. Ensure documents are in S3:
   - S3 bucket: fish-detection-project-2026
   - Path: /rag/
   - Files: Text documents with fish knowledge

2. Create Bedrock Resources:
   
   cd agent/
   python bedrock_setup.py
   
   This creates:
   - OpenSearch Serverless collection
   - Bedrock Knowledge Base
   - S3 data source connection
   - Starts document ingestion
   - Saves config to kb_config.json

3. Update .env with KB ID:
   
   cat kb_config.json
   # Copy BEDROCK_KB_ID to backend/.env

4. Test RAG retrieval:
   
   python rag_retriever.py
   
   This tests:
   - Connection to Bedrock
   - Document retrieval
   - Context formatting

5. Test integration:
   
   python rag_agent_integration.py
   
   This tests:
   - Prompt injection
   - Tool creation
   - Agent context retrieval

6. Update your agent code:
   - Modify src/core/state.py (add RAG fields)
   - Modify src/core/prompts.py (accept rag_context param)
   - Modify src/core/graph.py (add RAG node, update agent_node)
   - Add rag_agent_integration imports

7. Test end-to-end:
   
   python test_local.py  # Your existing test should now use RAG
"""


# ═════════════════════════════════════════════════════════════════════════════
# STEP 7: Error Handling & Graceful Degradation
# ═════════════════════════════════════════════════════════════════════════════

"""
The system is designed to gracefully handle failures:

1. If Bedrock is unavailable:
   - retrieve_rag_context() returns empty/error context
   - Agent continues with general knowledge
   - No crash, no interruption

2. If Knowledge Base has no results:
   - Empty context is injected
   - Agent uses general knowledge
   - User still gets response

3. Logging:
   - All retrieval attempts are logged
   - Errors are logged but non-fatal
   - You can monitor RAG performance via logs

4. Example error handling in rag_agent_integration.py:
   
    try:
        result = retriever.retrieve(query, top_k=top_k)
    except Exception as e:
        logger.error(f"Retrieval failed: {e}")
        return {
            "rag_context": "Knowledge base unavailable.",
            "rag_error": str(e)
        }
"""


# ═════════════════════════════════════════════════════════════════════════════
# STEP 8: Monitoring & Logging
# ═════════════════════════════════════════════════════════════════════════════

"""
Monitor RAG performance by checking logs for:

1. Retrieval successful:
   "RAG Retrieval Success: {'query': '...', 'num_results': 3, ...}"

2. Context injected:
   "Context Injected: {'event': 'context_injection', 'docs_injected': 3, ...}"

3. Tool usage:
   "Fish Knowledge Search Tool - Query: '...'"

4. Errors:
   "RAG Retrieval Issue: {'error': '...', ...}"

Example query monitoring:

   import logging
   logging.getLogger("rag_agent_integration").setLevel(logging.INFO)
   
   # Now all RAG operations are logged
"""


# ═════════════════════════════════════════════════════════════════════════════
# TROUBLESHOOTING
# ═════════════════════════════════════════════════════════════════════════════

"""
Common Issues & Solutions:

1. "BEDROCK_KB_ID not found"
   Solution: Run bedrock_setup.py and copy KB ID to .env

2. "AccessDenied to OpenSearch"
   Solution: Check IAM role has aoss:APIAccessAll permission

3. "No documents retrieved"
   Solution: Check if documents are in S3 /rag/ folder
            Check if ingestion job completed

4. "Ingestion job timed out"
   Solution: Increase wait time in bedrock_setup.py
            Check CloudWatch logs for ingestion status

5. "LangChain tool not recognized"
   Solution: Make sure create_rag_tool() is added to TOOLS list
            Check tool schema matches LangChain format

6. "Empty rag_context in prompt"
   Solution: This is normal if no documents matched query
            Agent will use general knowledge
            Check retrieved documents via logging
"""

print(__doc__)
