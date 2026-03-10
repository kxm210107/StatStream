"""
Shared pytest fixtures for the StatStream backend test suite.

A lightweight in-memory SQLite database is created fresh for every test
session so tests never touch the real PostgreSQL database.
"""

import sys
import os

# Make sure `import models`, `import schemas`, etc. work from the backend dir
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# ── Override database BEFORE importing the app so the engine is replaced ──────
# StaticPool forces all sessions to share the SAME single connection, which is
# required for SQLite :memory: — otherwise each session opens a fresh DB with
# no tables.
TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

# Patch database.engine and database.SessionLocal so models/main use SQLite
import database
database.engine       = test_engine
database.SessionLocal = TestSessionLocal

# Now import the app (it will see the patched engine)
from main import app, get_db
import models

# Create tables in the SQLite test DB
models.Base.metadata.create_all(bind=test_engine)


def override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

from routers.account import get_db as account_get_db
app.dependency_overrides[account_get_db] = override_get_db


# ── Seed data ──────────────────────────────────────────────────────────────────

SEED_PLAYERS = [
    # LAL — season 2024-25
    models.PlayerStat(player_id=1, season="2024-25", player_name="LeBron James",      team="LAL", pts_per_game=25.7, reb_per_game=7.3, ast_per_game=8.3),
    models.PlayerStat(player_id=2, season="2024-25", player_name="Anthony Davis",     team="LAL", pts_per_game=24.7, reb_per_game=12.6, ast_per_game=3.5),
    models.PlayerStat(player_id=3, season="2024-25", player_name="Austin Reaves",     team="LAL", pts_per_game=15.9, reb_per_game=4.5, ast_per_game=5.5),
    # GSW — season 2024-25
    models.PlayerStat(player_id=4, season="2024-25", player_name="Stephen Curry",     team="GSW", pts_per_game=26.4, reb_per_game=4.6, ast_per_game=6.1),
    models.PlayerStat(player_id=5, season="2024-25", player_name="Draymond Green",    team="GSW", pts_per_game=9.0,  reb_per_game=7.5, ast_per_game=6.5),
    # BOS — season 2024-25
    models.PlayerStat(player_id=6, season="2024-25", player_name="Jayson Tatum",      team="BOS", pts_per_game=26.9, reb_per_game=8.1, ast_per_game=4.9),
    models.PlayerStat(player_id=7, season="2024-25", player_name="Jaylen Brown",      team="BOS", pts_per_game=23.0, reb_per_game=5.5, ast_per_game=3.6),
    # LAL — season 2023-24  (for multi-season tests)
    models.PlayerStat(player_id=1, season="2023-24", player_name="LeBron James",      team="LAL", pts_per_game=25.7, reb_per_game=7.3, ast_per_game=8.3),
    models.PlayerStat(player_id=2, season="2023-24", player_name="Anthony Davis",     team="LAL", pts_per_game=24.7, reb_per_game=12.6, ast_per_game=3.5),
]


@pytest.fixture(scope="session", autouse=True)
def seed_db():
    """Insert seed players once for the whole test session."""
    db = TestSessionLocal()
    for p in SEED_PLAYERS:
        db.merge(p)
    db.commit()
    db.close()


@pytest.fixture(scope="session")
def client():
    """A requests-style test client wired to the in-memory DB."""
    with TestClient(app) as c:
        yield c
