# backend/tests/test_game_tracker.py
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import time
import pytest
import game_tracker


@pytest.fixture(autouse=True)
def reset():
    game_tracker.clear_all()
    yield
    game_tracker.clear_all()


class TestElapsedSec:
    def test_start_of_q1(self):
        assert game_tracker.elapsed_sec(1, "12:00") == 0

    def test_end_of_q1(self):
        assert game_tracker.elapsed_sec(1, "00:00") == 720

    def test_start_of_q2(self):
        assert game_tracker.elapsed_sec(2, "12:00") == 720

    def test_mid_q3(self):
        # Q3 started, 5:30 left → elapsed = 2*720 + (720 - 330) = 1440 + 390 = 1830
        assert game_tracker.elapsed_sec(3, "05:30") == 1830

    def test_end_of_regulation(self):
        assert game_tracker.elapsed_sec(4, "00:00") == 2880

    def test_ot_capped(self):
        assert game_tracker.elapsed_sec(5, "05:00") == 2880

    def test_invalid_clock(self):
        assert game_tracker.elapsed_sec(2, "--") == 720  # completed Q1


class TestRecordProb:
    def test_appends_entry(self):
        game_tracker.record_prob("g1", 2, "06:00", 0.6)
        history = game_tracker.get_prob_history("g1")
        assert len(history) == 1
        assert history[0]["home_prob"] == 0.6

    def test_deduplicates_same_elapsed(self):
        game_tracker.record_prob("g1", 2, "06:00", 0.6)
        game_tracker.record_prob("g1", 2, "06:00", 0.62)  # same elapsed, different prob
        history = game_tracker.get_prob_history("g1")
        assert len(history) == 1
        assert history[0]["home_prob"] == 0.62  # updated in place

    def test_multiple_games_isolated(self):
        game_tracker.record_prob("g1", 1, "10:00", 0.5)
        game_tracker.record_prob("g2", 1, "10:00", 0.7)
        assert game_tracker.get_prob_history("g1")[0]["home_prob"] == 0.5
        assert game_tracker.get_prob_history("g2")[0]["home_prob"] == 0.7

    def test_caps_at_576_entries(self):
        state = game_tracker._get("g1")
        # Fill with 577 entries directly (bypassing record_prob's dedup)
        for i in range(577):
            state.prob_history.append({"elapsed_sec": i, "home_prob": 0.5})
        # Call record_prob with a new unique elapsed to trigger the cap check
        game_tracker.record_prob("g1", 1, "01:00", 0.5)  # elapsed = 720-60 = 660 (unique)
        assert len(game_tracker.get_prob_history("g1")) <= 576


class TestScoringPlays:
    def test_drain_returns_plays(self):
        plays = [{"action_number": 5, "team_abbr": "LAL", "points": 3, "description": "3pt"}]
        game_tracker.add_scoring_plays("g1", plays, last_action_number=5)
        drained = game_tracker.drain_new_plays("g1")
        assert len(drained) == 1
        assert drained[0]["team_abbr"] == "LAL"

    def test_drain_clears_queue(self):
        game_tracker.add_scoring_plays("g1", [{"action_number": 1}], 1)
        game_tracker.drain_new_plays("g1")
        assert game_tracker.drain_new_plays("g1") == []

    def test_last_action_number_advances(self):
        game_tracker.add_scoring_plays("g1", [], last_action_number=42)
        assert game_tracker.get_last_action_number("g1") == 42

    def test_last_action_number_never_goes_back(self):
        game_tracker.add_scoring_plays("g1", [], last_action_number=42)
        game_tracker.add_scoring_plays("g1", [], last_action_number=10)
        assert game_tracker.get_last_action_number("g1") == 42

    def test_last_action_number_default_zero(self):
        assert game_tracker.get_last_action_number("unseen-game-id") == 0

    def test_stale_plays_discarded_on_drain(self):
        state = game_tracker._get("g1")
        # Inject a play that's already 20 seconds old (beyond the 15s TTL)
        state._pending_plays.append({"action_number": 1, "team_abbr": "LAL", "points": 2, "queued_at": time.time() - 20})
        drained = game_tracker.drain_new_plays("g1")
        assert drained == []

    def test_fresh_plays_kept_on_drain(self):
        plays = [{"action_number": 2, "team_abbr": "BOS", "points": 3}]
        game_tracker.add_scoring_plays("g1", plays, last_action_number=2)
        drained = game_tracker.drain_new_plays("g1")
        assert len(drained) == 1
        assert drained[0]["team_abbr"] == "BOS"

    def test_clear_all_removes_state(self):
        game_tracker.record_prob("g1", 2, "06:00", 0.6)
        game_tracker.add_scoring_plays("g1", [{"action_number": 1}], 1)
        game_tracker.clear_all()
        assert game_tracker.get_prob_history("g1") == []
        assert game_tracker.get_last_action_number("g1") == 0
        assert game_tracker.drain_new_plays("g1") == []
