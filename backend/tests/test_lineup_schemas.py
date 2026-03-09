"""Tests for lineup-related Pydantic schemas."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from schemas import LineupSummary, LineupResponse

FAKE_LINEUP = {
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

def test_lineup_summary_accepts_valid_data():
    summary = LineupSummary(**FAKE_LINEUP)
    assert summary.lineup_id == "atl_0001"
    assert len(summary.players) == 5
    assert summary.net_rating == 11.6

def test_lineup_summary_plus_minus():
    summary = LineupSummary(**FAKE_LINEUP)
    assert summary.plus_minus == summary.points_for - summary.points_against

def test_lineup_response_wraps_lineups():
    response = LineupResponse(team="ATL", season="2025-26", lineups=[FAKE_LINEUP])
    assert response.team == "ATL"
    assert len(response.lineups) == 1
    assert response.lineups[0].players[0] == "Trae Young"
