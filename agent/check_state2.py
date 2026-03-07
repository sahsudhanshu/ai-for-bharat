import boto3, json, time
from botocore.config import Config

region = 'ap-south-1'

# Single attempt with no auto-retry to avoid amplifying throttle
cfg = Config(retries={'max_attempts': 0})
br = boto3.client('bedrock-runtime', region_name=region, config=cfg)

# Try Titan v2 once
print("Testing Titan v2 (single attempt)...")
try:
    body = json.dumps({"inputText": "test embedding"})
    resp = br.invoke_model(modelId='amazon.titan-embed-text-v2:0', body=body,
                           contentType='application/json', accept='application/json')
    result = json.loads(resp['body'].read())
    print(f"SUCCESS! Dimension: {len(result['embedding'])}")
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")

# Check new collection
print("\nChecking new collection details...")
ba = boto3.client('bedrock-agent', region_name=region)
aoss = boto3.client('opensearchserverless', region_name=region)

# Check if there are any other KBs or data sources
colls = aoss.batch_get_collection(ids=['gcnt8vfrm7cyq2qnqct4'])
for c in colls.get('collectionDetails', []):
    print(f"  Collection: {c['name']}, Status: {c['status']}")
    print(f"  Endpoint: {c.get('collectionEndpoint', 'N/A')}")
    print(f"  ARN: {c.get('arn', 'N/A')}")

# Check if any KBs use this new collection
kbs = ba.list_knowledge_bases()['knowledgeBaseSummaries']
for kb in kbs:
    det = ba.get_knowledge_base(knowledgeBaseId=kb['knowledgeBaseId'])['knowledgeBase']
    emb = det['knowledgeBaseConfiguration']['vectorKnowledgeBaseConfiguration']['embeddingModelArn']
    coll = det['storageConfiguration']['opensearchServerlessConfiguration']['collectionArn']
    print(f"\nKB {kb['knowledgeBaseId']} ({kb['status']}):")
    print(f"  Embedding: {emb}")
    print(f"  Collection ARN: {coll}")
