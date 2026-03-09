"""
Application settings - all config via environment variables.
"""
import os


# ── AWS ──────────────────────────────────────────────────────────────────────
AWS_REGION = os.getenv("AWS_REGION", "")

# ── Google Gemini ─────────────────────────────────────────────────────────────
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

# ── DynamoDB table names ─────────────────────────────────────────────────────
CONVERSATIONS_TABLE = os.getenv("DYNAMODB_CONVERSATIONS_TABLE", "")
MESSAGES_TABLE = os.getenv("DYNAMODB_MESSAGES_TABLE", "")
MEMORY_TABLE = os.getenv("DYNAMODB_MEMORY_TABLE", "")

# Existing backend tables (read-only from agent)
IMAGES_TABLE = os.getenv("DYNAMODB_IMAGES_TABLE", "")
CHATS_TABLE = os.getenv("DYNAMODB_CHATS_TABLE", "")
USERS_TABLE = os.getenv("DYNAMODB_USERS_TABLE", "")
GROUPS_TABLE = os.getenv("GROUPS_TABLE", "")

# ── Cognito ──────────────────────────────────────────────────────────────────
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")
COGNITO_CLIENT_ID = os.getenv("COGNITO_CLIENT_ID", "")

# ── External APIs ───────────────────────────────────────────────────────────
OPENWEATHERMAP_API_KEY = os.getenv("OPENWEATHERMAP_API_KEY", "")
TAVILY_API_KEY = os.getenv("TAVILY_API_KEY", "")
FISH_WEIGHT_API_URL = os.getenv("FISH_WEIGHT_API_URL", "")

# ── Memory tuning ───────────────────────────────────────────────────────────
SHORT_TERM_MESSAGE_LIMIT = int(os.getenv("SHORT_TERM_MESSAGE_LIMIT", "10"))
SUMMARY_CHUNK_SIZE = int(os.getenv("SUMMARY_CHUNK_SIZE", "10"))
CATCH_HISTORY_PAGE_SIZE = int(os.getenv("CATCH_HISTORY_PAGE_SIZE", "10"))



# ── Telegram ─────────────────────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_SUBS_TABLE = os.getenv("TELEGRAM_SUBS_TABLE", "ai-bharat-telegram-subs")
TELEGRAM_ALERTS_ENABLED = os.getenv("TELEGRAM_ALERTS_ENABLED", "true").lower() == "true"
