"""Integration tests for /account/* endpoints."""
import os
import pytest
from datetime import datetime, timezone, timedelta
from jose import jwt
from tests.conftest import client, TestSessionLocal
import models

TEST_JWT_SECRET = "test-jwt-secret-for-unit-tests-minimum-32-chars!!"
os.environ["SUPABASE_JWT_SECRET"] = TEST_JWT_SECRET
os.environ.setdefault("SUPABASE_URL", "https://test.supabase.co")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")

AUTH_UID = "router-test-uid-001"
EMAIL    = "routertest@example.com"


def _make_token(uid: str = AUTH_UID, email: str = EMAIL) -> str:
    payload = {
        "sub": uid,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(hours=1),
        "iat": datetime.now(timezone.utc),
        "aud": "authenticated",
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")


@pytest.fixture(autouse=True)
def clean_db():
    def _clean():
        db = TestSessionLocal()
        db.query(models.UserSettings).filter_by(auth_user_id=AUTH_UID).delete()
        db.query(models.UserProfile).filter_by(auth_user_id=AUTH_UID).delete()
        db.commit()
        db.close()
    _clean()
    yield
    _clean()


def test_get_me_unauthenticated(client):
    resp = client.get("/account/me")
    assert resp.status_code == 403


def test_get_me_creates_profile(client):
    token = _make_token()
    resp = client.get("/account/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["auth_user_id"] == AUTH_UID
    assert data["email"] == EMAIL
    assert data["favorite_team_abbr"] is None


def test_patch_favorite_team(client):
    token = _make_token()
    client.get("/account/me", headers={"Authorization": f"Bearer {token}"})
    resp = client.patch(
        "/account/favorite-team",
        json={"favorite_team_abbr": "LAL"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["favorite_team_abbr"] == "LAL"


def test_get_settings(client):
    token = _make_token()
    resp = client.get("/account/settings", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert "default_season" in data


def test_patch_settings(client):
    token = _make_token()
    resp = client.patch(
        "/account/settings",
        json={"default_season": "2025-26"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    assert resp.json()["default_season"] == "2025-26"
