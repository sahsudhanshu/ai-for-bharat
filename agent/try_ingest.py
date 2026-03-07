import boto3, json, time

region = 'ap-south-1'
ba = boto3.client('bedrock-agent', region_name=region)

# Check KB details
kb = ba.get_knowledge_base(knowledgeBaseId='LCXIO4LGDC')
kbdet = kb['knowledgeBase']
print(f"KB: {kbdet['knowledgeBaseId']}")
print(f"Status: {kbdet['status']}")
print(f"Embedding: {kbdet['knowledgeBaseConfiguration']['vectorKnowledgeBaseConfiguration']['embeddingModelArn']}")
storage = kbdet['storageConfiguration']['opensearchServerlessConfiguration']
print(f"Collection: {storage['collectionArn']}")
print(f"Index: {storage['vectorIndexName']}")
print(f"Role: {kbdet['roleArn']}")

# Check data sources
ds_list = ba.list_data_sources(knowledgeBaseId='LCXIO4LGDC')
print(f"\nData Sources:")
for ds in ds_list['dataSourceSummaries']:
    print(f"  {ds['dataSourceId']} - {ds['name']} - {ds['status']}")

# Check service quotas for Titan v2
sq = boto3.client('service-quotas', region_name=region)
print(f"\nTitan v2 Quotas:")
try:
    paginator = sq.get_paginator('list_service_quotas')
    for page in paginator.paginate(ServiceCode='bedrock'):
        for q in page['Quotas']:
            if 'Titan Text Embeddings V2' in q['QuotaName'] and 'On-demand' in q['QuotaName']:
                print(f"  {q['QuotaName']}: {q['Value']}")
except Exception as e:
    print(f"  Error: {e}")

# Try ingestion anyway
print(f"\nAttempting ingestion on LCXIO4LGDC / GII9ZTWZFR...")
try:
    resp = ba.start_ingestion_job(knowledgeBaseId='LCXIO4LGDC', dataSourceId='GII9ZTWZFR')
    job_id = resp['ingestionJob']['ingestionJobId']
    print(f"Ingestion started! Job ID: {job_id}")
    
    for i in range(60):
        status = ba.get_ingestion_job(knowledgeBaseId='LCXIO4LGDC', dataSourceId='GII9ZTWZFR', ingestionJobId=job_id)
        s = status['ingestionJob']['status']
        print(f"  Status: {s}")
        if s == 'COMPLETE':
            stats = status['ingestionJob'].get('statistics', {})
            print(f"  Scanned: {stats.get('numberOfDocumentsScanned', 'N/A')}")
            print(f"  Indexed: {stats.get('numberOfNewDocumentsIndexed', 'N/A')}")
            print(f"  Failed: {stats.get('numberOfDocumentsFailedToIndex', 'N/A')}")
            break
        elif s == 'FAILED':
            print(f"  Failure: {status['ingestionJob'].get('failureReasons', 'unknown')}")
            break
        time.sleep(10)
except Exception as e:
    print(f"Ingestion error: {e}")
