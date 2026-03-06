"""
RAG Data Loader - Integration module for OceanAI Agent
Loads the comprehensive RAG database from S3 and provides query functionality
"""
import json
import os
import boto3
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', 'backend', '.env'))


class RAGDatabase:
    """Handler for comprehensive RAG database from S3"""
    
    def __init__(self, bucket_name: str = None, region: str = "ap-south-1"):
        """
        Initialize RAG Database loader
        
        Args:
            bucket_name: S3 bucket name (uses env if not provided)
            region: AWS region
        """
        self.bucket_name = bucket_name or os.getenv("S3_BUCKET_NAME")
        self.region = region
        self.s3_client = boto3.client("s3", region_name=region)
        self.database = None
        self.documents = []
        
    def load_from_s3(self) -> bool:
        """Load RAG database from S3"""
        try:
            response = self.s3_client.get_object(
                Bucket=self.bucket_name,
                Key="rag/rag_database_comprehensive.json"
            )
            content = response['Body'].read().decode('utf-8')
            self.database = json.loads(content)
            self.documents = self.database.get('documents', [])
            print(f"✅ Loaded {len(self.documents)} documents from S3")
            return True
        except Exception as e:
            print(f"❌ Error loading from S3: {e}")
            return False
    
    def load_from_file(self, filepath: str) -> bool:
        """Load RAG database from local file"""
        try:
            with open(filepath, 'r') as f:
                self.database = json.load(f)
                self.documents = self.database.get('documents', [])
                print(f"✅ Loaded {len(self.documents)} documents from file")
                return True
        except Exception as e:
            print(f"❌ Error loading from file: {e}")
            return False
    
    def search_by_category(self, category: str) -> List[Dict[str, Any]]:
        """Search documents by category"""
        results = [doc for doc in self.documents if doc.get('category') == category]
        return results
    
    def search_by_keyword(self, keyword: str) -> List[Dict[str, Any]]:
        """Search documents by keyword"""
        keyword_lower = keyword.lower()
        results = []
        
        for doc in self.documents:
            keywords = doc.get('keywords', [])
            if any(keyword_lower in kw.lower() for kw in keywords):
                results.append(doc)
            elif keyword_lower in doc.get('title', '').lower():
                results.append(doc)
        
        return results
    
    def search_by_content(self, query: str) -> List[Dict[str, Any]]:
        """Search documents by content text"""
        query_lower = query.lower()
        results = []
        
        for doc in self.documents:
            if query_lower in doc.get('content', '').lower():
                results.append(doc)
        
        return results
    
    def get_fish_species_info(self, species_name: str) -> Dict[str, Any]:
        """Get detailed information about a fish species"""
        for doc in self.documents:
            if doc.get('category') == 'fish_species':
                if species_name.lower() in doc.get('title', '').lower():
                    return doc
        return None
    
    def get_applicable_policies(self) -> List[Dict[str, Any]]:
        """Get all applicable fisherman policies"""
        return self.search_by_category('fisherman_policy')
    
    def get_fishing_regulations(self) -> List[Dict[str, Any]]:
        """Get fishing regulations and restrictions"""
        return self.search_by_category('regulations')
    
    def get_best_practices(self) -> List[Dict[str, Any]]:
        """Get sustainable fishing best practices"""
        return self.search_by_category('best_practices')
    
    def get_insurance_info(self) -> List[Dict[str, Any]]:
        """Get insurance and social security information"""
        results = []
        for doc in self.documents:
            if 'insurance' in doc.get('content', '').lower() or \
               'insurance' in doc.get('title', '').lower():
                results.append(doc)
        return results
    
    def summarize_database(self) -> Dict[str, Any]:
        """Get database summary statistics"""
        if not self.database:
            return {}
        
        categories = {}
        for doc in self.documents:
            cat = doc.get('category')
            categories[cat] = categories.get(cat, 0) + 1
        
        return {
            "total_documents": len(self.documents),
            "version": self.database.get('version'),
            "categories": categories,
            "coverage_areas": self.database.get('metadata', {}).get('coverage_areas', []),
            "target_users": self.database.get('metadata', {}).get('target_users', [])
        }
    
    def get_context_for_llm(self, query: str, max_docs: int = 3) -> str:
        """
        Get relevant context from RAG database for LLM prompt
        
        Args:
            query: User query
            max_docs: Maximum documents to return
            
        Returns:
            Formatted context string for LLM
        """
        # Search by keyword first
        results = self.search_by_keyword(query)
        
        # If no results, search by content
        if not results:
            results = self.search_by_content(query)
        
        # Limit results
        results = results[:max_docs]
        
        # Format context
        context = "=== RAG Data Context ===\n\n"
        for doc in results:
            context += f"📋 {doc.get('title')}\n"
            context += f"Category: {doc.get('category')}\n"
            context += f"Content:\n{doc.get('content')[:500]}...\n\n"
        
        return context if results else "No relevant RAG data found"


# Integration with LangGraph agent
def integrate_rag_with_agent(agent_state: Dict) -> Dict:
    """
    Example integration function for LangGraph agent
    
    Usage in agent graph:
        result = integrate_rag_with_agent(state)
        state.update(result)
    """
    rag_db = RAGDatabase()
    
    # Try S3 first, fallback to local file
    if not rag_db.load_from_s3():
        local_path = os.path.join(os.path.dirname(__file__), "rag_database_comprehensive.json")
        rag_db.load_from_file(local_path)
    
    # Extract user query from state
    user_query = agent_state.get("human_input", "")
    
    # Get relevant context
    rag_context = rag_db.get_context_for_llm(user_query, max_docs=3)
    
    return {
        "rag_context": rag_context,
        "rag_documents": rag_db.search_by_keyword(user_query)
    }


if __name__ == "__main__":
    # Example usage
    print("🎣 RAG Database Loader - OceanAI Agent")
    print("=" * 50)
    
    rag = RAGDatabase()
    
    # Try loading from S3
    print("\nAttempting to load from S3...")
    if rag.load_from_s3():
        print("✅ Successfully loaded from S3")
    else:
        print("⚠️  S3 load failed, trying local file...")
        local_path = "rag_database_comprehensive.json"
        if rag.load_from_file(local_path):
            print("✅ Successfully loaded from local file")
        else:
            print("❌ Failed to load database")
            exit(1)
    
    # Display summary
    summary = rag.summarize_database()
    print("\n" + "=" * 50)
    print("📊 Database Summary:")
    print(f"  Total documents: {summary.get('total_documents')}")
    print(f"  Version: {summary.get('version')}")
    print("\n📁 Categories:")
    for cat, count in summary.get('categories', {}).items():
        print(f"  - {cat}: {count} documents")
    
    # Example queries
    print("\n" + "=" * 50)
    print("🔍 Example Queries:")
    
    print("\n1. Fish Species Info:")
    rohu_info = rag.get_fish_species_info("Rohu")
    if rohu_info:
        print(f"  Found: {rohu_info.get('title')}")
    
    print("\n2. Search for policies:")
    policies = rag.get_applicable_policies()
    print(f"  Found {len(policies)} policy documents")
    
    print("\n3. Regulations:")
    regulations = rag.get_fishing_regulations()
    print(f"  Found {len(regulations)} regulation documents")
    
    print("\n4. Insurance Info:")
    insurance = rag.get_insurance_info()
    print(f"  Found {len(insurance)} insurance-related documents")
    
    print("\n5. Best Practices:")
    practices = rag.get_best_practices()
    print(f"  Found {len(practices)} best practice documents")
    
    print("\n✅ RAG Database ready for integration with agent pipeline")
