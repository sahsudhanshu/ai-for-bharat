"""
Application settings — all config via environment variables.
"""
import os


# ── AWS ──────────────────────────────────────────────────────────────────────
AWS_REGION = os.getenv("AWS_REGION", "ap-south-1")
BEDROCK_REGION = os.getenv("BEDROCK_REGION", "us-east-1")
BEDROCK_MODEL_ID = os.getenv(
    "BEDROCK_MODEL_ID", "us.anthropic.claude-sonnet-4-6-20250514-v1:0"
)

# ── DynamoDB table names ─────────────────────────────────────────────────────
CONVERSATIONS_TABLE = os.getenv("DYNAMODB_CONVERSATIONS_TABLE", "ai-bharat-conversations")
MESSAGES_TABLE = os.getenv("DYNAMODB_MESSAGES_TABLE", "ai-bharat-messages")
MEMORY_TABLE = os.getenv("DYNAMODB_MEMORY_TABLE", "ai-bharat-memory")

# Existing backend tables (read-only from agent)
IMAGES_TABLE = os.getenv("DYNAMODB_IMAGES_TABLE", "ai-bharat-images")
CHATS_TABLE = os.getenv("DYNAMODB_CHATS_TABLE", "ai-bharat-chats")
USERS_TABLE = os.getenv("DYNAMODB_USERS_TABLE", "ai-bharat-users")

# ── Cognito ──────────────────────────────────────────────────────────────────
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "ap-south-1_XXXXXXXXX")
COGNITO_CLIENT_ID = os.getenv("COGNITO_CLIENT_ID", "")

# ── External APIs ───────────────────────────────────────────────────────────
OPENWEATHERMAP_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY", "")

# ── Memory tuning ───────────────────────────────────────────────────────────
SHORT_TERM_MESSAGE_LIMIT = int(os.getenv("SHORT_TERM_MESSAGE_LIMIT", "10"))
SUMMARY_CHUNK_SIZE = int(os.getenv("SUMMARY_CHUNK_SIZE", "10"))
CATCH_HISTORY_PAGE_SIZE = int(os.getenv("CATCH_HISTORY_PAGE_SIZE", "10"))

# ── Demo mode ───────────────────────────────────────────────────────────────
DEMO_MODE = os.getenv("DEMO_MODE", "true").lower() == "true"
