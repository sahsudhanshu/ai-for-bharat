"""
RAG Integration Example for OceanAI Agent Graph
Shows how to integrate the RAG database retrieval into your LangGraph pipeline
"""
from typing import Dict, Any
from src.core.state import AgentState
from rag_loader import RAGDatabase


class RAGRetriever:
    """RAG retriever for agent context enhancement"""
    
    def __init__(self):
        self.rag_db = RAGDatabase()
        self._load_database()
    
    def _load_database(self):
        """Load RAG database from local file"""
        import os
        local_path = os.path.join(os.path.dirname(__file__), "rag_database_comprehensive.json")
        self.rag_db.load_from_file(local_path)
    
    def retrieve_context(self, query: str, max_docs: int = 3) -> str:
        """
        Retrieve relevant RAG context for a query
        
        Args:
            query: User query or search term
            max_docs: Maximum documents to retrieve
        
        Returns:
            Formatted context string for LLM
        """
        return self.rag_db.get_context_for_llm(query, max_docs)
    
    def get_fish_info(self, species_name: str) -> Dict[str, Any]:
        """Get fish species information"""
        return self.rag_db.get_fish_species_info(species_name)
    
    def get_applicable_policies(self) -> list:
        """Get applicable fisherman policies"""
        return self.rag_db.get_applicable_policies()
    
    def get_regulations(self) -> list:
        """Get fishing regulations"""
        return self.rag_db.get_fishing_regulations()


# Global RAG retriever instance
_rag_retriever = None


def get_rag_retriever() -> RAGRetriever:
    """Get or create RAG retriever instance"""
    global _rag_retriever
    if _rag_retriever is None:
        _rag_retriever = RAGRetriever()
    return _rag_retriever


# ═══════════════════════════════════════════════════════════════════════════════
# Integration Functions for LangGraph Agent
# ═══════════════════════════════════════════════════════════════════════════════

async def retrieve_rag_context_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    LangGraph node: Retrieve relevant RAG context before calling LLM
    
    Usage in graph:
        graph.add_node("retrieve_rag", retrieve_rag_context_node)
        graph.add_edge("agent", "retrieve_rag")  # After agent node
    
    Args:
        state: Agent state containing user_input
    
    Returns:
        Updated state with rag_context and rag_documents
    """
    retriever = get_rag_retriever()
    user_query = state.get("human_input", "")
    
    # Retrieve RAG context
    rag_context = retriever.retrieve_context(user_query, max_docs=3)
    
    # Retrieve specific documents if applicable
    rag_documents = []
    if any(term in user_query.lower() for term in ["fish", "rohu", "catla", "hilsa"]):
        species_matches = retriever.rag_db.search_by_keyword(user_query)
        rag_documents = species_matches[:2]
    
    return {
        "rag_context": rag_context,
        "rag_documents": rag_documents,
    }


def enhance_system_prompt_with_rag(base_prompt: str, rag_context: str) -> str:
    """
    Enhance system prompt with RAG context
    
    Args:
        base_prompt: Original system prompt
        rag_context: RAG retrieved context
    
    Returns:
        Enhanced system prompt
    """
    enhanced_prompt = base_prompt + f"""

KNOWLEDGE BASE CONTEXT (From RAG Database):
{rag_context}

When answering questions about fish, fishing practices, policies, or regulations, 
use the knowledge base context above to provide accurate, location-specific information.
Always cite relevant policies and regulations when applicable."""
    
    return enhanced_prompt


# ═══════════════════════════════════════════════════════════════════════════════
# Usage Example in Agent Graph
# ═══════════════════════════════════════════════════════════════════════════════

"""
Example: Integrating RAG into your LangGraph

from langgraph.graph import StateGraph, END

# Assuming you have these existing functions:
# - language_guard_node(state)
# - load_context_node(state) 
# - agent_node(state)
# - etc.

def build_agent_with_rag():
    graph = StateGraph(AgentState)
    
    # Add nodes
    graph.add_node("language_guard", language_guard_node)
    graph.add_node("load_context", load_context_node)
    graph.add_node("retrieve_rag", retrieve_rag_context_node)  # NEW: RAG retrieval
    graph.add_node("agent", agent_node)
    graph.add_node("tool_executor", tool_executor_node)
    graph.add_node("memory_update", memory_update_node)
    
    # Set entry point
    graph.set_entry_point("language_guard")
    
    # Add edges
    graph.add_conditional_edges(
        "language_guard",
        lambda x: "reject" if not x.get("language_accepted") else "load_context",
        {
            "reject": END,
            "load_context": "load_context",
        }
    )
    
    graph.add_edge("load_context", "retrieve_rag")  # NEW: Retrieve RAG context
    graph.add_edge("retrieve_rag", "agent")  # Then call agent with RAG context
    
    # Add conditional routing after agent
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


# Modify your agent_node to use RAG context:

async def agent_node_with_rag(state: AgentState) -> Dict[str, Any]:
    retriever = get_rag_retriever()
    
    # Build enhanced system prompt with RAG
    base_system_prompt = build_system_prompt(state)
    rag_context = state.get("rag_context", "")
    
    system_prompt = enhance_system_prompt_with_rag(base_system_prompt, rag_context)
    
    # Build messages as before
    messages = [
        SystemMessage(content=system_prompt),
        *build_message_history(state),
        HumanMessage(content=state["human_input"]),
    ]
    
    # Call LLM with RAG-enhanced prompt
    llm = _get_llm()
    response = llm.invoke(messages)
    
    return {
        "llm_output": response,
        "tool_calls": getattr(response, "tool_calls", None),
    }
"""


if __name__ == "__main__":
    # Test RAG retriever
    retriever = get_rag_retriever()
    
    print("🎣 RAG Integration Test")
    print("=" * 60)
    
    # Test 1: Retrieve context for a query
    print("\n1. Testing context retrieval for 'Rohu fishing':")
    context = retriever.retrieve_context("Rohu fishing", max_docs=2)
    print(context[:300] + "...")
    
    # Test 2: Get fish info
    print("\n2. Testing fish species info retrieval:")
    rohu = retriever.get_fish_info("Rohu")
    if rohu:
        print(f"   ✓ Found: {rohu['title']}")
    
    # Test 3: Get policies
    print("\n3. Testing policy retrieval:")
    policies = retriever.get_applicable_policies()
    print(f"   ✓ Found {len(policies)} policies")
    for policy in policies[:2]:
        print(f"     - {policy['title']}")
    
    # Test 4: Get regulations
    print("\n4. Testing regulation retrieval:")
    regulations = retriever.get_regulations()
    print(f"   ✓ Found {len(regulations)} regulation documents")
    
    print("\n" + "=" * 60)
    print("✅ RAG Integration ready for production use")
