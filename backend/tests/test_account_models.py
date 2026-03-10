"""Tests for UserProfile and UserSettings DB models."""
import pytest
from sqlalchemy.exc import IntegrityError
from tests.conftest import TestSessionLocal
import models


@pytest.fixture(autouse=True)
def clean_account_rows():
    yield
    db = TestSessionLocal()
    db.query(models.UserProfile).delete()
    db.query(models.UserSettings).delete()
    db.commit()
    db.close()


def test_user_profile_create():
    db = TestSessionLocal()
    profile = models.UserProfile(
        auth_user_id="supabase-uid-001",
        email="test@example.com",
        favorite_team_abbr=None,
    )
    db.add(profile)
    db.commit()
    db.refresh(profile)
    assert profile.id is not None
    assert profile.auth_user_id == "supabase-uid-001"
    assert profile.created_at is not None
    db.close()


def test_user_profile_auth_user_id_unique():
    db = TestSessionLocal()
    db.add(models.UserProfile(auth_user_id="dup-uid", email="a@b.com"))
    db.commit()
    db.add(models.UserProfile(auth_user_id="dup-uid", email="c@d.com"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    db.close()


def test_user_settings_create():
    db = TestSessionLocal()
    settings = models.UserSettings(
        auth_user_id="supabase-uid-002",
        default_season="2025-26",
        settings_json={},
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    assert settings.id is not None
    assert settings.settings_json == {}
    db.close()
