"""Tests for lineup_data.py — NBA API wrapper and normalization."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
import pandas as pd


# ── Fake API response helpers ──────────────────────────────────────────────────

def _make_base_df():
    return pd.DataFrame([
        {
            "GROUP_ID":   "atl_0001",
            "GROUP_NAME": "Trae Young - Dyson Daniels - Jalen Johnson - Zaccharie Risacher - Onyeka Okongwu",
            "MIN":        142.6,
            "PTS":        318,
            "PLUS_MINUS": 31,
        },
        {
            "GROUP_ID":   "atl_0002",
            "GROUP_NAME": "Trae Young - Vit Krejci - Jalen Johnson - Zaccharie Risacher - Onyeka Okongwu",
            "MIN":        55.3,
            "PTS":        120,
            "PLUS_MINUS": -8,
        },
    ])

def _make_adv_df():
    return pd.DataFrame([
        {"GROUP_ID": "atl_0001", "OFF_RATING": 118.4, "DEF_RATING": 106.8, "NET_RATING": 11.6},
        {"GROUP_ID": "atl_0002", "OFF_RATING": 105.1, "DEF_RATING": 112.0, "NET_RATING": -6.9},
    ])


class FakeLeagueDashLineups:
    def __init__(self, measure_type_detailed_defense="Base", **kwargs):
        self._measure = measure_type_detailed_defense

    def get_data_frames(self):
        if self._measure == "Base":
            return [_make_base_df()]
        return [_make_adv_df()]


# ── Tests ──────────────────────────────────────────────────────────────────────

class TestGetTeamId:
    def test_known_abbreviation_returns_int(self):
        from lineup_data import get_team_id
        team_id = get_team_id("ATL")
        assert isinstance(team_id, int)
        assert team_id > 0

    def test_case_insensitive(self):
        from lineup_data import get_team_id
        assert get_team_id("atl") == get_team_id("ATL")

    def test_unknown_abbreviation_raises(self):
        from lineup_data import get_team_id
        with pytest.raises(ValueError, match="Unknown team abbreviation"):
            get_team_id("XYZ")


class TestFetchLineupRows:
    @pytest.fixture(autouse=True)
    def patch_api(self, monkeypatch):
        import lineup_data
        monkeypatch.setattr(lineup_data, "LeagueDashLineups", FakeLeagueDashLineups)

    def test_returns_list(self):
        from lineup_data import fetch_lineup_rows
        rows = fetch_lineup_rows("ATL", "2025-26")
        assert isinstance(rows, list)

    def test_returns_two_rows(self):
        from lineup_data import fetch_lineup_rows
        rows = fetch_lineup_rows("ATL", "2025-26")
        assert len(rows) == 2

    def test_row_has_all_required_fields(self):
        from lineup_data import fetch_lineup_rows
        row = fetch_lineup_rows("ATL", "2025-26")[0]
        for field in ("lineup_id", "players", "minutes", "points_for", "points_against", "plus_minus", "off_rating", "def_rating", "net_rating"):
            assert field in row, f"Missing field: {field}"

    def test_players_is_list_of_strings(self):
        from lineup_data import fetch_lineup_rows
        row = fetch_lineup_rows("ATL", "2025-26")[0]
        assert isinstance(row["players"], list)
        assert all(isinstance(p, str) for p in row["players"])
        assert len(row["players"]) == 5

    def test_points_against_derived_correctly(self):
        from lineup_data import fetch_lineup_rows
        rows = fetch_lineup_rows("ATL", "2025-26")
        row = rows[0]
        assert row["points_against"] == row["points_for"] - row["plus_minus"]

    def test_ratings_are_floats(self):
        from lineup_data import fetch_lineup_rows
        row = fetch_lineup_rows("ATL", "2025-26")[0]
        assert isinstance(row["off_rating"], float)
        assert isinstance(row["def_rating"], float)
        assert isinstance(row["net_rating"], float)
