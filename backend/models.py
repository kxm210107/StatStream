from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.types import JSON
from database import Base
from datetime import datetime, timezone


def _utcnow():
    return datetime.now(timezone.utc)


class PlayerStat(Base):
    __tablename__ = "player_stats"

    # Composite primary key: same player can appear in multiple seasons
    player_id    = Column(Integer, primary_key=True)
    season       = Column(String,  primary_key=True)   # e.g. "2024-25"

    player_name  = Column(String)
    team         = Column(String)
    pts_per_game = Column(Float)
    reb_per_game = Column(Float)
    ast_per_game = Column(Float)
    position     = Column(String, nullable=True)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id                 = Column(Integer, primary_key=True, index=True)
    auth_user_id       = Column(String, unique=True, index=True, nullable=False)
    email              = Column(String, nullable=False)
    favorite_team_abbr = Column(String, nullable=True)
    created_at         = Column(DateTime(timezone=True), default=_utcnow)
    updated_at         = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)


class UserSettings(Base):
    __tablename__ = "user_settings"

    id             = Column(Integer, primary_key=True, index=True)
    auth_user_id   = Column(String, unique=True, index=True, nullable=False)
    default_season = Column(String, nullable=True)
    settings_json  = Column(JSON, nullable=True)   # stored as JSON; accepts dict
    created_at     = Column(DateTime(timezone=True), default=_utcnow)
    updated_at     = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)
