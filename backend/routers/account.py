"""Account API routes — all protected by JWT auth."""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import SessionLocal
from dependencies.auth import get_current_user, AuthIdentity
from services import account_service
from schemas import AccountProfileOut, FavoriteTeamUpdate, UserSettingsOut, UserSettingsUpdate

router = APIRouter(prefix="/account", tags=["account"])


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("/me", response_model=AccountProfileOut)
def get_me(
    identity: AuthIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    profile = account_service.get_or_create_profile(db, identity.auth_user_id, identity.email)
    return AccountProfileOut(
        auth_user_id=profile.auth_user_id,
        email=profile.email,
        favorite_team_abbr=profile.favorite_team_abbr,
        created_at=profile.created_at.isoformat() if profile.created_at else None,
    )


@router.patch("/favorite-team")
def patch_favorite_team(
    body: FavoriteTeamUpdate,
    identity: AuthIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    account_service.get_or_create_profile(db, identity.auth_user_id, identity.email)
    profile = account_service.update_favorite_team(db, identity.auth_user_id, body.favorite_team_abbr)
    return {"favorite_team_abbr": profile.favorite_team_abbr}


@router.get("/settings", response_model=UserSettingsOut)
def get_settings(
    identity: AuthIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = account_service.get_or_create_settings(db, identity.auth_user_id)
    return UserSettingsOut(
        default_season=settings.default_season,
        settings_json=settings.settings_json,
    )


@router.patch("/settings", response_model=UserSettingsOut)
def patch_settings(
    body: UserSettingsUpdate,
    identity: AuthIdentity = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = account_service.update_settings(
        db, identity.auth_user_id, body.default_season, body.settings_json
    )
    return UserSettingsOut(
        default_season=settings.default_season,
        settings_json=settings.settings_json,
    )
