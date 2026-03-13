"""Tests for backend/boxscore.py — patched so no real NBA API calls are made."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import live_cache


# ── Fake NBA API response ──────────────────────────────────────────────────────

def _fake_bs_data():
    """Minimal shape matching nba_api BoxScore .get_dict() output."""
    return {
        "game": {
            "homeTeam": {
                "teamTricode": "LAL",
                "statistics": {
                    "fieldGoalsMade": 38, "fieldGoalsAttempted": 85,
                    "fieldGoalsPercentage": 44.7,
                    "threePointersMade": 12, "threePointersAttempted": 31,
                    "threePointersPercentage": 38.7,
                    "freeThrowsMade": 18, "freeThrowsAttempted": 22,
                    "freeThrowsPercentage": 81.8,
                    "reboundsTotal": 42, "assists": 24,
                    "steals": 7, "blocks": 4, "turnovers": 11, "points": 106,
                },
                "players": [
                    {
                        "name": "LeBron James", "nameI": "L. James",
                        "jerseyNum": "23", "position": "F", "starter": "1",
                        "statistics": {
                            "minutesCalculated": "PT34M21.00S",
                            "points": 28, "reboundsTotal": 8, "assists": 5,
                            "steals": 2, "blocks": 1,
                            "fieldGoalsMade": 11, "fieldGoalsAttempted": 22,
                            "threePointersMade": 3, "threePointersAttempted": 8,
                            "freeThrowsMade": 3, "freeThrowsAttempted": 4,
                            "turnovers": 2,
                        },
                    },
                ],
            },
            "awayTeam": {
                "teamTricode": "BOS",
                "statistics": {
                    "fieldGoalsMade": 35, "fieldGoalsAttempted": 80,
                    "fieldGoalsPercentage": 43.8,
                    "threePointersMade": 10, "threePointersAttempted": 28,
                    "threePointersPercentage": 35.7,
                    "freeThrowsMade": 20, "freeThrowsAttempted": 24,
                    "freeThrowsPercentage": 83.3,
                    "reboundsTotal": 40, "assists": 22,
                    "steals": 5, "blocks": 3, "turnovers": 13, "points": 100,
                },
                "players": [],
            },
        }
    }


class FakeBoxScore:
    def __init__(self, game_id):
        self._data = _fake_bs_data()

    def get_dict(self):
        return self._data


# ── Tests ──────────────────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def clear_cache():
    live_cache.clear()
    yield
    live_cache.clear()


class TestFetchLiveBoxscore:

    def test_returns_dict_with_home_and_away(self, monkeypatch):
        import boxscore as bs_module
        monkeypatch.setattr(bs_module, "_BoxScore", FakeBoxScore)
        result = bs_module.fetch_live_boxscore("0022500001")
        assert result is not None
        assert "home" in result
        assert "away" in result

    def test_home_team_stats_present(self, monkeypatch):
        import boxscore as bs_module
        monkeypatch.setattr(bs_module, "_BoxScore", FakeBoxScore)
        result = bs_module.fetch_live_boxscore("0022500001")
        ts = result["home"]["team_stats"]
        assert ts["pts"] == 106
        assert ts["ast"] == 24
        assert ts["reb"] == 42

    def test_home_team_stats_shooting(self, monkeypatch):
        import boxscore as bs_module
        monkeypatch.setattr(bs_module, "_BoxScore", FakeBoxScore)
        result = bs_module.fetch_live_boxscore("0022500001")
        ts = result["home"]["team_stats"]
        assert ts["fgm"] == 38
        assert ts["fga"] == 85
        assert abs(ts["fg_pct"] - 44.7) < 0.1

    def test_players_list_present(self, monkeypatch):
        import boxscore as bs_module
        monkeypatch.setattr(bs_module, "_BoxScore", FakeBoxScore)
        result = bs_module.fetch_live_boxscore("0022500001")
        assert isinstance(result["home"]["players"], list)
        assert len(result["home"]["players"]) == 1

    def test_player_fields(self, monkeypatch):
        import boxscore as bs_module
        monkeypatch.setattr(bs_module, "_BoxScore", FakeBoxScore)
        result = bs_module.fetch_live_boxscore("0022500001")
        p = result["home"]["players"][0]
        assert p["name"] == "LeBron James"
        assert p["pts"] == 28
        assert p["starter"] is True
        assert p["min"] == "34:21"

    def test_returns_none_on_api_error(self, monkeypatch):
        import boxscore as bs_module
        def boom(game_id):
            raise RuntimeError("API down")
        monkeypatch.setattr(bs_module, "_BoxScore", boom)
        result = bs_module.fetch_live_boxscore("0022500001")
        assert result is None

    def test_caches_result(self, monkeypatch):
        import boxscore as bs_module
        call_count = {"n": 0}
        class CountingFakeBS(FakeBoxScore):
            def __init__(self, game_id):
                call_count["n"] += 1
                super().__init__(game_id)
        monkeypatch.setattr(bs_module, "_BoxScore", CountingFakeBS)
        bs_module.fetch_live_boxscore("0022500001")
        bs_module.fetch_live_boxscore("0022500001")
        assert call_count["n"] == 1  # second call hits cache
