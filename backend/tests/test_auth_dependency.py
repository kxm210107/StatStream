"""Tests for the JWT auth dependency."""
import os
import pytest
from datetime import datetime, timezone, timedelta
from jose import jwt
from fastapi import HTTPException

TEST_JWT_SECRET = "test-jwt-secret-for-unit-tests-minimum-32-chars!!"
os.environ["SUPABASE_JWT_SECRET"] = TEST_JWT_SECRET
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dependencies.auth import _verify_token, AuthIdentity


def _make_token(auth_user_id: str, email: str, secret: str = TEST_JWT_SECRET, expired: bool = False) -> str:
    exp = datetime.now(timezone.utc) + (timedelta(seconds=-1) if expired else timedelta(hours=1))
    payload = {
        "sub": auth_user_id,
        "email": email,
        "exp": exp,
        "iat": datetime.now(timezone.utc),
        "aud": "authenticated",
    }
    return jwt.encode(payload, secret, algorithm="HS256")


def test_verify_token_valid():
    token = _make_token("uid-123", "user@example.com")
    identity = _verify_token(token)
    assert identity.auth_user_id == "uid-123"
    assert identity.email == "user@example.com"


def test_verify_token_expired():
    token = _make_token("uid-123", "user@example.com", expired=True)
    with pytest.raises(HTTPException) as exc:
        _verify_token(token)
    assert exc.value.status_code == 401


def test_verify_token_invalid():
    with pytest.raises(HTTPException) as exc:
        _verify_token("not-a-valid-token")
    assert exc.value.status_code == 401


def test_verify_token_wrong_secret():
    token = _make_token("uid-123", "user@example.com", secret="wrong-secret-padding-padding-pad!!")
    with pytest.raises(HTTPException) as exc:
        _verify_token(token)
    assert exc.value.status_code == 401
