"""
Tests for GET /games/upcoming endpoint.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import live_cache

FAKE_UPCOMING = [
    {
        "game_id":   "0022500100",
        "status":    "Upcoming",
        "date":      "2026-03-10",
        "time":      "7:30 pm ET",
        "home_team": {"abbr": "BOS", "name": "Celtics"},
        "away_team": {"abbr": "LAL", "name": "Lakers"},
    }
]

def test_upcoming_schema_fields():
    """UpcomingGame schema accepts the expected shape."""
    from schemas import UpcomingGame
    game = UpcomingGame(**FAKE_UPCOMING[0])
    assert game.game_id == "0022500100"
    assert game.status  == "Upcoming"
    assert game.home_team.abbr == "BOS"
    assert game.away_team.abbr == "LAL"


# ── Fixtures ───────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_cache():
    live_cache.clear()
    yield
    live_cache.clear()


def _make_fake_df(games: list):
    """Build a minimal DataFrame mimicking LeagueSchedule output."""
    import pandas as pd
    rows = []
    for g in games:
        rows.append({
            "GAME_ID":               g["game_id"],
            "GAME_DATE_EST":         g["date"] + "T00:00:00",
            "GAME_STATUS_TEXT":      g["time"],
            "HOME_TEAM_ID":          g["home_id"],
            "HOME_TEAM_ABBREVIATION": g["home_abbr"],
            "HOME_TEAM_NAME":        g["home_name"],
            "VISITOR_TEAM_ID":       g["away_id"],
            "VISITOR_TEAM_ABBREVIATION": g["away_abbr"],
            "VISITOR_TEAM_NAME":     g["away_name"],
        })
    return pd.DataFrame(rows)


# Two games 3 and 6 days from today
import datetime as _dt
_today = _dt.date.today()
FAKE_SCHEDULE_ROWS = [
    {
        "game_id":   "0022500100",
        "date":      (_today + _dt.timedelta(days=3)).isoformat(),
        "time":      "7:30 pm ET",
        "home_id":   1610612738,  # BOS
        "home_abbr": "BOS",
        "home_name": "Celtics",
        "away_id":   1610612747,  # LAL
        "away_abbr": "LAL",
        "away_name": "Lakers",
    },
    {
        "game_id":   "0022500101",
        "date":      (_today + _dt.timedelta(days=6)).isoformat(),
        "time":      "9:00 pm ET",
        "home_id":   1610612744,  # GSW
        "home_abbr": "GSW",
        "home_name": "Warriors",
        "away_id":   1610612749,  # MIL
        "away_abbr": "MIL",
        "away_name": "Bucks",
    },
]


class FakeLeagueSchedule:
    def get_data_frames(self):
        return [_make_fake_df(FAKE_SCHEDULE_ROWS)]


class TestGetUpcomingGames:

    @pytest.fixture(autouse=True)
    def patch_league_schedule(self, monkeypatch):
        import leagueschedule_compat as _ls
        monkeypatch.setattr(_ls, "LeagueSchedule", lambda **kwargs: FakeLeagueSchedule())

    def test_returns_200(self, client):
        assert client.get("/games/upcoming").status_code == 200

    def test_returns_list(self, client):
        data = client.get("/games/upcoming").json()
        assert isinstance(data, list)

    def test_returns_two_games(self, client):
        data = client.get("/games/upcoming").json()
        assert len(data) == 2

    def test_game_has_expected_fields(self, client):
        game = client.get("/games/upcoming").json()[0]
        assert "game_id"   in game
        assert "status"    in game
        assert "date"      in game
        assert "time"      in game
        assert "home_team" in game
        assert "away_team" in game

    def test_status_is_upcoming(self, client):
        game = client.get("/games/upcoming").json()[0]
        assert game["status"] == "Upcoming"

    def test_team_has_abbr_and_name(self, client):
        game = client.get("/games/upcoming").json()[0]
        assert "abbr" in game["home_team"]
        assert "name" in game["home_team"]
        assert "abbr" in game["away_team"]
        assert "name" in game["away_team"]

    def test_games_sorted_by_date(self, client):
        data = client.get("/games/upcoming").json()
        dates = [g["date"] for g in data]
        assert dates == sorted(dates)


class TestGetUpcomingGamesErrorHandling:

    @pytest.fixture(autouse=True)
    def patch_league_schedule_error(self, monkeypatch):
        import leagueschedule_compat as _ls
        def _boom(**kwargs):
            raise RuntimeError("nba_api down")
        monkeypatch.setattr(_ls, "LeagueSchedule", _boom)

    def test_returns_empty_list_on_failure(self, client):
        data = client.get("/games/upcoming").json()
        assert data == []
