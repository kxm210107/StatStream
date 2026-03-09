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
