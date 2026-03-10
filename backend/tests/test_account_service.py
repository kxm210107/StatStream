"""Tests for account service — get-or-create profile/settings, update favorite team."""
import pytest
from tests.conftest import TestSessionLocal
from services.account_service import get_or_create_profile, get_or_create_settings, update_favorite_team


AUTH_UID = "service-test-uid-001"
EMAIL    = "servicetest@example.com"


@pytest.fixture(autouse=True)
def clean_db():
    """Delete any rows created by these tests between runs."""
    yield
    db = TestSessionLocal()
    import models
    db.query(models.UserProfile).filter_by(auth_user_id=AUTH_UID).delete()
    db.query(models.UserSettings).filter_by(auth_user_id=AUTH_UID).delete()
    db.commit()
    db.close()


def test_get_or_create_profile_creates_on_first_call():
    db = TestSessionLocal()
    profile = get_or_create_profile(db, AUTH_UID, EMAIL)
    assert profile.auth_user_id == AUTH_UID
    assert profile.email == EMAIL
    assert profile.favorite_team_abbr is None
    db.close()


def test_get_or_create_profile_returns_existing():
    db = TestSessionLocal()
    first  = get_or_create_profile(db, AUTH_UID, EMAIL)
    second = get_or_create_profile(db, AUTH_UID, EMAIL)
    assert first.id == second.id
    db.close()


def test_update_favorite_team():
    db = TestSessionLocal()
    get_or_create_profile(db, AUTH_UID, EMAIL)
    profile = update_favorite_team(db, AUTH_UID, "LAL")
    assert profile.favorite_team_abbr == "LAL"
    db.close()


def test_update_favorite_team_to_none():
    db = TestSessionLocal()
    get_or_create_profile(db, AUTH_UID, EMAIL)
    update_favorite_team(db, AUTH_UID, "LAL")
    profile = update_favorite_team(db, AUTH_UID, None)
    assert profile.favorite_team_abbr is None
    db.close()


def test_get_or_create_settings_creates_on_first_call():
    db = TestSessionLocal()
    settings = get_or_create_settings(db, AUTH_UID)
    assert settings.auth_user_id == AUTH_UID
    assert settings.default_season is None
    db.close()


def test_get_or_create_settings_returns_existing():
    db = TestSessionLocal()
    first  = get_or_create_settings(db, AUTH_UID)
    second = get_or_create_settings(db, AUTH_UID)
    assert first.id == second.id
    db.close()
