# backend/main.py
"""
cd /Users/kevjumba/PycharmProjects/StatStream/backend
@"""
import asyncio
import datetime
import math
import random
import numpy as np
from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from sqlalchemy.orm import Session
from typing import List
from sqlalchemy import func

import models, schemas, predictor
import live_games
import win_probability
import live_cache
import lineup_impact
import leagueschedule_compat as _lsched
import game_tracker
import play_by_play
from database import engine, SessionLocal
from routers.account import router as account_router

models.Base.metadata.create_all(bind=engine)

# ── Safe column migrations ────────────────────────────────────────────────────
# create_all won't add columns to existing tables; use ALTER TABLE for new ones.
from sqlalchemy import text as _text

with engine.connect() as _conn:
    _dialect = engine.dialect.name
    if _dialect == "sqlite":
        # SQLite: check PRAGMA table_info instead of information_schema
        _cols = _conn.execute(_text("PRAGMA table_info(player_stats)")).fetchall()
        _col_names = [row[1] for row in _cols]
        _exists = "position" in _col_names
    else:
        _exists = _conn.execute(_text("""
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'player_stats' AND column_name = 'position'
        """)).fetchone() is not None
    if not _exists:
        _conn.execute(_text("ALTER TABLE player_stats ADD COLUMN position VARCHAR"))
        _conn.commit()

app = FastAPI(title="StatStream API", version="2.0")

# ── Rate limiting ─────────────────────────────────────────────────────────────
# Global default: 100 requests/minute per IP.
# Expensive endpoints override with tighter limits via @limiter.limit().
limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)

import os as _os
_allowed_origins = _os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["GET"],
    allow_headers=["Content-Type"],
    allow_credentials=False,
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


app.include_router(account_router)


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
    # /players/filter also kept here (before {player_id}) to avoid the same conflict
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
# ENDPOINT: Filter players
# GET /players/filter?min_pts=20&season=2024-25
# NOTE: Must be defined BEFORE /players/{player_id} to avoid route conflict.
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
#  PLAYOFF SIMULATOR HELPERS
# ──────────────────────────────────────────────────────────────────────────────
import time

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

# Reverse lookup: abbreviation → TeamID
_ABBR_TO_TEAM_ID: dict[str, int] = {v: k for k, v in _TEAM_ID_TO_ABBR.items()}

# NBA home-court advantage per game (historical ~3 pp)
_HCA = 0.03

# Simple 1-hour in-memory cache for live data
_standings_cache: dict   = {}
_team_stats_cache: dict  = {}
_dashboard_cache: dict   = {}
_schedule_cache: dict    = {}
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
@limiter.limit("5/minute")
def simulate_playoffs(
    request: Request,
    season: str = "2024-25",
    n_sims: int = Query(default=5000, ge=100, le=25000),
    db: Session = Depends(get_db),
):

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


# ==========================================
# ENDPOINT: Team Dashboard
# GET /teams/{team_abbr}/dashboard?season=2024-25
# ==========================================
@app.get("/teams/{team_abbr}/dashboard")
def team_dashboard(team_abbr: str, season: str = "2024-25"):
    import concurrent.futures
    team_abbr = team_abbr.upper()
    team_id   = _ABBR_TO_TEAM_ID.get(team_abbr)

    cache_key = (team_abbr, season)
    cached = _dashboard_cache.get(cache_key)
    if cached and time.time() - cached['ts'] < _CACHE_TTL:
        return cached['data']

    def fetch_team_stats():
        try:
            from nba_api.stats.endpoints import leaguedashteamstats as _ldt2
            time.sleep(0.6)
            raw = _ldt2.LeagueDashTeamStats(season=season, per_mode_detailed='PerGame')
            df  = raw.get_data_frames()[0]
            row = df[df['TEAM_ID'] == team_id]
            if not row.empty:
                r   = row.iloc[0]
                w   = int(r.get('W',          0) or 0)
                l   = int(r.get('L',          0) or 0)
                ppg = round(float(r.get('PTS',        0) or 0), 1)
                pm  = round(float(r.get('PLUS_MINUS', 0) or 0), 1)
                ast = round(float(r.get('AST',        0) or 0), 1)
                tov = round(float(r.get('TOV',        0) or 0), 1)
                return {
                    "wins":         w,
                    "losses":       l,
                    "record":       f"{w}-{l}",
                    "ppg":          ppg,
                    "opp_ppg":      round(ppg - pm, 1),
                    "ast_per_game": ast,
                    "tov_per_game": tov,
                    "ast_to_ratio": round(ast / tov, 2) if tov > 0 else 0.0,
                    "reb_per_game": round(float(r.get('REB', 0) or 0), 1),
                    "plus_minus":   pm,
                }
        except Exception as e:
            print(f"[StatStream] Team dashboard stats failed: {e}")
        return None

    def fetch_game_log():
        if not team_id:
            return []
        try:
            import pandas as _pd
            from nba_api.stats.endpoints import leaguegamefinder as _lgf
            time.sleep(0.6)
            finder = _lgf.LeagueGameFinder(
                team_id_nullable=team_id,
                season_nullable=season,
                season_type_nullable='Regular Season',
            )
            df_log = finder.get_data_frames()[0]
            df_log['PTS']        = _pd.to_numeric(df_log['PTS'],        errors='coerce').fillna(0).astype(int)
            df_log['PLUS_MINUS'] = _pd.to_numeric(df_log['PLUS_MINUS'], errors='coerce').fillna(0).astype(int)
            games = []
            for _, g in df_log.head(15).iterrows():
                matchup = str(g.get('MATCHUP', ''))
                pts     = int(g['PTS'])
                pm_g    = int(g['PLUS_MINUS'])
                games.append({
                    "date":       str(g.get('GAME_DATE', '')),
                    "matchup":    matchup,
                    "opponent":   matchup.split(' ')[-1],
                    "home":       'vs.' in matchup,
                    "wl":         str(g.get('WL', '')),
                    "pts":        pts,
                    "opp_pts":    pts - pm_g,
                    "plus_minus": pm_g,
                })
            return games
        except Exception as e:
            print(f"[StatStream] Game log fetch failed: {e}")
        return []

    # Run both fetches concurrently instead of sequentially
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        fut_stats    = executor.submit(fetch_team_stats)
        fut_game_log = executor.submit(fetch_game_log)
        stats    = fut_stats.result()
        game_log = fut_game_log.result()

    result = {
        "team":     team_abbr,
        "season":   season,
        "stats":    stats,
        "game_log": game_log,
        "upcoming": [],
    }

    _dashboard_cache[cache_key] = {'data': result, 'ts': time.time()}
    return result


# ==========================================
# ENDPOINT: Team Lineup Impact Analysis
# GET /teams/{abbr}/lineups
# ==========================================
@app.get("/teams/{abbr}/lineups", response_model=schemas.LineupResponse)
@limiter.limit("20/minute")
async def get_team_lineups(
    request: Request,
    abbr:        str,
    season:      str   = "2025-26",
    min_minutes: float = 20.0,
    sort_by:     str   = "net_rating",
    limit:       int   = 20,
):
    try:
        data = await asyncio.to_thread(
            lineup_impact.get_lineup_summaries,
            team_abbr=abbr,
            season=season,
            min_minutes=min_minutes,
            sort_by=sort_by,
            limit=limit,
        )
        return data
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to fetch lineup data: {exc}")


# ==========================================
# ENDPOINT: Team Upcoming Schedule
# GET /teams/{team_abbr}/schedule
# Separate from dashboard so the dashboard loads fast; frontend fetches async.
# ==========================================
@app.get("/teams/{team_abbr}/schedule")
def team_schedule(team_abbr: str, season: str = "2024-25"):
    import datetime as _dt
    team_abbr = team_abbr.upper()
    team_id   = _ABBR_TO_TEAM_ID.get(team_abbr)
    if not team_id:
        return []

    # Cache by team + calendar date (schedule doesn't change intraday)
    cache_key = (team_abbr, str(_dt.date.today()))
    cached = _schedule_cache.get(cache_key)
    if cached is not None:
        return cached

    today = _dt.date.today()

    def _safe_int(val):
        try:
            f = float(val)
            return 0 if f != f else int(round(f))
        except (TypeError, ValueError):
            return 0

    # ── Try LeagueSchedule: single API call for the whole season ────────────
    try:
        time.sleep(0.6)
        sched  = _lsched.LeagueSchedule(league_id='00', season_year=season, game_type='2')
        df_all = sched.get_data_frames()[0]

        # Build list of future games for this team, then sort by date
        candidates = []
        for _, g in df_all.iterrows():
            h_id = _safe_int(g.get('HOME_TEAM_ID', 0))
            v_id = _safe_int(g.get('VISITOR_TEAM_ID', 0))
            if h_id != team_id and v_id != team_id:
                continue
            # LeagueSchedule uses GAME_DATE_EST (e.g. "2025-01-15T00:00:00")
            raw_date = str(g.get('GAME_DATE_EST', '') or g.get('GAME_DATE', ''))
            try:
                game_date = _dt.date.fromisoformat(raw_date[:10])
            except ValueError:
                continue
            if game_date <= today:
                continue
            is_home  = (h_id == team_id)
            opp_id   = v_id if is_home else h_id
            opp_abbr = _TEAM_ID_TO_ABBR.get(opp_id, '')
            candidates.append({
                "date":     game_date.isoformat(),
                "time":     str(g.get('GAME_STATUS_TEXT', '')),
                "opponent": opp_abbr,
                "home":     is_home,
            })
        upcoming = sorted(candidates, key=lambda x: x['date'])[:5]

        _schedule_cache[cache_key] = upcoming
        return upcoming

    except Exception as e:
        print(f"[StatStream] LeagueSchedule fetch failed, falling back to ScoreboardV2: {e}")

    # ── Fallback: ScoreboardV2 day-by-day (result still cached) ─────────────
    try:
        from nba_api.stats.endpoints import scoreboardv2 as _sbv2
        upcoming   = []
        check_date = today
        days_ahead = 0
        while len(upcoming) < 5 and days_ahead < 14:
            days_ahead += 1
            check_date += _dt.timedelta(days=1)
            try:
                time.sleep(0.4)
                sb     = _sbv2.ScoreboardV2(game_date=check_date.strftime('%m/%d/%Y'), league_id='00')
                df_hdr = sb.get_data_frames()[0]
                for _, g in df_hdr.iterrows():
                    h_id = _safe_int(g.get('HOME_TEAM_ID',    0))
                    v_id = _safe_int(g.get('VISITOR_TEAM_ID', 0))
                    if h_id == team_id or v_id == team_id:
                        is_home  = (h_id == team_id)
                        opp_id   = v_id if is_home else h_id
                        opp_abbr = _TEAM_ID_TO_ABBR.get(opp_id, '')
                        upcoming.append({
                            "date":     check_date.isoformat(),
                            "time":     str(g.get('GAME_STATUS_TEXT', '')),
                            "opponent": opp_abbr,
                            "home":     is_home,
                        })
                        break
            except Exception:
                pass
        _schedule_cache[cache_key] = upcoming
        return upcoming
    except Exception as e:
        print(f"[StatStream] Schedule fetch failed: {e}")
        return []


# ==========================================
# ENDPOINT: Live games (no probabilities)
# GET /games/live
# ==========================================
@app.get("/games/live")
def get_live_games():
    cached = live_cache.get("live_games")
    if cached is not None:
        return cached

    games = live_games.fetch_live_games()
    result = [
        {
            "game_id":    g["game_id"],
            "status":     g["status"],
            "period":     g["period"],
            "clock":      g["clock"],
            "home_team":  dict(g["home_team"]),
            "away_team":  dict(g["away_team"]),
            "last_updated": g["last_updated"],
        }
        for g in games
    ]
    live_cache.set("live_games", result, ttl=20)
    return result


# ==========================================
# ENDPOINT: Live games with win probability
# GET /games/live/probabilities
# ==========================================
@app.get("/games/live/probabilities")
def get_live_probabilities():
    cached = live_cache.get("live_probabilities")
    if cached is not None:
        return cached

    games = live_games.fetch_live_games()

    # Build win-pct lookup for pregame probability
    import datetime as _dt
    _season = (lambda t: f"{t.year-1}-{str(t.year)[2:]}" if t.month < 10 else f"{t.year}-{str(t.year+1)[2:]}")(_dt.date.today())
    _standings = _fetch_live_standings(_season)
    _win_pct = {s["team"]: s["win_pct"] for s in _standings} if _standings else {}

    result = []
    for g in games:
        game_id = g["game_id"]
        period = g["period"]
        clock  = g["clock"]
        is_upcoming = g["status"] == "Upcoming"

        if is_upcoming:
            home_pct = _win_pct.get(g["home_team"]["abbr"], 0.5)
            away_pct = _win_pct.get(g["away_team"]["abbr"], 0.5)
            home_prob, away_prob = win_probability.pregame_predict(home_pct, away_pct)
            prob_history = []
            new_scoring_plays = []
        else:
            home_score = g["home_team"]["score"]
            away_score = g["away_team"]["score"]
            home_prob, away_prob = win_probability.predict(home_score, away_score, period, clock)

            # Backfill full game history on first encounter
            if not game_tracker.is_backfilled(game_id):
                historical = play_by_play.fetch_full_game_history(game_id)
                for p in historical:
                    h_prob, _ = win_probability.predict(
                        p["score_home"], p["score_away"], p["period"], p["clock"]
                    )
                    game_tracker.record_prob(game_id, p["period"], p["clock"], h_prob)
                if historical:
                    game_tracker.add_scoring_plays(
                        game_id, [], max(p["action_number"] for p in historical)
                    )
                game_tracker.mark_backfilled(game_id)

            # Record probability snapshot
            game_tracker.record_prob(game_id, period, clock, home_prob)

            # Fetch new scoring plays (cached per game for 5s)
            pbp_cache_key = f"pbp_{game_id}"
            cached_pbp = live_cache.get(pbp_cache_key)
            if cached_pbp is not None:
                plays, max_num = cached_pbp
            else:
                plays, max_num = play_by_play.fetch_scoring_plays(
                    game_id, game_tracker.get_last_action_number(game_id)
                )
                live_cache.set(pbp_cache_key, (plays, max_num), ttl=5)
            game_tracker.add_scoring_plays(game_id, plays, max_num)

            prob_history = game_tracker.get_prob_history(game_id)
            new_scoring_plays = game_tracker.drain_new_plays(game_id)

        entry = {
            "game_id": game_id,
            "status":  g["status"],
            "period":  period,
            "clock":   clock,
            "home_team": {
                **g["home_team"],
                "win_probability": home_prob,
            },
            "away_team": {
                **g["away_team"],
                "win_probability": away_prob,
            },
            "last_updated": g["last_updated"],
            "model_type": "pregame_log5" if is_upcoming else "logistic",
            "prob_history": prob_history,
            "new_scoring_plays": new_scoring_plays,
        }
        if is_upcoming:
            entry["date"] = g.get("date", "")
            entry["time"] = g.get("time", "")
        result.append(entry)

    live_cache.set("live_probabilities", result, ttl=5)
    return result


# ==========================================
# ENDPOINT: League-wide upcoming games
# GET /games/upcoming
# ==========================================
@app.get("/games/upcoming")
def get_upcoming_games():
    import datetime as _dt

    cache_key = f"upcoming_games_{_dt.date.today().isoformat()}"
    cached = live_cache.get(cache_key)
    if cached is not None:
        return cached

    today    = _dt.date.today()
    tomorrow = today + _dt.timedelta(days=1)

    try:
        time.sleep(0.6)
        season_year = f"{today.year - 1}-{str(today.year)[2:]}" if today.month < 10 else f"{today.year}-{str(today.year + 1)[2:]}"
        sched  = _lsched.LeagueSchedule(league_id='00', season_year=season_year, game_type='2')
        df_all = sched.get_data_frames()[0]

        candidates = []
        for _, g in df_all.iterrows():
            raw_date = str(g.get('GAME_DATE_EST', '') or g.get('GAME_DATE', ''))
            try:
                game_date = _dt.date.fromisoformat(raw_date[:10])
            except ValueError:
                continue
            if game_date != tomorrow:
                continue
            candidates.append({
                "game_id": str(g.get('GAME_ID', '')),
                "status":  "Upcoming",
                "date":    game_date.isoformat(),
                "time":    str(g.get('GAME_STATUS_TEXT', '')),
                "home_team": {
                    "abbr": str(g.get('HOME_TEAM_ABBREVIATION', '')),
                    "name": str(g.get('HOME_TEAM_NAME', '')),
                },
                "away_team": {
                    "abbr": str(g.get('VISITOR_TEAM_ABBREVIATION', '')),
                    "name": str(g.get('VISITOR_TEAM_NAME', '')),
                },
            })

        result = sorted(candidates, key=lambda x: x['date'])
        live_cache.set(cache_key, result, ttl=3600)
        return result

    except Exception as e:
        print(f"[StatStream] Upcoming games fetch failed: {e}")
        return []
