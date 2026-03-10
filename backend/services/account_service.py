"""App-level account operations against the PostgreSQL app DB."""
from typing import Optional
from sqlalchemy.orm import Session
import models


def get_or_create_profile(db: Session, auth_user_id: str, email: str) -> models.UserProfile:
    profile = db.query(models.UserProfile).filter_by(auth_user_id=auth_user_id).first()
    if profile is None:
        profile = models.UserProfile(auth_user_id=auth_user_id, email=email)
        db.add(profile)
        db.commit()
        db.refresh(profile)
    return profile


def update_favorite_team(db: Session, auth_user_id: str, favorite_team_abbr: Optional[str]) -> models.UserProfile:
    profile = db.query(models.UserProfile).filter_by(auth_user_id=auth_user_id).first()
    profile.favorite_team_abbr = favorite_team_abbr
    db.commit()
    db.refresh(profile)
    return profile


def get_or_create_settings(db: Session, auth_user_id: str) -> models.UserSettings:
    settings = db.query(models.UserSettings).filter_by(auth_user_id=auth_user_id).first()
    if settings is None:
        settings = models.UserSettings(auth_user_id=auth_user_id)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings


def update_settings(db: Session, auth_user_id: str, default_season: Optional[str], settings_json: Optional[str]) -> models.UserSettings:
    settings = get_or_create_settings(db, auth_user_id)
    if default_season is not None:
        settings.default_season = default_season
    if settings_json is not None:
        settings.settings_json = settings_json
    db.commit()
    db.refresh(settings)
    return settings
