"""
Bedrock RAG Testing Script
Test the RAG database using Amazon Bedrock semantic search
"""

import json
import os
from pathlib import Path
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class BedrockRAGTester:
    """RAG retrieval tester using Amazon Bedrock"""
    
    def __init__(self, kb_id=None):
        """Initialize Bedrock RAG retriever"""
        try:
            from rag_retriever import BedrockRAGRetriever
            
            # Get KB ID from environment or parameter
            self.kb_id = kb_id or os.getenv('BEDROCK_KB_ID')
            
            if not self.kb_id:
                print("⚠ BEDROCK_KB_ID not set. Checking kb_config.json...")
                if os.path.exists('kb_config.json'):
                    with open('kb_config.json', 'r') as f:
                        config = json.load(f)
                        self.kb_id = config.get('knowledge_base_id')
                        print(f"✓ Found KB ID from config: {self.kb_id}")
                else:
                    raise ValueError("BEDROCK_KB_ID not found. Run bedrock_setup.py first.")
            
            self.retriever = BedrockRAGRetriever(
                knowledge_base_id=self.kb_id,
                region=os.getenv('AWS_REGION', 'ap-south-1'),
                retrieve_top_k=int(os.getenv('RETRIEVE_TOP_K', '3'))
            )
            print(f"✓ Bedrock RAG Retriever initialized")
            print(f"✓ Knowledge Base ID: {self.kb_id}")
            print(f"✓ Region: {os.getenv('AWS_REGION', 'ap-south-1')}")
            
        except ImportError:
            print("✗ rag_retriever module not found")
            raise
        except Exception as e:
            print(f"✗ Error initializing Bedrock retriever: {e}")
            raise
    
    def search(self, query, top_k=3):
        """Search using Bedrock semantic search"""
        try:
            print(f"\n🔍 Searching: '{query}'")
            results = self.retriever.retrieve(query, top_k=top_k)
            
            if not results:
                print("✗ No documents found")
                return []
            
            formatted_results = []
            for i, doc in enumerate(results, 1):
                formatted_results.append({
                    'rank': doc.get('rank'),
                    'content': doc.get('content', ''),
                    'source': doc.get('source', 'Unknown'),
                    'score': doc.get('score', 0),
                    'metadata': doc.get('metadata', {})
                })
            
            return formatted_results
        
        except Exception as e:
            print(f"✗ Search error: {e}")
            return []


def main():
    """Run interactive Bedrock RAG tester"""
    print("\n" + "="*80)
    print("Bedrock RAG Semantic Search Tester")
    print("="*80 + "\n")
    
    try:
        # Initialize
        tester = BedrockRAGTester()
        
        # Interactive menu
        while True:
            print("\nOptions:")
            print("1. Search fish species")
            print("2. Search policies")
            print("3. Search regulations & best practices")
            print("4. Custom semantic search")
            print("5. Exit")
            
            choice = input("\nEnter choice (1-5): ").strip()
            
            if choice == '1':
                query = input("Enter fish species/query: ").strip()
                top_k = input("Number of results (1-10, default 3): ").strip() or "3"
                results = tester.search(query, top_k=int(top_k))
                print_bedrock_results(results)
            
            elif choice == '2':
                query = input("Enter policy keyword: ").strip()
                top_k = input("Number of results (1-10, default 3): ").strip() or "3"
                results = tester.search(query, top_k=int(top_k))
                print_bedrock_results(results)
            
            elif choice == '3':
                query = input("Enter regulation/practice keyword: ").strip()
                top_k = input("Number of results (1-10, default 3): ").strip() or "3"
                results = tester.search(query, top_k=int(top_k))
                print_bedrock_results(results)
            
            elif choice == '4':
                query = input("Enter semantic search query: ").strip()
                top_k = input("Number of results (1-10, default 5): ").strip() or "5"
                results = tester.search(query, top_k=int(top_k))
                print_bedrock_results(results)
            
            elif choice == '5':
                print("\nThank you for testing Bedrock RAG!")
                break
            
            else:
                print("Invalid choice. Try again.")
    
    except Exception as e:
        print(f"\n✗ Error: {e}")
        print("\nMake sure:")
        print("1. Run 'python bedrock_setup.py' first to create Bedrock KB")
        print("2. Set BEDROCK_KB_ID environment variable or have kb_config.json")
        print("3. AWS credentials are configured")


def print_bedrock_results(results):
    """Pretty print Bedrock search results"""
    if not results:
        print("\n✗ No documents found")
        return
    
    print(f"\n✓ Found {len(results)} results:\n")
    for i, result in enumerate(results, 1):
        print(f"{i}. Score: {result['score']:.2f} | Source: {result['source']}")
        print(f"   Content: {result['content'][:300]}...")
        if result.get('metadata'):
            print(f"   Metadata: {json.dumps(result['metadata'], indent=6)}")
        print()


def test_quick():
    """Quick test without interactive menu"""
    print("\n" + "="*80)
    print("Quick Bedrock RAG Test")
    print("="*80 + "\n")
    
    try:
        tester = BedrockRAGTester()
        
        # Test searches with semantic understanding
        print("\n[Test 1] Searching for 'Rohu fish breeding':")
        results = tester.search('Rohu fish breeding', top_k=2)
        print_bedrock_results(results)
        
        print("\n[Test 2] Searching for 'monsoon fishing regulations':")
        results = tester.search('monsoon fishing regulations', top_k=2)
        print_bedrock_results(results)
        
        print("\n[Test 3] Searching for 'government credit schemes for fishermen':")
        results = tester.search('government credit schemes for fishermen', top_k=2)
        print_bedrock_results(results)
        
        print("\n[Test 4] Searching for 'fish disease management':")
        results = tester.search('fish disease management', top_k=2)
        print_bedrock_results(results)
        
        print("\n✓ Quick test complete!")
    
    except Exception as e:
        print(f"✗ Error: {e}")


def test_all_species():
    """Test retrieval for multiple species"""
    print("\n" + "="*80)
    print("Testing Fish Species Retrieval")
    print("="*80 + "\n")
    
    try:
        tester = BedrockRAGTester()
        
        species_queries = [
            "Rohu",
            "Catla",
            "Hilsa",
            "Mrigal",
            "Tilapia"
        ]
        
        for species in species_queries:
            print(f"\n{'─'*60}")
            results = tester.search(species, top_k=1)
            print_bedrock_results(results)
    
    except Exception as e:
        print(f"✗ Error: {e}")


if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        if sys.argv[1] == 'quick':
            test_quick()
        elif sys.argv[1] == 'species':
            test_all_species()
        else:
            print("Usage: python test_rag_simple.py [quick|species]")
            print("       python test_rag_simple.py (for interactive)")
    else:
        main()
