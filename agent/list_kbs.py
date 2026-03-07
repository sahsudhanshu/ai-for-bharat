import boto3, json, time

region = 'us-east-1'
ba = boto3.client('bedrock-agent', region_name=region)

kbs = ba.list_knowledge_bases()['knowledgeBaseSummaries']
print(f"Found {len(kbs)} Knowledge Bases in us-east-1:")
for kb in kbs:
    det = ba.get_knowledge_base(knowledgeBaseId=kb['knowledgeBaseId'])['knowledgeBase']
    coll = det['storageConfiguration']['opensearchServerlessConfiguration']['collectionArn']
    emb = det['knowledgeBaseConfiguration']['vectorKnowledgeBaseConfiguration']['embeddingModelArn']
    role = det['roleArn']
    print(f"\n  ID: {kb['knowledgeBaseId']}")
    print(f"  Name: {kb['name']}")
    print(f"  Status: {kb['status']}")
    print(f"  Collection: {coll}")
    print(f"  Embedding: {emb}")
    print(f"  Role: {role}")
    dss = ba.list_data_sources(knowledgeBaseId=kb['knowledgeBaseId'])['dataSourceSummaries']
    for ds in dss:
        print(f"  DataSource: {ds['dataSourceId']} - {ds['name']} - {ds['status']}")
