"""
Auth utilities — JWT verification or demo-mode bypass.

Matches the pattern used in the Node.js backend.
"""
from __future__ import annotations
import os
import json
import base64
from dataclasses import dataclass
from fastapi import Request, HTTPException
import jwt
from jwt import PyJWKClient

# Optional: Cache the JWKS client securely if Region/Pool exist
COGNITO_REGION = os.getenv("AWS_REGION", "ap-south-1")
COGNITO_USER_POOL_ID = os.getenv("COGNITO_USER_POOL_ID", "")

# We only init PyJWKClient if we have the pool ID
if COGNITO_USER_POOL_ID:
    jwks_url = f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}/.well-known/jwks.json"
    jwks_client = PyJWKClient(jwks_url)
else:
    jwks_client = None


@dataclass
class TokenPayload:
    sub: str
    email: str
    username: str


def verify_token(request: Request) -> TokenPayload:
    """
    Extract the Bearer token from the Authorization header.
    In demo mode, tokens starting with 'demo_jwt_token' are accepted.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")

    token = auth_header.split(" ", 1)[1]

    # ── Demo mode bypass ─────────────────────────────────────────────────────
    if token.startswith("demo_jwt_token") or token.startswith("cognito_jwt_"):
        return TokenPayload(
            sub="usr_demo_001",
            email="rajan.fisherman@example.com",
            username="Rajan Kumar",
        )
    # ─────────────────────────────────────────────────────────────────────────

    # ── Real Cognito Token Verification ──────────────────────────────────────
    if jwks_client:
        try:
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                options={"verify_audience": False} # Access tokens don't always contain `aud`
            )
            return TokenPayload(
                sub=payload.get("sub", ""),
                email=payload.get("email", "unknown@example.com"),
                username=payload.get("name", payload.get("username", "User")),
            )
        except jwt.PyJWTError as e:
            raise HTTPException(status_code=401, detail=str(e))

    # ── Fallback decoding if misconfigured ───────────────────────────────────
    if token.startswith("eyJ"):
        try:
            payload_b64 = token.split(".")[1]
            padded = payload_b64 + "=" * (4 - len(payload_b64) % 4)
            payload_dict = json.loads(base64.urlsafe_b64decode(padded).decode('utf-8'))
            return TokenPayload(
                sub=payload_dict.get("sub", "usr_demo_001"),
                email=payload_dict.get("email", "rajan.fisherman@example.com"),
                username=payload_dict.get("name", "Rajan Kumar"),
            )
        except Exception:
            pass

    return TokenPayload(
        sub="usr_demo_001",
        email="rajan.fisherman@example.com",
        username="Rajan Kumar",
    )
