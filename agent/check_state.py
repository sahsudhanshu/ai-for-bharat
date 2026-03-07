import boto3, json, time

region = 'ap-south-1'
ba = boto3.client('bedrock-agent', region_name=region)

# Check existing KBs
print("=== Existing Knowledge Bases ===")
kbs = ba.list_knowledge_bases()['knowledgeBaseSummaries']
for kb in kbs:
    print(f"  {kb['knowledgeBaseId']} - {kb['name']} - {kb['status']}")

# Check existing collections
aoss = boto3.client('opensearchserverless', region_name=region)
colls = aoss.list_collections()['collectionSummaries']
print("\n=== Existing Collections ===")
for c in colls:
    print(f"  {c['id']} - {c['name']} - {c['status']}")

# Test embedding model
print("\n=== Testing Titan v2 Embedding ===")
br = boto3.client('bedrock-runtime', region_name=region)
try:
    body = json.dumps({"inputText": "test"})
    resp = br.invoke_model(modelId='amazon.titan-embed-text-v2:0', body=body,
                           contentType='application/json', accept='application/json')
    result = json.loads(resp['body'].read())
    print(f"  Titan v2 works! Dimension: {len(result['embedding'])}")
except Exception as e:
    print(f"  Titan v2 error: {e}")

try:
    body = json.dumps({"texts": ["test"], "input_type": "search_document"})
    resp = br.invoke_model(modelId='cohere.embed-english-v3', body=body,
                           contentType='application/json', accept='application/json')
    result = json.loads(resp['body'].read())
    print(f"  Cohere v3 works! Dimension: {len(result['embeddings'][0])}")
except Exception as e:
    print(f"  Cohere v3 error: {e}")
