"""
Shared DynamoDB resource — reused across all modules.

In demo mode (DEMO_MODE=true, the default), uses an in-memory mock
so the app runs without real AWS credentials or tables.
"""
from src.config.settings import AWS_REGION, DEMO_MODE

if DEMO_MODE:
    from src.utils.mock_dynamodb import MockDynamoDBResource
    dynamodb = MockDynamoDBResource()
else:
    import boto3
    dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
