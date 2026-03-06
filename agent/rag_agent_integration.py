"""
RAG Integration with Agent Pipeline

Integrates Bedrock Knowledge Base retrieval into the LangGraph agent.
Adds fish_knowledge_search tool and context injection.
"""

import logging
from typing import Dict, Any, Optional
import json
import os
from dotenv import load_dotenv

from rag_retriever import BedrockRAGRetriever, RAGQueryBuilder, RAGLogger, get_retriever

load_dotenv()

logger = logging.getLogger(__name__)

# Global retriever instance
_retriever_instance = None


def initialize_retriever(kb_id: Optional[str] = None) -> BedrockRAGRetriever:
    """Initialize and cache RAG retriever"""
    global _retriever_instance
    
    if _retriever_instance is None:
        _retriever_instance = get_retriever(kb_id)
        logger.info("✓ RAG Retriever initialized globally")
    
    return _retriever_instance


def fish_knowledge_search(query: str, top_k: int = 3) -> Dict[str, Any]:
    """
    Agent tool: Search fish knowledge from Bedrock Knowledge Base
    
    This is a tool that the agent can call to retrieve relevant fish knowledge
    before answering user questions.
    
    Args:
        query: Search query
        top_k: Number of documents to retrieve
        
    Returns:
        Dictionary with retrieved documents and context
    """
    logger.info(f"🔍 Fish Knowledge Search Tool - Query: '{query}'")
    
    try:
        retriever = initialize_retriever()
        result = retriever.retrieve(query, top_k=top_k)
        
        if result.get("error"):
            logger.error(f"Retrieval error: {result['error']}")
            return {
                "success": False,
                "error": result["error"],
                "documents": []
            }
        
        # Log retrieval
        context_length = sum(len(d["content"]) for d in result["documents"])
        RAGLogger.log_retrieval(
            query=query,
            num_results=len(result["documents"]),
            context_length=context_length
        )
        
        return {
            "success": True,
            "query": query,
            "num_documents": len(result["documents"]),
            "documents": result["documents"],
            "context": retriever.get_context_string(query, top_k)
        }
        
    except Exception as e:
        logger.error(f"Fish knowledge search error: {e}")
        return {
            "success": False,
            "error": str(e),
            "documents": []
        }


def retrieve_rag_context(
    state: Dict[str, Any],
    force_query: Optional[str] = None,
    top_k: int = 3
) -> Dict[str, Any]:
    """
    LangGraph node function: Retrieve RAG context before LLM call
    
    This function:
    1. Determines what to search for
    2. Retrieves relevant documents
    3. Injects context into agent state
    
    Args:
        state: Agent state (contains human_input, detected_species, etc.)
        force_query: Override query (for testing)
        top_k: Number of documents to retrieve
        
    Returns:
        Updated state dict with rag_context field
    """
    logger.info("Retrieving RAG context...")
    
    try:
        # Determine search query
        if force_query:
            query = force_query
            query_type = "forced"
        elif "detected_species" in state and state.get("detected_species"):
            # If fish classification model detected a species
            species = state["detected_species"]
            query = RAGQueryBuilder.build_fish_query(species)
            query_type = "species"
            logger.info(f"Species detected: {species}")
        else:
            # Use user question
            user_query = state.get("human_input", "")
            query = RAGQueryBuilder.build_general_query(user_query)
            query_type = "general"
        
        logger.info(f"Query type: {query_type}, Query: '{query}'")
        
        # Retrieve documents
        retriever = initialize_retriever()
        result = retriever.retrieve(query, top_k=top_k)
        
        if result.get("error"):
            logger.warning(f"Retrieval error (continuing without context): {result['error']}")
            rag_context = "Knowledge base retrieval unavailable. Proceeding with general knowledge."
            documents_retrieved = 0
        else:
            rag_context = retriever.get_context_string(query, top_k)
            documents_retrieved = len(result["documents"])
        
        # Log context injection
        RAGLogger.log_context_injection(
            query_type=query_type,
            num_docs=documents_retrieved,
            context_chars=len(rag_context)
        )
        
        # Return updated state
        return {
            "rag_context": rag_context,
            "rag_query": query,
            "rag_documents_count": documents_retrieved,
            "rag_query_type": query_type
        }
        
    except Exception as e:
        logger.error(f"Error retrieving RAG context: {e}")
        # Graceful degradation - continue without context
        return {
            "rag_context": "Knowledge base unavailable.",
            "rag_query": "",
            "rag_documents_count": 0,
            "rag_error": str(e)
        }


def inject_rag_context_into_prompt(system_prompt: str, rag_context: str) -> str:
    """
    Inject retrieved RAG context into system prompt
    
    Args:
        system_prompt: Original system prompt
        rag_context: Retrieved context from knowledge base
        
    Returns:
        Enhanced system prompt with context
    """
    if not rag_context or "unavailable" in rag_context.lower():
        return system_prompt
    
    injection = f"""
## Knowledge Base Context

The following information has been retrieved from the fish knowledge base to help answer your question:

{rag_context}

**Instructions**: Use the above context to provide accurate, detailed answers about fish species, breeding seasons, 
fishing regulations, market information, and government schemes. Always cite the source where relevant.
If the information contradicts your general knowledge, prioritize the specific knowledge base information.

---

"""
    
    # Insert after the core identity section
    return system_prompt.replace(
        "**Language rules**:",
        f"{injection}**Language rules**:"
    )


def build_agent_with_rag() -> Dict[str, Any]:
    """
    Example: Configuration for adding RAG to LangGraph agent
    
    Returns:
        Configuration dict for agent graph modification
    """
    return {
        "new_node": {
            "name": "retrieve_rag",
            "function": retrieve_rag_context,
            "description": "Retrieve fish knowledge from Bedrock KB before LLM call"
        },
        "edges": [
            {
                "from": "load_context",
                "to": "retrieve_rag",
                "description": "After loading basic context, retrieve RAG docs"
            },
            {
                "from": "retrieve_rag",
                "to": "agent",
                "description": "Then call agent with RAG context available"
            }
        ],
        "modified_node": {
            "name": "agent",
            "changes": [
                "Use state['rag_context'] when building system prompt",
                "Call inject_rag_context_into_prompt() on the system prompt"
            ]
        }
    }


class RAGToolDefinition:
    """Define fish_knowledge_search as a tool for the LLM"""
    
    SCHEMA = {
        "name": "fish_knowledge_search",
        "description": (
            "Search the fish knowledge base for information about fish species, "
            "aquaculture, fishing regulations, government schemes, and market information. "
            "Useful when you need specific facts about a fish species or fishing topic."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": (
                        "The search query. Examples: 'Rohu fish habitat', "
                        "'monsoon fishing regulations', 'government fisherman subsidies'"
                    )
                },
                "top_k": {
                    "type": "integer",
                    "description": "Number of documents to retrieve (1-5)",
                    "default": 3
                }
            },
            "required": ["query"]
        }
    }


# Integration with langchain tools
def create_rag_tool():
    """Create a LangChain tool for fish_knowledge_search"""
    from langchain_core.tools import tool
    
    @tool
    def fish_knowledge_search_tool(
        query: str,
        top_k: int = 3
    ) -> str:
        """
        Search fish knowledge base
        
        Args:
            query: Search query about fish or fishing
            top_k: Number of results to retrieve
        
        Returns:
            Formatted knowledge base results
        """
        result = fish_knowledge_search(query, top_k)
        
        if not result.get("success"):
            return f"Error retrieving knowledge: {result.get('error', 'Unknown error')}"
        
        return result["context"]
    
    return fish_knowledge_search_tool


if __name__ == "__main__":
    import sys
    
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    # Load KB ID
    try:
        with open("kb_config.json", "r") as f:
            config = json.load(f)
            kb_id = config["knowledge_base_id"]
    except:
        kb_id = os.getenv("BEDROCK_KB_ID")
    
    if not kb_id:
        print("❌ Knowledge Base ID not found. Run bedrock_setup.py first.")
        sys.exit(1)
    
    print("Testing RAG Integration\n")
    print("=" * 60)
    
    # Initialize retriever
    retriever = initialize_retriever(kb_id)
    
    # Test 1: Direct retrieval
    print("\n[Test 1] Direct Retrieval")
    print("-" * 60)
    test_query = "Rohu fish aquaculture market price"
    result = retriever.retrieve(test_query, top_k=2)
    print(f"Query: {test_query}")
    print(f"Documents found: {result['num_results']}")
    
    # Test 2: Fish knowledge search tool
    print("\n[Test 2] Fish Knowledge Search Tool")
    print("-" * 60)
    tool_result = fish_knowledge_search("breeding season regulations", top_k=2)
    print(f"Query: breeding season regulations")
    print(f"Success: {tool_result['success']}")
    print(f"Documents: {tool_result['num_documents']}")
    
    # Test 3: Agent context retrieval
    print("\n[Test 3] Agent Context Retrieval")
    print("-" * 60)
    test_state = {
        "human_input": "How many rohu can I catch?",
        "detected_species": "Rohu"
    }
    context_result = retrieve_rag_context(test_state)
    print(f"Context retrieved: {context_result['rag_documents_count']} documents")
    print(f"Query type: {context_result['rag_query_type']}")
    
    # Test 4: Prompt injection
    print("\n[Test 4] Prompt Context Injection")
    print("-" * 60)
    sample_prompt = "You are a fishing assistant. **Language rules**: Respond clearly."
    sample_context = "Rohu is a freshwater fish native to India..."
    enhanced = inject_rag_context_into_prompt(sample_prompt, sample_context)
    print(f"Prompt length before: {len(sample_prompt)} chars")
    print(f"Prompt length after: {len(enhanced)} chars")
    print(f"Context injected: {'Yes' if len(enhanced) > len(sample_prompt) else 'No'}")
    
    print("\n" + "=" * 60)
    print("✅ RAG Integration tests completed successfully!")
