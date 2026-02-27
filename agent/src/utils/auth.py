"""
Auth utilities — JWT verification or demo-mode bypass.

Matches the pattern used in the Node.js backend.
"""
from __future__ import annotations
from dataclasses import dataclass
from fastapi import Request, HTTPException


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

    # TODO: Real Cognito JWT verification (use python-jose or aws-jwt-verify)
    raise HTTPException(status_code=401, detail="Invalid token — real Cognito verification not yet configured")
