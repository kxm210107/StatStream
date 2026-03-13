"""
Integration tests for /games/live and /games/live/probabilities.
Uses the existing TestClient fixture from conftest.py.
nba_api calls are monkeypatched so tests run offline.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import live_cache


# ── Fixtures ───────────────────────────────────────────────────────────────────

FAKE_GAMES = [
    {
        "game_id":   "0022500001",
        "status":    "Live",
        "period":    3,
        "clock":     "05:30",
        "home_team": {"abbr": "LAL", "name": "Lakers", "score": 78},
        "away_team": {"abbr": "BOS", "name": "Celtics", "score": 74},
        "last_updated": "2026-03-09T20:00:00Z",
    }
]


@pytest.fixture(autouse=True)
def patch_live_games(monkeypatch):
    """Replace fetch_live_games with a deterministic fake."""
    import live_games
    import play_by_play
    import game_tracker
    monkeypatch.setattr(live_games, "fetch_live_games", lambda: FAKE_GAMES)
    monkeypatch.setattr(play_by_play, "fetch_scoring_plays", lambda gid, since: ([], since))
    monkeypatch.setattr(play_by_play, "fetch_full_game_history", lambda gid: [])
    game_tracker.clear_all()
    live_cache.clear()
    yield
    game_tracker.clear_all()
    live_cache.clear()


# ── /games/live ────────────────────────────────────────────────────────────────

class TestGetLiveGames:

    def test_returns_200(self, client):
        assert client.get("/games/live").status_code == 200

    def test_returns_list(self, client):
        data = client.get("/games/live").json()
        assert isinstance(data, list)

    def test_game_has_expected_fields(self, client):
        game = client.get("/games/live").json()[0]
        assert "game_id"    in game
        assert "home_team"  in game
        assert "away_team"  in game
        assert "period"     in game
        assert "clock"      in game

    def test_returns_empty_list_when_no_live_games(self, client, monkeypatch):
        import live_games
        monkeypatch.setattr(live_games, "fetch_live_games", lambda: [])
        live_cache.clear()
        data = client.get("/games/live").json()
        assert data == []


# ── /games/live/probabilities ──────────────────────────────────────────────────

class TestGetLiveProbabilities:

    def test_returns_200(self, client):
        assert client.get("/games/live/probabilities").status_code == 200

    def test_returns_list(self, client):
        data = client.get("/games/live/probabilities").json()
        assert isinstance(data, list)

    def test_probabilities_present(self, client):
        game = client.get("/games/live/probabilities").json()[0]
        assert "win_probability" in game["home_team"]
        assert "win_probability" in game["away_team"]

    def test_probabilities_sum_to_one(self, client):
        game = client.get("/games/live/probabilities").json()[0]
        total = game["home_team"]["win_probability"] + game["away_team"]["win_probability"]
        assert abs(total - 1.0) < 0.01

    def test_home_team_leading_has_higher_probability(self, client):
        # LAL leads 78-74 in Q3 in fake data
        game = client.get("/games/live/probabilities").json()[0]
        assert game["home_team"]["win_probability"] > game["away_team"]["win_probability"]

    def test_model_type_present(self, client):
        game = client.get("/games/live/probabilities").json()[0]
        assert "model_type" in game


class TestLiveProbabilitiesNewFields:

    def test_prob_history_present(self, client):
        game = client.get("/games/live/probabilities").json()[0]
        assert "prob_history" in game

    def test_prob_history_is_list(self, client):
        game = client.get("/games/live/probabilities").json()[0]
        assert isinstance(game["prob_history"], list)

    def test_new_scoring_plays_present(self, client):
        game = client.get("/games/live/probabilities").json()[0]
        assert "new_scoring_plays" in game

    def test_new_scoring_plays_is_list(self, client):
        game = client.get("/games/live/probabilities").json()[0]
        assert isinstance(game["new_scoring_plays"], list)

    def test_prob_history_accumulates_across_calls(self, client):
        import live_cache, game_tracker
        game_tracker.clear_all()
        live_cache.clear()
        client.get("/games/live/probabilities")
        live_cache.clear()  # force second fetch
        client.get("/games/live/probabilities")
        live_cache.clear()
        game = client.get("/games/live/probabilities").json()[0]
        assert len(game["prob_history"]) >= 1


class TestLiveProbabilitiesBoxScore:

    def test_box_score_field_present(self, client, monkeypatch):
        import boxscore as bs_module
        monkeypatch.setattr(bs_module, "fetch_live_boxscore", lambda gid: {
            "home": {"team_stats": {"pts": 78}, "players": []},
            "away": {"team_stats": {"pts": 74}, "players": []},
        })
        live_cache.clear()
        game = client.get("/games/live/probabilities").json()[0]
        assert "box_score" in game

    def test_box_score_has_home_and_away(self, client, monkeypatch):
        import boxscore as bs_module
        monkeypatch.setattr(bs_module, "fetch_live_boxscore", lambda gid: {
            "home": {"team_stats": {"pts": 78}, "players": []},
            "away": {"team_stats": {"pts": 74}, "players": []},
        })
        live_cache.clear()
        game = client.get("/games/live/probabilities").json()[0]
        assert "home" in game["box_score"]
        assert "away" in game["box_score"]

    def test_box_score_null_when_fetch_fails(self, client, monkeypatch):
        import boxscore as bs_module
        monkeypatch.setattr(bs_module, "fetch_live_boxscore", lambda gid: None)
        live_cache.clear()
        game = client.get("/games/live/probabilities").json()[0]
        assert game["box_score"] is None

    def test_upcoming_games_have_no_box_score(self, client, monkeypatch):
        import live_games
        monkeypatch.setattr(live_games, "fetch_live_games", lambda: [{
            "game_id": "0022500099",
            "status": "Upcoming",
            "date": "2026-03-12",
            "time": "7:30 pm ET",
            "period": 0, "clock": "--",
            "home_team": {"abbr": "LAL", "name": "Lakers", "score": 0},
            "away_team": {"abbr": "BOS", "name": "Celtics", "score": 0},
            "last_updated": "2026-03-12T00:00:00Z",
        }])
        live_cache.clear()
        game = client.get("/games/live/probabilities").json()[0]
        assert game.get("box_score") is None
