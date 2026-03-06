"""
RAG Retriever Module - Semantic retrieval from Bedrock Knowledge Base

Handles all retrieval operations using Bedrock Agent Runtime API.
Works with the knowledge base created by bedrock_setup.py
"""

import json
import logging
from typing import List, Dict, Any, Optional
import boto3
from dotenv import load_dotenv
import os

load_dotenv()

logger = logging.getLogger(__name__)


class BedrockRAGRetriever:
    """Bedrock-based retrieval system for fish knowledge"""
    
    def __init__(
        self,
        knowledge_base_id: str,
        region: str = "ap-south-1",
        retrieve_top_k: int = 3
    ):
        """
        Initialize Bedrock RAG retriever
        
        Args:
            knowledge_base_id: Bedrock Knowledge Base ID
            region: AWS region
            retrieve_top_k: Number of documents to retrieve
        """
        self.knowledge_base_id = knowledge_base_id
        self.region = region
        self.retrieve_top_k = retrieve_top_k
        
        self.bedrock_runtime = boto3.client(
            "bedrock-agent-runtime",
            region_name=region
        )
        
        logger.info(f"✓ RAG Retriever initialized with KB: {knowledge_base_id}")
    
    def retrieve(self, query: str, top_k: Optional[int] = None) -> Dict[str, Any]:
        """
        Retrieve relevant documents from knowledge base
        
        Args:
            query: Search query
            top_k: Override number of results to retrieve
            
        Returns:
            Dictionary with retrieved documents and metadata
        """
        k = top_k or self.retrieve_top_k
        
        logger.info(f"Retrieving documents for query: '{query}'")
        logger.info(f"Number of results requested: {k}")
        
        try:
            response = self.bedrock_runtime.retrieve(
                knowledgeBaseId=self.knowledge_base_id,
                retrievalQuery={
                    "text": query
                },
                retrievalConfiguration={
                    "vectorSearchConfiguration": {
                        "numberOfResults": k,
                        "overrideSearchType": "SEMANTIC"
                    }
                }
            )
            
            retrieved_docs = response.get("retrievalResults", [])
            
            result = {
                "query": query,
                "num_results": len(retrieved_docs),
                "documents": self._parse_documents(retrieved_docs),
                "raw_response": retrieved_docs
            }
            
            logger.info(f"✓ Retrieved {len(retrieved_docs)} documents")
            
            return result
            
        except Exception as e:
            logger.error(f"✗ Retrieval failed: {e}")
            return {
                "query": query,
                "num_results": 0,
                "documents": [],
                "error": str(e),
                "raw_response": None
            }
    
    def _parse_documents(self, raw_docs: List[Dict]) -> List[Dict[str, Any]]:
        """
        Parse raw Bedrock response into clean document format
        
        Args:
            raw_docs: Raw documents from retrieve() API
            
        Returns:
            Parsed documents with extracted content and metadata
        """
        parsed = []
        
        for i, doc in enumerate(raw_docs):
            try:
                content = doc.get("content", {})
                text = content.get("text", "")
                
                parsed_doc = {
                    "rank": i + 1,
                    "content": text,
                    "source": doc.get("location", {}).get("s3Location", {}).get("uri", "unknown"),
                    "score": doc.get("score", 0.0),
                    "metadata": doc.get("metadata", {})
                }
                
                parsed.append(parsed_doc)
                
            except Exception as e:
                logger.warning(f"Error parsing document {i}: {e}")
                continue
        
        return parsed
    
    def get_context_string(self, query: str, top_k: Optional[int] = None) -> str:
        """
        Retrieve documents and format as context string for LLM injection
        
        Args:
            query: Search query
            top_k: Override number of results
            
        Returns:
            Formatted context string
        """
        result = self.retrieve(query, top_k)
        
        if result.get("error"):
            logger.warning(f"Retrieval error: {result['error']}")
            return "Knowledge base retrieval unavailable."
        
        if not result.get("documents"):
            logger.info("No documents retrieved")
            return "No relevant information found in knowledge base."
        
        # Format documents as context
        context_lines = []
        context_lines.append("=== Knowledge Base Context ===\n")
        
        for doc in result["documents"]:
            context_lines.append(f"[Source {doc['rank']}] - {doc['source']}")
            context_lines.append(f"Relevance: {doc['score']:.2%}\n")
            
            # Truncate content to ~500 chars per document
            content = doc["content"]
            if len(content) > 500:
                content = content[:500] + "..."
            
            context_lines.append(content)
            context_lines.append("\n" + "-" * 50 + "\n")
        
        context_string = "".join(context_lines)
        
        logger.info(f"Formatted context ({len(context_string)} chars)")
        
        return context_string
    
    def get_json_context(self, query: str, top_k: Optional[int] = None) -> List[Dict]:
        """
        Get retrieved documents as structured JSON
        
        Args:
            query: Search query
            top_k: Override number of results
            
        Returns:
            List of document dictionaries
        """
        result = self.retrieve(query, top_k)
        return result.get("documents", [])


class RAGQueryBuilder:
    """Utility class to build optimized retrieval queries"""
    
    @staticmethod
    def build_fish_query(fish_species: str) -> str:
        """
        Build optimized query for fish species information
        
        Args:
            fish_species: Fish species name or common name
            
        Returns:
            Optimized search query
        """
        query = f"{fish_species} fish habitat diet breeding season aquaculture market prices fishing"
        return query
    
    @staticmethod
    def build_policy_query(policy_type: str) -> str:
        """
        Build query for fisherman policies and regulations
        
        Args:
            policy_type: Type of policy (breeding season, insurance, subsidies, etc.)
            
        Returns:
            Optimized search query
        """
        query = f"fisherman policy {policy_type} regulations government schemes subsidies"
        return query
    
    @staticmethod
    def build_general_query(user_question: str) -> str:
        """
        Clean and optimize general user question for retrieval
        
        Args:
            user_question: Raw user question
            
        Returns:
            Optimized search query
        """
        # Remove common words and focus on key terms
        stop_words = {'what', 'how', 'when', 'where', 'why', 'is', 'are', 'the', 'a', 'an', 'to'}
        words = user_question.lower().split()
        important_words = [w for w in words if w not in stop_words and len(w) > 2]
        
        query = " ".join(important_words[:10])  # Limit to top 10 words
        return query if query else user_question


class RAGLogger:
    """Structured logging for RAG operations"""
    
    @staticmethod
    def log_retrieval(
        query: str,
        num_results: int,
        context_length: int,
        error: Optional[str] = None
    ):
        """Log retrieval operation"""
        log_data = {
            "event": "rag_retrieval",
            "query": query,
            "num_results": num_results,
            "context_length": context_length
        }
        
        if error:
            log_data["error"] = error
            logger.warning(f"RAG Retrieval Issue: {json.dumps(log_data)}")
        else:
            logger.info(f"RAG Retrieval Success: {json.dumps(log_data)}")
    
    @staticmethod
    def log_context_injection(
        query_type: str,
        num_docs: int,
        context_chars: int
    ):
        """Log context injection into prompt"""
        log_data = {
            "event": "context_injection",
            "query_type": query_type,
            "docs_injected": num_docs,
            "context_chars": context_chars
        }
        logger.info(f"Context Injected: {json.dumps(log_data)}")


def get_retriever(kb_id: Optional[str] = None) -> BedrockRAGRetriever:
    """
    Factory function to get RAG retriever instance
    
    Args:
        kb_id: Knowledge Base ID (uses env var if not provided)
        
    Returns:
        Configured BedrockRAGRetriever instance
    """
    if not kb_id:
        kb_id = os.getenv("BEDROCK_KB_ID")
        if not kb_id:
            raise ValueError(
                "BEDROCK_KB_ID not provided and not found in environment. "
                "Run bedrock_setup.py first or set BEDROCK_KB_ID in .env"
            )
    
    return BedrockRAGRetriever(
        knowledge_base_id=kb_id,
        region=os.getenv("AWS_REGION", "ap-south-1"),
        retrieve_top_k=int(os.getenv("RETRIEVE_TOP_K", "3"))
    )


if __name__ == "__main__":
    # Example usage
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    
    # Load KB ID from environment or config file
    try:
        with open("kb_config.json", "r") as f:
            config = json.load(f)
            kb_id = config["knowledge_base_id"]
    except:
        kb_id = os.getenv("BEDROCK_KB_ID")
    
    if not kb_id:
        print("❌ No knowledge base ID found. Run bedrock_setup.py first.")
        exit(1)
    
    # Initialize retriever
    print(f"Initializing retriever with KB: {kb_id}\n")
    retriever = BedrockRAGRetriever(knowledge_base_id=kb_id)
    
    # Test queries
    test_queries = [
        "Rohu fish habitat and breeding season",
        "government subsidies for fishermen",
        "fish market prices monsoon season"
    ]
    
    print("=" * 60)
    print("Testing RAG Retrieval")
    print("=" * 60)
    
    for query in test_queries:
        print(f"\nQuery: {query}")
        print("-" * 60)
        
        result = retriever.retrieve(query, top_k=2)
        
        if result.get("error"):
            print(f"❌ Error: {result['error']}")
        else:
            print(f"Found {result['num_results']} documents:\n")
            
            for doc in result["documents"]:
                print(f"[Rank {doc['rank']}] Score: {doc['score']:.2%}")
                print(f"Source: {doc['source']}")
                preview = doc["content"][:200] + "..."
                print(f"Content: {preview}\n")
        
        print("=" * 60)
    
    print("\n✅ RAG Retriever working successfully!")
