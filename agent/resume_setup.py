import boto3, json, time

region = 'ap-south-1'
ba = boto3.client('bedrock-agent', region_name=region)

collection_arn = 'arn:aws:aoss:ap-south-1:604010685667:collection/2gmzuphp7s8cq3fk6b5j'
role_arn = 'arn:aws:iam::604010685667:role/bedrock-kb-role-1772815256'
embedding_arn = f'arn:aws:bedrock:{region}::foundation-model/amazon.titan-embed-text-v1'

# Step 3: Create Knowledge Base
print('[3/6] Creating Knowledge Base...')
resp = ba.create_knowledge_base(
    name='fish-knowledge-base',
    description='Fish species knowledge base for Indian fishermen',
    roleArn=role_arn,
    knowledgeBaseConfiguration={
        'type': 'VECTOR',
        'vectorKnowledgeBaseConfiguration': {
            'embeddingModelArn': embedding_arn
        }
    },
    storageConfiguration={
        'type': 'OPENSEARCH_SERVERLESS',
        'opensearchServerlessConfiguration': {
            'collectionArn': collection_arn,
            'vectorIndexName': 'fish-kb-index',
            'fieldMapping': {
                'vectorField': 'embedding',
                'textField': 'text',
                'metadataField': 'metadata'
            }
        }
    }
)
kb_id = resp['knowledgeBase']['knowledgeBaseId']
kb_status = resp['knowledgeBase']['status']
print(f'Knowledge Base created: {kb_id}')
print(f'Status: {kb_status}')

# Step 4: Create data source
print()
print('[4/6] Creating S3 data source...')
ds_resp = ba.create_data_source(
    knowledgeBaseId=kb_id,
    name='fish-kb-s3-source',
    description='S3 source with fish knowledge documents',
    dataSourceConfiguration={
        'type': 'S3',
        's3Configuration': {
            'bucketArn': 'arn:aws:s3:::fish-detection-project-2026',
            'inclusionPrefixes': ['rag']
        }
    }
)
ds_id = ds_resp['dataSource']['dataSourceId']
print(f'Data source created: {ds_id}')

# Step 5: Start ingestion
print()
print('[5/6] Starting ingestion...')
ing_resp = ba.start_ingestion_job(knowledgeBaseId=kb_id, dataSourceId=ds_id)
job_id = ing_resp['ingestionJob']['ingestionJobId']
print(f'Ingestion started: {job_id}')

# Step 6: Wait for ingestion
print()
print('[6/6] Waiting for ingestion...')
for i in range(60):
    status = ba.get_ingestion_job(
        knowledgeBaseId=kb_id,
        dataSourceId=ds_id,
        ingestionJobId=job_id
    )
    s = status['ingestionJob']['status']
    print(f'  Status: {s}')
    if s == 'COMPLETE':
        stats = status['ingestionJob'].get('statistics', {})
        print(f'  Documents scanned: {stats.get("numberOfDocumentsScanned", "N/A")}')
        print(f'  Indexed: {stats.get("numberOfDocumentsIndexed", "N/A")}')
        break
    elif s == 'FAILED':
        reasons = status['ingestionJob'].get('failureReasons', 'unknown')
        print(f'  Failure: {reasons}')
        break
    time.sleep(10)

# Save config
config = {
    'knowledge_base_id': kb_id,
    'collection_arn': collection_arn,
    'role_arn': role_arn,
    'data_source_id': ds_id,
    'ingestion_job_id': job_id,
    's3_bucket': 'fish-detection-project-2026',
    's3_prefix': 'rag',
    'region': region
}
with open('kb_config.json', 'w') as f:
    json.dump(config, f, indent=2)

print()
print('Configuration saved to kb_config.json')
print(f'KB ID: {kb_id}')
print('DONE!')
