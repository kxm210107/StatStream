"""
Integration tests for all StatStream API endpoints.
======================================================
Uses FastAPI's TestClient + an in-memory SQLite database
(seeded in conftest.py) — no PostgreSQL connection required.

Run with:
    cd /Users/kevjumba/PycharmProjects/StatStream/backend
    pytest tests/ -v
"""

import pytest


# ── Health check ──────────────────────────────────────────────────────────────

class TestRoot:

    def test_returns_200(self, client):
        res = client.get("/")
        assert res.status_code == 200

    def test_contains_message(self, client):
        data = res = client.get("/").json()
        assert "message" in data
        assert "StatStream" in data["message"]

    def test_contains_ml_model_ready_flag(self, client):
        data = client.get("/").json()
        assert "ml_model_ready" in data
        assert isinstance(data["ml_model_ready"], bool)


# ── Seasons ───────────────────────────────────────────────────────────────────

class TestSeasons:

    def test_returns_200(self, client):
        assert client.get("/seasons").status_code == 200

    def test_returns_list(self, client):
        data = client.get("/seasons").json()
        assert isinstance(data, list)

    def test_contains_seeded_seasons(self, client):
        seasons = client.get("/seasons").json()
        assert "2024-25" in seasons
        assert "2023-24" in seasons

    def test_newest_first(self, client):
        seasons = client.get("/seasons").json()
        assert seasons == sorted(seasons, reverse=True), "Seasons should be newest first"


# ── Players (all) ─────────────────────────────────────────────────────────────

class TestGetAllPlayers:

    def test_returns_200(self, client):
        assert client.get("/players?season=2024-25").status_code == 200

    def test_returns_list(self, client):
        data = client.get("/players?season=2024-25").json()
        assert isinstance(data, list)

    def test_returns_correct_season_only(self, client):
        data = client.get("/players?season=2024-25").json()
        assert all(p["season"] == "2024-25" for p in data)

    def test_player_schema_has_required_fields(self, client):
        players = client.get("/players?season=2024-25").json()
        assert len(players) > 0
        p = players[0]
        for field in ("player_id", "player_name", "team", "season",
                      "pts_per_game", "reb_per_game", "ast_per_game"):
            assert field in p, f"Missing field: {field}"

    def test_unknown_season_returns_empty_list(self, client):
        data = client.get("/players?season=1900-01").json()
        assert data == []

    def test_lal_players_in_2024_25(self, client):
        players = client.get("/players?season=2024-25").json()
        lal = [p for p in players if p["team"] == "LAL"]
        assert len(lal) == 3  # matches our seed data

    def test_lal_players_in_2023_24(self, client):
        players = client.get("/players?season=2023-24").json()
        lal = [p for p in players if p["team"] == "LAL"]
        assert len(lal) == 2  # only 2 LAL players seeded for 2023-24


# ── Single player ─────────────────────────────────────────────────────────────

class TestGetPlayer:

    def test_returns_known_player(self, client):
        res = client.get("/players/1?season=2024-25")
        assert res.status_code == 200
        data = res.json()
        assert data["player_name"] == "LeBron James"
        assert data["team"] == "LAL"
        assert data["season"] == "2024-25"

    def test_unknown_player_returns_404(self, client):
        assert client.get("/players/999999?season=2024-25").status_code == 404

    def test_wrong_season_returns_404(self, client):
        # player_id 6 (Tatum) only exists in 2024-25, not 2023-24
        assert client.get("/players/6?season=2023-24").status_code == 404


# ── Top scorers ───────────────────────────────────────────────────────────────

class TestTopScorers:

    def test_returns_200(self, client):
        assert client.get("/players/top/scorers?season=2024-25").status_code == 200

    def test_sorted_descending_by_pts(self, client):
        players = client.get("/players/top/scorers?season=2024-25").json()
        pts = [p["pts_per_game"] for p in players]
        assert pts == sorted(pts, reverse=True), "Players should be sorted by PPG desc"

    def test_limit_is_respected(self, client):
        players = client.get("/players/top/scorers?limit=2&season=2024-25").json()
        assert len(players) <= 2

    def test_season_filter_works(self, client):
        players_25 = client.get("/players/top/scorers?season=2024-25").json()
        players_24 = client.get("/players/top/scorers?season=2023-24").json()
        # 2024-25 has more seed players than 2023-24
        assert len(players_25) > len(players_24)


class TestPlayerSearch:

    def test_returns_200(self, client):
        assert client.get("/players/search?q=LeBron&season=2024-25").status_code == 200

    def test_returns_list(self, client):
        data = client.get("/players/search?q=LeBron&season=2024-25").json()
        assert isinstance(data, list)

    def test_finds_lebron(self, client):
        data = client.get("/players/search?q=LeBron&season=2024-25").json()
        assert len(data) >= 1
        assert data[0]["player_name"] == "LeBron James"

    def test_empty_query_returns_empty(self, client):
        data = client.get("/players/search?q=&season=2024-25").json()
        assert data == []

    def test_short_query_returns_empty(self, client):
        data = client.get("/players/search?q=L&season=2024-25").json()
        assert data == []

    def test_partial_name_match(self, client):
        data = client.get("/players/search?q=james&season=2024-25").json()
        names = [p["player_name"] for p in data]
        assert "LeBron James" in names

    def test_wrong_season_returns_empty(self, client):
        data = client.get("/players/search?q=LeBron&season=1900-01").json()
        assert data == []


# ── Team roster ───────────────────────────────────────────────────────────────

class TestPlayersByTeam:

    def test_returns_lal_roster(self, client):
        players = client.get("/players/team/LAL?season=2024-25").json()
        assert len(players) == 3
        names = {p["player_name"] for p in players}
        assert "LeBron James" in names

    def test_case_insensitive(self, client):
        lower = client.get("/players/team/lal?season=2024-25").json()
        upper = client.get("/players/team/LAL?season=2024-25").json()
        assert len(lower) == len(upper)

    def test_unknown_team_returns_empty_list(self, client):
        data = client.get("/players/team/XYZ?season=2024-25").json()
        assert data == []

    def test_correct_season_filter(self, client):
        players_25 = client.get("/players/team/LAL?season=2024-25").json()
        players_24 = client.get("/players/team/LAL?season=2023-24").json()
        # 2023-24 only has 2 LAL players in seed data
        assert len(players_25) == 3
        assert len(players_24) == 2


# ── Teams list ────────────────────────────────────────────────────────────────

class TestGetTeams:

    def test_returns_200(self, client):
        assert client.get("/teams?season=2024-25").status_code == 200

    def test_returns_list_of_strings(self, client):
        teams = client.get("/teams?season=2024-25").json()
        assert isinstance(teams, list)
        assert all(isinstance(t, str) for t in teams)

    def test_contains_seeded_teams(self, client):
        teams = client.get("/teams?season=2024-25").json()
        for team in ("LAL", "GSW", "BOS"):
            assert team in teams

    def test_sorted_alphabetically(self, client):
        teams = client.get("/teams?season=2024-25").json()
        assert teams == sorted(teams)

    def test_no_duplicates(self, client):
        teams = client.get("/teams?season=2024-25").json()
        assert len(teams) == len(set(teams))

    def test_unknown_season_returns_empty_list(self, client):
        assert client.get("/teams?season=1900-01").json() == []


# ── League averages ───────────────────────────────────────────────────────────

class TestLeagueAverages:

    def test_returns_200(self, client):
        assert client.get("/stats/averages?season=2024-25").status_code == 200

    def test_returns_three_averages(self, client):
        data = client.get("/stats/averages?season=2024-25").json()
        assert "avg_pts" in data
        assert "avg_reb" in data
        assert "avg_ast" in data

    def test_averages_are_positive(self, client):
        data = client.get("/stats/averages?season=2024-25").json()
        assert data["avg_pts"] > 0
        assert data["avg_reb"] > 0
        assert data["avg_ast"] > 0


# ── Team comparison ───────────────────────────────────────────────────────────

class TestCompareTeams:

    def test_returns_200(self, client):
        res = client.get("/teams/compare?team1=LAL&team2=GSW&home=LAL&season=2024-25")
        assert res.status_code == 200

    def test_response_schema(self, client):
        data = client.get(
            "/teams/compare?team1=LAL&team2=GSW&home=LAL&season=2024-25"
        ).json()
        # Top-level keys
        for key in ("team1", "team2", "home_team", "model_type"):
            assert key in data, f"Missing top-level key: {key}"
        # TeamStats keys
        for side in ("team1", "team2"):
            for field in ("team", "avg_pts", "avg_reb", "avg_ast",
                          "player_count", "score", "win_probability"):
                assert field in data[side], f"Missing {side}.{field}"

    def test_probabilities_sum_to_100(self, client):
        data = client.get(
            "/teams/compare?team1=LAL&team2=GSW&home=LAL&season=2024-25"
        ).json()
        total = data["team1"]["win_probability"] + data["team2"]["win_probability"]
        assert abs(total - 100.0) < 0.5, f"Probabilities sum to {total}, expected 100"

    def test_model_type_is_valid(self, client):
        data = client.get(
            "/teams/compare?team1=LAL&team2=GSW&home=LAL&season=2024-25"
        ).json()
        assert data["model_type"] in ("ml", "weighted")

    def test_home_team_is_reflected(self, client):
        data = client.get(
            "/teams/compare?team1=LAL&team2=GSW&home=GSW&season=2024-25"
        ).json()
        assert data["home_team"] == "GSW"

    def test_home_advantage_boosts_probability(self, client):
        """
        Running the same matchup twice, swapping home team —
        the home team should have higher win probability each time.
        """
        lal_home = client.get(
            "/teams/compare?team1=LAL&team2=GSW&home=LAL&season=2024-25"
        ).json()
        gsw_home = client.get(
            "/teams/compare?team1=LAL&team2=GSW&home=GSW&season=2024-25"
        ).json()
        # LAL wins more when they are at home
        assert lal_home["team1"]["win_probability"] > gsw_home["team1"]["win_probability"], (
            "LAL should have a higher win probability when playing at home"
        )

    def test_unknown_team_returns_404(self, client):
        res = client.get(
            "/teams/compare?team1=XYZ&team2=LAL&home=XYZ&season=2024-25"
        )
        assert res.status_code == 404

    def test_team_abbreviations_in_response(self, client):
        data = client.get(
            "/teams/compare?team1=lal&team2=gsw&home=lal&season=2024-25"
        ).json()
        assert data["team1"]["team"] == "LAL"
        assert data["team2"]["team"] == "GSW"

    def test_player_counts_are_correct(self, client):
        data = client.get(
            "/teams/compare?team1=LAL&team2=BOS&home=LAL&season=2024-25"
        ).json()
        assert data["team1"]["player_count"] == 3  # LAL: 3 seed players
        assert data["team2"]["player_count"] == 2  # BOS: 2 seed players

    def test_win_probabilities_are_in_range(self, client):
        data = client.get(
            "/teams/compare?team1=LAL&team2=GSW&home=LAL&season=2024-25"
        ).json()
        for side in ("team1", "team2"):
            prob = data[side]["win_probability"]
            assert 0 <= prob <= 100, f"{side} probability {prob} out of [0, 100]"
