# backend/tests/test_play_by_play.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from unittest.mock import patch, MagicMock


FAKE_ACTIONS = [
    {"actionNumber": 1,  "actionType": "jumpball",  "shotResult": "",      "teamTricode": "LAL", "description": "Jump ball"},
    {"actionNumber": 5,  "actionType": "2pt",        "shotResult": "Made",  "teamTricode": "LAL", "description": "LeBron 2pt"},
    {"actionNumber": 8,  "actionType": "3pt",        "shotResult": "Made",  "teamTricode": "BOS", "description": "Tatum 3pt"},
    {"actionNumber": 10, "actionType": "2pt",        "shotResult": "Missed","teamTricode": "LAL", "description": "Missed 2"},
    {"actionNumber": 12, "actionType": "freethrow",  "shotResult": "Made",  "teamTricode": "BOS", "description": "FT"},
]


def make_mock_pbp(actions):
    mock = MagicMock()
    mock.actions.get_dict.return_value = actions
    return mock


class TestFetchScoringPlays:
    def test_returns_made_field_goals_only(self):
        import play_by_play
        with patch("play_by_play.playbyplay") as m:
            m.PlayByPlay.return_value = make_mock_pbp(FAKE_ACTIONS)
            plays, _ = play_by_play.fetch_scoring_plays("g1", since_action_number=0)
        # jumpball, missed 2pt, and freethrow excluded; 2pt Made + 3pt Made included
        assert len(plays) == 2
        assert plays[0]["points"] == 2
        assert plays[1]["points"] == 3

    def test_filters_by_since_action_number(self):
        import play_by_play
        with patch("play_by_play.playbyplay") as m:
            m.PlayByPlay.return_value = make_mock_pbp(FAKE_ACTIONS)
            plays, _ = play_by_play.fetch_scoring_plays("g1", since_action_number=6)
        # only action 8 qualifies (action 5 <= 6)
        assert len(plays) == 1
        assert plays[0]["action_number"] == 8

    def test_returns_max_action_number(self):
        import play_by_play
        with patch("play_by_play.playbyplay") as m:
            m.PlayByPlay.return_value = make_mock_pbp(FAKE_ACTIONS)
            _, max_num = play_by_play.fetch_scoring_plays("g1", since_action_number=0)
        assert max_num == 12

    def test_returns_empty_on_api_error(self):
        import play_by_play
        with patch("play_by_play.playbyplay") as m:
            m.PlayByPlay.side_effect = Exception("timeout")
            plays, max_num = play_by_play.fetch_scoring_plays("g1", since_action_number=5)
        assert plays == []
        assert max_num == 5  # unchanged

    def test_team_abbr_and_description_preserved(self):
        import play_by_play
        with patch("play_by_play.playbyplay") as m:
            m.PlayByPlay.return_value = make_mock_pbp(FAKE_ACTIONS)
            plays, _ = play_by_play.fetch_scoring_plays("g1", since_action_number=0)
        assert plays[0]["team_abbr"] == "LAL"
        assert "LeBron" in plays[0]["description"]
