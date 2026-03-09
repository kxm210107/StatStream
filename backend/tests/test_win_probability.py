"""Unit tests for win_probability.py"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import win_probability as wp


class TestClockToSeconds:

    def test_start_of_q1(self):
        assert wp._clock_to_seconds_remaining(1, "12:00") == 2880

    def test_halftime_start_q3(self):
        # Start of Q3 = 24 min left in game
        assert wp._clock_to_seconds_remaining(3, "12:00") == 24 * 60

    def test_start_of_q4(self):
        assert wp._clock_to_seconds_remaining(4, "12:00") == 720

    def test_end_of_game(self):
        assert wp._clock_to_seconds_remaining(4, "00:00") == 0

    def test_overtime_returns_zero(self):
        assert wp._clock_to_seconds_remaining(5, "05:00") == 0


class TestPredict:

    def test_returns_tuple_of_two_floats(self):
        h, a = wp.predict(80, 70, 4, "02:00")
        assert isinstance(h, float)
        assert isinstance(a, float)

    def test_probabilities_sum_to_one(self):
        h, a = wp.predict(80, 70, 4, "02:00")
        assert abs(h + a - 1.0) < 0.001

    def test_leading_team_has_higher_probability(self):
        h, a = wp.predict(90, 80, 4, "01:00")
        assert h > a

    def test_trailing_team_has_lower_probability(self):
        h, a = wp.predict(70, 90, 4, "01:00")
        assert h < a

    def test_early_game_close_score_near_fifty_fifty(self):
        # Score 0-0 at start should be close to home advantage ~55-60%
        h, a = wp.predict(0, 0, 1, "12:00")
        assert 0.50 <= h <= 0.70

    def test_probabilities_clamped_above_zero(self):
        h, a = wp.predict(200, 0, 4, "00:01")
        assert h >= 0.01
        assert a >= 0.01
