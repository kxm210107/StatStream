"""Tests for GET /teams/{abbr}/lineups endpoint."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest

FAKE_RESPONSE = {
    "team": "ATL",
    "season": "2025-26",
    "lineups": [
        {
            "lineup_id": "atl_0001",
            "players": ["Trae Young", "Dyson Daniels", "Jalen Johnson", "Zaccharie Risacher", "Onyeka Okongwu"],
            "minutes": 142.6,
            "points_for": 318,
            "points_against": 287,
            "plus_minus": 31,
            "off_rating": 118.4,
            "def_rating": 106.8,
            "net_rating": 11.6,
        }
    ],
}


@pytest.fixture(autouse=True)
def patch_lineup_summaries(monkeypatch):
    import lineup_impact
    monkeypatch.setattr(lineup_impact, "get_lineup_summaries", lambda *a, **kw: FAKE_RESPONSE)


class TestGetTeamLineups:

    def test_returns_200(self, client):
        res = client.get("/teams/ATL/lineups")
        assert res.status_code == 200

    def test_response_has_team_and_season(self, client):
        data = client.get("/teams/ATL/lineups").json()
        assert data["team"] == "ATL"
        assert "season" in data

    def test_response_has_lineups_list(self, client):
        data = client.get("/teams/ATL/lineups").json()
        assert isinstance(data["lineups"], list)

    def test_lineup_has_all_metric_fields(self, client):
        lineup = client.get("/teams/ATL/lineups").json()["lineups"][0]
        for field in ("lineup_id", "players", "minutes", "points_for", "points_against", "plus_minus", "off_rating", "def_rating", "net_rating"):
            assert field in lineup

    def test_players_is_list(self, client):
        lineup = client.get("/teams/ATL/lineups").json()["lineups"][0]
        assert isinstance(lineup["players"], list)


class TestGetTeamLineupsErrorHandling:

    @pytest.fixture(autouse=True)
    def patch_with_error(self, monkeypatch):
        import lineup_impact
        def _boom(*a, **kw):
            raise ValueError("Unknown team abbreviation: 'XYZ'")
        monkeypatch.setattr(lineup_impact, "get_lineup_summaries", _boom)

    def test_unknown_team_returns_404(self, client):
        res = client.get("/teams/XYZ/lineups")
        assert res.status_code == 404
