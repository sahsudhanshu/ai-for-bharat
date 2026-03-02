import boto3
import json
from botocore.exceptions import ClientError

REGION = "ap-south-1"
MODEL_ID = "arn:aws:bedrock:ap-south-1:604010685667:inference-profile/global.anthropic.claude-sonnet-4-6"

def test_bedrock():
    try:
        client = boto3.client("bedrock-runtime", region_name=REGION)

        body = {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": 50,
            "messages": [
                {"role": "user", "content": "Say hello in 5 words"}
            ]
        }

        response = client.invoke_model(
            modelId=MODEL_ID,
            body=json.dumps(body)
        )

        result = json.loads(response["body"].read())
        print("✅ SUCCESS")
        print(result)

    except ClientError as e:
        print("❌ AWS ERROR")
        print("Error Code:", e.response["Error"]["Code"])
        print("Message:", e.response["Error"]["Message"])

    except Exception as e:
        print("❌ OTHER ERROR")
        print(str(e))


if __name__ == "__main__":
    test_bedrock()