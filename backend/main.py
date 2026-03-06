# backend/main.py
"""
cd /Users/kevjumba/PycharmProjects/StatStream/backend
uvicorn main:app --reload --port 8000
"""
import math
import random
import numpy as np
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import func

import models, schemas, predictor
from database import engine, SessionLocal

models.Base.metadata.create_all(bind=engine)

# ── Safe column migrations ────────────────────────────────────────────────────
# create_all won't add columns to existing tables; use ALTER TABLE for new ones.
from sqlalchemy import text as _text

with engine.connect() as _conn:
    _exists = _conn.execute(_text("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'player_stats' AND column_name = 'position'
    """)).fetchone()
    if _exists is None:
        _conn.execute(_text("ALTER TABLE player_stats ADD COLUMN position VARCHAR"))
        _conn.commit()

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
# ENDPOINT: Search players by name
# GET /players/search?q=lebron
# NOTE: Must be defined BEFORE /players/{player_id} to avoid route conflict.
# ==========================================
@app.get("/players/search")
def search_players(q: str = "", db: Session = Depends(get_db)):
    if len(q) < 2:
        return []
    rows = (
        db.query(models.PlayerStat)
        .filter(models.PlayerStat.player_name.ilike(f"%{q}%"))
        .order_by(models.PlayerStat.season.desc())
        .all()
    )
    seen, results = set(), []
    for row in rows:
        if row.player_id not in seen:
            seen.add(row.player_id)
            results.append({
                "player_id":   row.player_id,
                "player_name": row.player_name,
                "team":        row.team,
                "position":    row.position,
            })
    return results[:20]


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


# ──────────────────────────────────────────────────────────────────────────────
#  TRAJECTORY HELPERS
# ──────────────────────────────────────────────────────────────────────────────

def _regress(x: np.ndarray, y: np.ndarray, x_pred: float):
    """OLS regression with 95 % prediction interval at x_pred."""
    n = len(x)
    x_mean = float(np.mean(x))
    y_mean = float(np.mean(y))
    ss_xx  = float(np.sum((x - x_mean) ** 2))

    if ss_xx == 0 or n < 2:
        return y_mean, (max(0.0, y_mean - 2.0), y_mean + 2.0), 0.0

    slope     = float(np.sum((x - x_mean) * (y - y_mean)) / ss_xx)
    intercept = y_mean - slope * x_mean
    residuals = y - (slope * x + intercept)
    mse       = float(np.sum(residuals ** 2) / max(n - 2, 1))
    se_pred   = float(np.sqrt(mse * (1 + 1 / n + (x_pred - x_mean) ** 2 / ss_xx)))
    proj      = float(slope * x_pred + intercept)
    half      = 1.96 * se_pred
    return proj, (max(0.0, proj - half), proj + half), slope


# ==========================================
# ENDPOINT: Player career trajectory
# GET /players/{player_id}/trajectory
# ==========================================
@app.get("/players/{player_id}/trajectory")
def get_player_trajectory(player_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(models.PlayerStat)
        .filter(models.PlayerStat.player_id == player_id)
        .order_by(models.PlayerStat.season)
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail="Player not found")

    seasons_data = [
        {
            "season": r.season,
            "pts":    r.pts_per_game,
            "reb":    r.reb_per_game,
            "ast":    r.ast_per_game,
            "team":   r.team,
        }
        for r in rows
    ]

    # Fit regression
    x = np.array([float(s["season"].split("-")[0]) for s in seasons_data])
    x -= x[0]  # start at 0
    x_pred = float(x[-1] + 1)

    pts_arr = np.array([s["pts"] for s in seasons_data])
    reb_arr = np.array([s["reb"] for s in seasons_data])
    ast_arr = np.array([s["ast"] for s in seasons_data])

    proj_pts, ci_pts, slope_pts = _regress(x, pts_arr, x_pred)
    proj_reb, ci_reb, slope_reb = _regress(x, reb_arr, x_pred)
    proj_ast, ci_ast, slope_ast = _regress(x, ast_arr, x_pred)

    last_year = int(rows[-1].season.split("-")[0])
    proj_season = f"{last_year + 1}-{str(last_year + 2)[-2:]}"

    return {
        "player_id":   player_id,
        "player_name": rows[0].player_name,
        "position":    rows[0].position,
        "seasons":     seasons_data,
        "projection": {
            "season": proj_season,
            "pts":    round(proj_pts, 1),
            "reb":    round(proj_reb, 1),
            "ast":    round(proj_ast, 1),
            "pts_ci": [round(ci_pts[0], 1), round(ci_pts[1], 1)],
            "reb_ci": [round(ci_reb[0], 1), round(ci_reb[1], 1)],
            "ast_ci": [round(ci_ast[0], 1), round(ci_ast[1], 1)],
        },
        "trend": {
            "pts_slope": round(slope_pts, 3),
            "reb_slope": round(slope_reb, 3),
            "ast_slope": round(slope_ast, 3),
        },
    }


# ──────────────────────────────────────────────────────────────────────────────
#  SEASON PREDICTIONS ENDPOINT
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/predictions/season-preview")
def season_preview(
    target_season: str = "2025-26",
    min_seasons:   int = 2,
    limit:         int = 200,
    db: Session = Depends(get_db),
):
    """
    For each player with >= min_seasons of history BEFORE target_season,
    run OLS regression to predict their target_season stats.
    Returns actual stats alongside predictions when available.
    """

    # ── Gather all historical rows grouped by player ─────────────────────────
    all_rows = (
        db.query(models.PlayerStat)
        .order_by(models.PlayerStat.player_id, models.PlayerStat.season)
        .all()
    )

    by_player: dict[int, list] = defaultdict(list)
    actuals:   dict[int, dict] = {}

    for r in all_rows:
        if r.season == target_season:
            actuals[r.player_id] = {
                "actual_pts": r.pts_per_game,
                "actual_reb": r.reb_per_game,
                "actual_ast": r.ast_per_game,
                "team":       r.team,
                "position":   r.position,
            }
        elif r.season < target_season:          # only prior seasons
            by_player[r.player_id].append(r)

    results = []

    for player_id, rows in by_player.items():
        if len(rows) < min_seasons:
            continue

        # Use the most recent row for display meta
        latest = rows[-1]
        x = np.array([float(r.season.split("-")[0]) for r in rows])
        x -= x[0]
        x_pred = float(x[-1] + 1)

        pts_arr = np.array([r.pts_per_game for r in rows])
        reb_arr = np.array([r.reb_per_game for r in rows])
        ast_arr = np.array([r.ast_per_game for r in rows])

        pred_pts, _, _ = _regress(x, pts_arr, x_pred)
        pred_reb, _, _ = _regress(x, reb_arr, x_pred)
        pred_ast, _, _ = _regress(x, ast_arr, x_pred)

        # Clamp to non-negative
        pred_pts = max(0.0, round(pred_pts, 1))
        pred_reb = max(0.0, round(pred_reb, 1))
        pred_ast = max(0.0, round(pred_ast, 1))

        actual = actuals.get(player_id, {})
        team     = actual.get("team",     latest.team)
        position = actual.get("position", latest.position)

        entry: dict = {
            "player_id":    player_id,
            "player_name":  latest.player_name,
            "position":     position,
            "team":         team,
            "seasons_used": len(rows),
            "pred_pts":     pred_pts,
            "pred_reb":     pred_reb,
            "pred_ast":     pred_ast,
        }

        if actual:
            a_pts = actual["actual_pts"]
            a_reb = actual["actual_reb"]
            a_ast = actual["actual_ast"]
            entry.update({
                "actual_pts": round(a_pts, 1),
                "actual_reb": round(a_reb, 1),
                "actual_ast": round(a_ast, 1),
                "diff_pts":   round(a_pts - pred_pts, 1),
                "diff_reb":   round(a_reb - pred_reb, 1),
                "diff_ast":   round(a_ast - pred_ast, 1),
            })

        results.append(entry)

    # Sort by predicted points desc
    results.sort(key=lambda r: r["pred_pts"], reverse=True)
    return results[:limit]


# ──────────────────────────────────────────────────────────────────────────────
#  PLAYOFF SIMULATOR HELPERS
# ──────────────────────────────────────────────────────────────────────────────
import json
import time
from collections import defaultdict

EAST_CONF = {
    'ATL','BOS','BKN','CHA','CHI','CLE','DET','IND','MIA','MIL','NYK','ORL','PHI','TOR','WAS'
}

# TeamID → abbreviation (mirrors frontend teamLogos.js)
_TEAM_ID_TO_ABBR: dict[int, str] = {
    1610612737: 'ATL', 1610612738: 'BOS', 1610612751: 'BKN', 1610612766: 'CHA',
    1610612741: 'CHI', 1610612739: 'CLE', 1610612742: 'DAL', 1610612743: 'DEN',
    1610612765: 'DET', 1610612744: 'GSW', 1610612745: 'HOU', 1610612754: 'IND',
    1610612746: 'LAC', 1610612747: 'LAL', 1610612763: 'MEM', 1610612748: 'MIA',
    1610612749: 'MIL', 1610612750: 'MIN', 1610612740: 'NOP', 1610612752: 'NYK',
    1610612760: 'OKC', 1610612753: 'ORL', 1610612755: 'PHI', 1610612756: 'PHX',
    1610612757: 'POR', 1610612758: 'SAC', 1610612759: 'SAS', 1610612761: 'TOR',
    1610612762: 'UTA', 1610612764: 'WAS',
}

# NBA home-court advantage per game (historical ~3 pp)
_HCA = 0.03

# Simple 1-hour in-memory cache for live data
_standings_cache: dict   = {}
_team_stats_cache: dict  = {}
_CACHE_TTL = 3600


def _fetch_live_standings(season: str):
    """
    Pull current standings via nba_api (LeagueStandings).
    Returns a list of dicts with {team, conf, wins, losses, win_pct, playoff_rank, net_pts}
    or None if the request fails.  Results are cached for 1 hour.
    """
    cached = _standings_cache.get(season)
    if cached and time.time() - cached['ts'] < _CACHE_TTL:
        return cached['data']

    try:
        from nba_api.stats.endpoints import leaguestandings as _ls
        time.sleep(0.6)   # respect rate limit
        raw = _ls.LeagueStandings(season=season, season_type='Regular Season')
        df  = raw.get_data_frames()[0]

        standings = []
        for _, r in df.iterrows():
            team_id = int(r['TeamID'])
            abbr    = _TEAM_ID_TO_ABBR.get(team_id)
            if not abbr:
                continue
            conf    = str(r.get('Conference', ''))
            wins    = int(r.get('WINS',       0) or 0)
            losses  = int(r.get('LOSSES',     0) or 0)
            total   = wins + losses
            win_pct = wins / total if total > 0 else 0.5
            p_rank  = int(r.get('PlayoffRank', 99) or 99)
            # DiffPointsPG = avg point differential (proxy for net rating)
            net_pts = float(r.get('DiffPointsPG', 0.0) or 0.0)
            standings.append({
                'team':         abbr,
                'conf':         'East' if 'east' in conf.lower() else 'West',
                'wins':         wins,
                'losses':       losses,
                'win_pct':      win_pct,
                'playoff_rank': p_rank,
                'record':       f"{wins}-{losses}",
                'net_pts':      net_pts,
            })

        if not standings:
            return None

        _standings_cache[season] = {'data': standings, 'ts': time.time()}
        return standings

    except Exception as e:
        print(f"[StatStream] Live standings fetch failed: {e}")
        return None


def _fetch_live_team_stats(season: str):
    """
    Pull per-game team stats via nba_api (LeagueDashTeamStats).
    Returns dict keyed by team abbreviation:
      {abbr: {avg_pts, avg_reb, avg_ast, net_rating, win_pct}}
    """
    cached = _team_stats_cache.get(season)
    if cached and time.time() - cached['ts'] < _CACHE_TTL:
        return cached['data']

    try:
        from nba_api.stats.endpoints import leaguedashteamstats as _ldt
        time.sleep(0.6)
        raw = _ldt.LeagueDashTeamStats(season=season, per_mode_detailed='PerGame')
        df  = raw.get_data_frames()[0]

        data = {}
        for _, r in df.iterrows():
            team_id = int(r['TEAM_ID'])
            abbr    = _TEAM_ID_TO_ABBR.get(team_id)
            if not abbr:
                continue
            w   = int(r.get('W', 0) or 0)
            l   = int(r.get('L', 0) or 0)
            tot = w + l
            data[abbr] = {
                'avg_pts':    round(float(r.get('PTS',        0) or 0), 1),
                'avg_reb':    round(float(r.get('REB',        0) or 0), 1),
                'avg_ast':    round(float(r.get('AST',        0) or 0), 1),
                'net_rating': float(r.get('PLUS_MINUS', 0) or 0),
                'win_pct':    w / tot if tot > 0 else 0.5,
            }

        if not data:
            return None

        _team_stats_cache[season] = {'data': data, 'ts': time.time()}
        return data

    except Exception as e:
        print(f"[StatStream] Live team stats fetch failed: {e}")
        return None


def _net_rating_prob(nr_a: float, nr_b: float) -> float:
    """
    Win probability from net rating difference.
    Calibrated so a +10 NR advantage ≈ 70% win probability.
    logit(0.70) ≈ 0.847  →  scale = 0.0847 per NR point.
    """
    diff = nr_a - nr_b
    return 1.0 / (1.0 + math.exp(-diff * 0.0847))


def _bt_prob(wp_a: float, wp_b: float) -> float:
    """Bradley-Terry neutral-court win probability: WP_A / (WP_A + WP_B)."""
    a, b = max(wp_a, 0.01), max(wp_b, 0.01)
    return a / (a + b)


def _simulate_series_hca(p_neutral: float, a_is_higher_seed: bool) -> bool:
    """
    Simulate one best-of-7 series game-by-game with real home/away schedule.
    Higher seed hosts games 1, 2, 5, 7; lower seed hosts 3, 4, 6.
    Returns True if team A wins the series.
    """
    p_home = min(0.98, p_neutral + _HCA)
    p_away = max(0.02, p_neutral - _HCA)
    # schedule[i] = True → team A is home for game i
    if a_is_higher_seed:
        sched = [True,  True,  False, False, True,  False, True]
    else:
        sched = [False, False, True,  True,  False, True,  False]

    wins_a = wins_b = g = 0
    while wins_a < 4 and wins_b < 4:
        if random.random() < (p_home if sched[g] else p_away):
            wins_a += 1
        else:
            wins_b += 1
        g += 1
    return wins_a == 4


def _simulate_play_in(teams_7_to_10: list, n_sims: int) -> list:
    """
    Simulate the NBA play-in tournament for seeds 7-10.
    Game A: 7 vs 8  — winner = 7th seed in bracket
    Game B: 9 vs 10 — loser eliminated
    Game C: loser(A) vs winner(B) — winner = 8th seed in bracket
    Returns list of 4 dicts with made_7th/made_8th/eliminated percentages.
    """
    t = teams_7_to_10  # [seed7, seed8, seed9, seed10]
    counts = [{'made_7th': 0, 'made_8th': 0, 'eliminated': 0} for _ in range(4)]

    def game(a, b):
        p = _bt_prob(t[a]['win_pct'], t[b]['win_pct'])
        return a if random.random() < p else b

    for _ in range(n_sims):
        w_a  = game(0, 1)           # Game A: 7 vs 8
        l_a  = 1 - w_a              # index of loser
        w_b  = game(2, 3)           # Game B: 9 vs 10 (loser(B) = 3 - w_b)
        w_c  = game(l_a, w_b)       # Game C: loser(A) vs winner(B)

        counts[w_a]['made_7th']  += 1
        counts[w_c]['made_8th']  += 1
        l_b  = 5 - w_b              # loser of Game B: indices are 2,3 → 5-winner
        counts[l_b]['eliminated'] += 1
        # loser of Game C also eliminated
        l_c  = l_a if w_c == w_b else w_b
        counts[l_c]['eliminated'] += 1

    result = []
    for i, team in enumerate(t):
        result.append({
            'team':       team['team'],
            'seed':       7 + i,
            'record':     team.get('record', ''),
            'win_pct':    team['win_pct'],
            'made_7th':   round(counts[i]['made_7th']   / n_sims * 100, 1),
            'made_8th':   round(counts[i]['made_8th']   / n_sims * 100, 1),
            'eliminated': round(counts[i]['eliminated'] / n_sims * 100, 1),
        })
    return result


def _simulate_bracket_full(seeded_8: list, n_sims: int):
    """
    Simulate conference bracket with HCA and Bradley-Terry win probability.
    seeded_8: list of 8 team dicts (index 0 = seed 1), each has 'win_pct'.
    Returns (counts_dict, finalists_list).
    """
    counts    = {i: {'r1': 0, 'r2': 0, 'conf': 0} for i in range(8)}
    finalists = []

    def play(a, b):
        # Lower index = higher seed = home court advantage
        p = _bt_prob(seeded_8[a]['win_pct'], seeded_8[b]['win_pct'])
        winner = a if _simulate_series_hca(p, a < b) else b
        return winner

    for _ in range(n_sims):
        # R1: 1v8, 2v7, 3v6, 4v5
        w1 = [play(0, 7), play(1, 6), play(2, 5), play(3, 4)]
        for w in w1:
            counts[w]['r1'] += 1

        # R2: winner(1v8) vs winner(4v5),  winner(2v7) vs winner(3v6)
        w2 = [play(w1[0], w1[3]), play(w1[1], w1[2])]
        for w in w2:
            counts[w]['r2'] += 1

        # Conf finals
        conf_w = play(w2[0], w2[1])
        counts[conf_w]['conf'] += 1
        finalists.append(conf_w)

    return counts, finalists


def _db_team_info(db: Session, season: str) -> dict:
    """Build team info dict from local DB (fallback when live data unavailable)."""
    rows = (
        db.query(models.PlayerStat.team)
        .filter(models.PlayerStat.season == season)
        .distinct()
        .all()
    )
    info = {}
    for (abbr,) in rows:
        stats = _query_team_stats(db, abbr, season)
        if stats is None:
            continue
        avg_pts, avg_reb, avg_ast, _ = stats
        score = (avg_pts * 0.5) + (avg_ast * 0.3) + (avg_reb * 0.2)
        info[abbr] = {
            'team':    abbr,
            'conf':    'East' if abbr in EAST_CONF else 'West',
            'win_pct': score / 20.0,   # rough normalisation into 0-1 range
            'wins':    None,
            'losses':  None,
            'record':  '—',
            'avg_pts': round(avg_pts, 1),
            'avg_reb': round(avg_reb, 1),
            'avg_ast': round(avg_ast, 1),
        }
    return info


# ==========================================
# ENDPOINT: Playoff simulator
# GET /playoff/simulate?season=2024-25&n_sims=5000
# ==========================================
@app.get("/playoff/simulate")
def simulate_playoffs(season: str = "2024-25", n_sims: int = 5000, db: Session = Depends(get_db)):
    import datetime

    # ── 1. Fetch live data (standings + per-game team stats) ─────────────────
    live_standings  = _fetch_live_standings(season)
    live_team_stats = _fetch_live_team_stats(season)

    # Determine what we have and set the source label
    if live_standings and live_team_stats:
        data_source = "live_nba"
        prob_method = "net_rating"     # most accurate
    elif live_standings:
        data_source = "live_standings"
        prob_method = "win_pct"
    else:
        data_source = "db_estimates"
        prob_method = "score"

    # ── 2. Build enriched team list ──────────────────────────────────────────
    db_info = _db_team_info(db, season)

    def enrich(t: dict) -> dict:
        """Merge live team stats (or DB fallback) onto a standings entry."""
        live = live_team_stats.get(t['team'], {}) if live_team_stats else {}
        local = db_info.get(t['team'], {})
        return {
            **t,
            'avg_pts':    live.get('avg_pts')    or local.get('avg_pts'),
            'avg_reb':    live.get('avg_reb')    or local.get('avg_reb'),
            'avg_ast':    live.get('avg_ast')    or local.get('avg_ast'),
            # Use live team-stats net_rating; fall back to standings DiffPointsPG
            'net_rating': live.get('net_rating') or t.get('net_pts', 0.0),
            # Override win_pct with live team-stats value when available
            # (more precise: calculated from all games, not just standings display)
            'win_pct':    live.get('win_pct', t.get('win_pct', 0.5)),
        }

    if live_standings:
        east_all = sorted(
            [enrich(t) for t in live_standings if t['conf'] == 'East'],
            key=lambda t: t['playoff_rank']
        )
        west_all = sorted(
            [enrich(t) for t in live_standings if t['conf'] == 'West'],
            key=lambda t: t['playoff_rank']
        )
    elif live_team_stats:
        # No standings but have team stats — seed by win_pct from live stats
        def from_live_stats(conf_filter):
            teams = []
            for abbr, s in live_team_stats.items():
                db_t = db_info.get(abbr, {})
                is_east = abbr in EAST_CONF
                if conf_filter == 'East' and not is_east: continue
                if conf_filter == 'West' and is_east: continue
                teams.append({
                    'team': abbr, 'conf': conf_filter,
                    'wins': None, 'losses': None,
                    'win_pct': s['win_pct'],
                    'net_rating': s['net_rating'],
                    'record': '—', 'playoff_rank': 99,
                    **{k: s.get(k) or db_t.get(k) for k in ['avg_pts','avg_reb','avg_ast']},
                })
            return sorted(teams, key=lambda t: t['win_pct'], reverse=True)
        east_all = from_live_stats('East')
        west_all = from_live_stats('West')
        for i, t in enumerate(east_all): t['playoff_rank'] = i + 1
        for i, t in enumerate(west_all): t['playoff_rank'] = i + 1
    else:
        # Full fallback: use DB data
        east_all = sorted(
            [t for t in db_info.values() if t['conf'] == 'East'],
            key=lambda t: t['win_pct'], reverse=True
        )
        west_all = sorted(
            [t for t in db_info.values() if t['conf'] == 'West'],
            key=lambda t: t['win_pct'], reverse=True
        )
        for i, t in enumerate(east_all): t['playoff_rank'] = i + 1
        for i, t in enumerate(west_all): t['playoff_rank'] = i + 1

    while len(east_all) < 10: east_all.append(east_all[-1] if east_all else {})
    while len(west_all) < 10: west_all.append(west_all[-1] if west_all else {})

    # ── 3. Win probability function (uses best available metric) ────────────
    def game_prob(team_a: dict, team_b: dict) -> float:
        """Neutral-court win probability for team A."""
        if prob_method == "net_rating":
            return _net_rating_prob(team_a['net_rating'], team_b['net_rating'])
        else:
            return _bt_prob(team_a['win_pct'], team_b['win_pct'])

    # Monkey-patch into _simulate_bracket_full via closure
    def _run_bracket(seeded_8):
        counts    = {i: {'r1': 0, 'r2': 0, 'conf': 0} for i in range(8)}
        finalists = []

        def play(a, b):
            p = game_prob(seeded_8[a], seeded_8[b])
            return a if _simulate_series_hca(p, a < b) else b

        for _ in range(n_sims):
            w1 = [play(0, 7), play(1, 6), play(2, 5), play(3, 4)]
            for w in w1: counts[w]['r1'] += 1
            w2 = [play(w1[0], w1[3]), play(w1[1], w1[2])]
            for w in w2: counts[w]['r2'] += 1
            conf_w = play(w2[0], w2[1])
            counts[conf_w]['conf'] += 1
            finalists.append(conf_w)
        return counts, finalists

    # ── 4. Play-in tournament (seeds 7-10) ──────────────────────────────────
    def run_play_in(teams_7_to_10):
        """Simulate play-in using best available win probability."""
        t      = teams_7_to_10
        counts = [{'made_7th': 0, 'made_8th': 0} for _ in range(4)]

        def g(a, b):
            p = game_prob(t[a], t[b])
            return a if random.random() < p else b

        for _ in range(n_sims):
            w_a = g(0, 1)
            l_a = 1 - w_a
            w_b = g(2, 3)
            w_c = g(l_a, w_b)
            counts[w_a]['made_7th'] += 1
            counts[w_c]['made_8th'] += 1

        return [
            {
                'team':       t[i]['team'],
                'seed':       7 + i,
                'record':     t[i].get('record', '—'),
                'net_rating': round(t[i].get('net_rating', 0), 1),
                'win_pct':    round(t[i].get('win_pct', 0.5), 3),
                'made_7th':   round(counts[i]['made_7th'] / n_sims * 100, 1),
                'made_8th':   round(counts[i]['made_8th'] / n_sims * 100, 1),
                'eliminated': round((n_sims - counts[i]['made_7th'] - counts[i]['made_8th']) / n_sims * 100, 1),
            }
            for i in range(4)
        ]

    east_play_in = run_play_in(east_all[6:10])
    west_play_in = run_play_in(west_all[6:10])

    # Bracket uses seeds 1-6 + current seeds 7 & 8 (most likely play-in winners)
    east_bracket = east_all[:6] + east_all[6:8]
    west_bracket = west_all[:6] + west_all[6:8]

    # ── 5. Conference bracket + NBA Finals ───────────────────────────────────
    east_counts, east_finalists = _run_bracket(east_bracket)
    west_counts, west_finalists = _run_bracket(west_bracket)

    champ_e = {i: 0 for i in range(8)}
    champ_w = {i: 0 for i in range(8)}

    for e_idx, w_idx in zip(east_finalists, west_finalists):
        p = game_prob(east_bracket[e_idx], west_bracket[w_idx])
        if random.random() < p:
            champ_e[e_idx] += 1
        else:
            champ_w[w_idx] += 1

    def build_result(bracket, counts, champ_counts):
        return [
            {
                'seed':        i + 1,
                'team':        bracket[i]['team'],
                'record':      bracket[i].get('record', '—'),
                'win_pct':     round(bracket[i].get('win_pct', 0.5), 3),
                'net_rating':  round(bracket[i].get('net_rating', 0), 1),
                'avg_pts':     bracket[i].get('avg_pts'),
                'avg_reb':     bracket[i].get('avg_reb'),
                'avg_ast':     bracket[i].get('avg_ast'),
                'r1_prob':     round(counts[i]['r1']   / n_sims * 100, 1),
                'r2_prob':     round(counts[i]['r2']   / n_sims * 100, 1),
                'conf_prob':   round(counts[i]['conf'] / n_sims * 100, 1),
                'champ_prob':  round(champ_counts[i]   / n_sims * 100, 1),
            }
            for i in range(len(bracket))
        ]

    return {
        'east':         build_result(east_bracket, east_counts, champ_e),
        'west':         build_result(west_bracket, west_counts, champ_w),
        'east_play_in': east_play_in,
        'west_play_in': west_play_in,
        'n_sims':       n_sims,
        'season':       season,
        'data_source':  data_source,
        'prob_method':  prob_method,
        'fetched_at':   datetime.datetime.utcnow().isoformat() + 'Z',
    }
