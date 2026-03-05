# backend/main.py
"""
cd /Users/kevjumba/PycharmProjects/StatStream/backend
uvicorn main:app --reload --port 8000
"""
import math
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import func

import models, schemas, predictor
from database import engine, SessionLocal

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="StatStream API", version="2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ==========================================
# ENDPOINT 1: Health Check
# GET /
# ==========================================
@app.get("/")
def root():
    return {
        "message":        "StatStream API is running!",
        "ml_model_ready": predictor.model_available(),
    }


# ==========================================
# ENDPOINT: Available seasons
# GET /seasons
# ==========================================
@app.get("/seasons", response_model=List[str])
def get_seasons(db: Session = Depends(get_db)):
    """Returns all seasons loaded into the database, newest first."""
    rows = (
        db.query(models.PlayerStat.season)
        .distinct()
        .order_by(models.PlayerStat.season.desc())
        .all()
    )
    return [r[0] for r in rows]


# ==========================================
# ENDPOINT 2: Get ALL players
# GET /players?season=2024-25
# ==========================================
@app.get("/players", response_model=List[schemas.PlayerStatSchema])
def get_all_players(season: str = "2024-25", db: Session = Depends(get_db)):
    return (
        db.query(models.PlayerStat)
        .filter(models.PlayerStat.season == season)
        .all()
    )


# ==========================================
# ENDPOINT 3: Get ONE player by ID
# GET /players/23?season=2024-25
# ==========================================
@app.get("/players/{player_id}", response_model=schemas.PlayerStatSchema)
def get_player(player_id: int, season: str = "2024-25", db: Session = Depends(get_db)):
    player = (
        db.query(models.PlayerStat)
        .filter(
            models.PlayerStat.player_id == player_id,
            models.PlayerStat.season    == season,
        )
        .first()
    )
    if player is None:
        raise HTTPException(status_code=404, detail="Player not found")
    return player


# ==========================================
# ENDPOINT 4: Get top scorers
# GET /players/top/scorers?limit=10&season=2024-25
# ==========================================
@app.get("/players/top/scorers", response_model=List[schemas.PlayerStatSchema])
def get_top_scorers(limit: int = 10, season: str = "2024-25", db: Session = Depends(get_db)):
    return (
        db.query(models.PlayerStat)
        .filter(models.PlayerStat.season == season)
        .order_by(models.PlayerStat.pts_per_game.desc())
        .limit(limit)
        .all()
    )


# ==========================================
# ENDPOINT 5: Search by team
# GET /players/team/LAL?season=2024-25
# ==========================================
@app.get("/players/team/{team_abbr}", response_model=List[schemas.PlayerStatSchema])
def get_players_by_team(team_abbr: str, season: str = "2024-25", db: Session = Depends(get_db)):
    return (
        db.query(models.PlayerStat)
        .filter(
            models.PlayerStat.team   == team_abbr.upper(),
            models.PlayerStat.season == season,
        )
        .all()
    )


# ==========================================
# ENDPOINT: Filter players
# GET /players/filter?min_pts=20&season=2024-25
# ==========================================
@app.get("/players/filter", response_model=List[schemas.PlayerStatSchema])
def filter_players(
    min_pts: float = 0,
    min_reb: float = 0,
    min_ast: float = 0,
    season:  str   = "2024-25",
    db: Session = Depends(get_db),
):
    return (
        db.query(models.PlayerStat)
        .filter(
            models.PlayerStat.season       == season,
            models.PlayerStat.pts_per_game >= min_pts,
            models.PlayerStat.reb_per_game >= min_reb,
            models.PlayerStat.ast_per_game >= min_ast,
        )
        .order_by(models.PlayerStat.pts_per_game.desc())
        .all()
    )


# ==========================================
# ENDPOINT: Top rebounders
# GET /players/top/rebounders?season=2024-25
# ==========================================
@app.get("/players/top/rebounders", response_model=List[schemas.PlayerStatSchema])
def get_top_rebounders(limit: int = 10, season: str = "2024-25", db: Session = Depends(get_db)):
    return (
        db.query(models.PlayerStat)
        .filter(models.PlayerStat.season == season)
        .order_by(models.PlayerStat.reb_per_game.desc())
        .limit(limit)
        .all()
    )


# ==========================================
# ENDPOINT: Top assisters
# GET /players/top/assisters?season=2024-25
# ==========================================
@app.get("/players/top/assisters", response_model=List[schemas.PlayerStatSchema])
def get_top_assisters(limit: int = 10, season: str = "2024-25", db: Session = Depends(get_db)):
    return (
        db.query(models.PlayerStat)
        .filter(models.PlayerStat.season == season)
        .order_by(models.PlayerStat.ast_per_game.desc())
        .limit(limit)
        .all()
    )


# ==========================================
# ENDPOINT: League averages
# GET /stats/averages?season=2024-25
# ==========================================
@app.get("/stats/averages", response_model=schemas.LeagueAverages)
def get_league_averages(season: str = "2024-25", db: Session = Depends(get_db)):
    avg_pts = db.query(func.avg(models.PlayerStat.pts_per_game)).filter(models.PlayerStat.season == season).scalar()
    avg_reb = db.query(func.avg(models.PlayerStat.reb_per_game)).filter(models.PlayerStat.season == season).scalar()
    avg_ast = db.query(func.avg(models.PlayerStat.ast_per_game)).filter(models.PlayerStat.season == season).scalar()
    return {"avg_pts": round(avg_pts, 1), "avg_reb": round(avg_reb, 1), "avg_ast": round(avg_ast, 1)}


# ==========================================
# ENDPOINT: All team abbreviations
# GET /teams?season=2024-25
# ==========================================
@app.get("/teams", response_model=List[str])
def get_teams(season: str = "2024-25", db: Session = Depends(get_db)):
    rows = (
        db.query(models.PlayerStat.team)
        .filter(models.PlayerStat.season == season)
        .distinct()
        .order_by(models.PlayerStat.team)
        .all()
    )
    return [r[0] for r in rows]


# ── helpers ──────────────────────────────────────────────────────────────────

# Only use the top N scorers per team to represent the rotation.
# Averaging ALL roster players dilutes star-heavy teams (e.g. LAL with 21
# players ranks below rebuilding teams with only 15).
ROTATION_SIZE = 8


def _query_team_stats(db: Session, team: str, season: str):
    """Average stats over the top ROTATION_SIZE players by PPG.

    Uses a subquery so PostgreSQL can ORDER → LIMIT → AVG in one round-trip.
    """
    subq = (
        db.query(
            models.PlayerStat.pts_per_game,
            models.PlayerStat.reb_per_game,
            models.PlayerStat.ast_per_game,
            models.PlayerStat.player_id,
        )
        .filter(
            models.PlayerStat.team   == team,
            models.PlayerStat.season == season,
        )
        .order_by(models.PlayerStat.pts_per_game.desc())
        .limit(ROTATION_SIZE)
        .subquery()
    )

    row = (
        db.query(
            func.avg(subq.c.pts_per_game),
            func.avg(subq.c.reb_per_game),
            func.avg(subq.c.ast_per_game),
            func.count(subq.c.player_id),
        )
        .first()
    )
    return None if row[0] is None else row


# ==========================================
# ENDPOINT: Compare two teams (ML-powered)
# GET /teams/compare?team1=LAL&team2=GSW&home=LAL&season=2024-25
# ==========================================
@app.get("/teams/compare", response_model=schemas.CompareResult)
def compare_teams(
    team1:  str,
    team2:  str,
    home:   str,
    season: str = "2024-25",
    db: Session = Depends(get_db),
):
    t1   = team1.upper()
    t2   = team2.upper()
    home = home.upper()

    s1 = _query_team_stats(db, t1, season)
    if s1 is None:
        raise HTTPException(status_code=404, detail=f"Team '{t1}' not found for season {season}")

    s2 = _query_team_stats(db, t2, season)
    if s2 is None:
        raise HTTPException(status_code=404, detail=f"Team '{t2}' not found for season {season}")

    avg_pts1, avg_reb1, avg_ast1, count1 = s1
    avg_pts2, avg_reb2, avg_ast2, count2 = s2

    # Route home/away stats into predictor correctly
    if home == t1:
        prob1, prob2, model_type = predictor.predict(
            avg_pts1, avg_reb1, avg_ast1,   # home
            avg_pts2, avg_reb2, avg_ast2,   # away
        )
    else:
        prob_home, prob_away, model_type = predictor.predict(
            avg_pts2, avg_reb2, avg_ast2,   # home = t2
            avg_pts1, avg_reb1, avg_ast1,   # away = t1
        )
        prob1, prob2 = prob_away, prob_home  # flip to team1/team2 perspective

    # Display score (for UI context only)
    score1 = round((avg_pts1 * 0.5) + (avg_ast1 * 0.3) + (avg_reb1 * 0.2), 1)
    score2 = round((avg_pts2 * 0.5) + (avg_ast2 * 0.3) + (avg_reb2 * 0.2), 1)

    return {
        "team1": {
            "team":            t1,
            "avg_pts":         round(avg_pts1, 1),
            "avg_reb":         round(avg_reb1, 1),
            "avg_ast":         round(avg_ast1, 1),
            "player_count":    count1,
            "score":           score1,
            "win_probability": prob1,
        },
        "team2": {
            "team":            t2,
            "avg_pts":         round(avg_pts2, 1),
            "avg_reb":         round(avg_reb2, 1),
            "avg_ast":         round(avg_ast2, 1),
            "player_count":    count2,
            "score":           score2,
            "win_probability": prob2,
        },
        "home_team":  home,
        "model_type": model_type,
    }
