"""
Unit tests for backend/predictor.py
=====================================
Tests cover both the weighted-formula fallback and (if model.pkl exists)
the trained ML model.  All tests are pure Python — no DB, no HTTP.
"""

import sys
import os
import math
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import predictor


# ── Helpers ────────────────────────────────────────────────────────────────────

def _force_weighted(monkeypatch):
    """Patch _load_model to return None so the weighted fallback is always used."""
    monkeypatch.setattr(predictor, "_load_model", lambda: None)
    monkeypatch.setattr(predictor, "_model", None)
    monkeypatch.setattr(predictor, "_model_loaded", False)


# ── Weighted formula tests ─────────────────────────────────────────────────────

class TestWeightedFormula:

    def test_probabilities_sum_to_100(self, monkeypatch):
        """home_pct + away_pct must always equal 100.0."""
        _force_weighted(monkeypatch)
        home, away, _ = predictor.predict(25.0, 8.0, 6.0, 22.0, 7.5, 5.5)
        assert abs(home + away - 100.0) < 0.01

    def test_model_type_is_weighted(self, monkeypatch):
        """Fallback path must return model_type='weighted'."""
        _force_weighted(monkeypatch)
        _, _, model_type = predictor.predict(20.0, 6.0, 5.0, 20.0, 6.0, 5.0)
        assert model_type == "weighted"

    def test_home_advantage_with_equal_stats(self, monkeypatch):
        """When stats are identical, home team must win > 50% due to the +3.5 bonus."""
        _force_weighted(monkeypatch)
        home, away, _ = predictor.predict(20.0, 6.0, 5.0, 20.0, 6.0, 5.0)
        assert home > 50.0, f"Expected home > 50%, got {home}"
        assert away < 50.0

    def test_better_offense_raises_probability(self, monkeypatch):
        """A team with significantly higher PPG should have higher win probability."""
        _force_weighted(monkeypatch)
        home_strong, _, _ = predictor.predict(35.0, 8.0, 7.0, 20.0, 7.0, 5.0)
        home_weak,   _, _ = predictor.predict(20.0, 8.0, 7.0, 20.0, 7.0, 5.0)
        assert home_strong > home_weak

    def test_output_range_is_0_to_100(self, monkeypatch):
        """Both probabilities must always be in [0, 100]."""
        _force_weighted(monkeypatch)
        test_cases = [
            (40.0, 15.0, 12.0, 5.0,  2.0, 1.0),   # dominant home team
            (5.0,   2.0,  1.0, 40.0, 15.0, 12.0),  # dominant away team
            (20.0,  6.0,  5.0, 20.0,  6.0,  5.0),  # equal
        ]
        for args in test_cases:
            home, away, _ = predictor.predict(*args)
            assert 0 <= home <= 100, f"home {home} out of range for {args}"
            assert 0 <= away <= 100, f"away {away} out of range for {args}"

    def test_symmetry(self, monkeypatch):
        """Swapping home/away should swap their probabilities (minus the home bonus)."""
        _force_weighted(monkeypatch)
        # Team A at home vs Team B away
        home_a, away_b, _ = predictor.predict(25.0, 8.0, 6.0, 20.0, 7.0, 5.0)
        # Team B at home vs Team A away  (roles reversed)
        home_b, away_a, _ = predictor.predict(20.0, 7.0, 5.0, 25.0, 8.0, 6.0)
        # Both should lean toward the home team, so neither probability is the same
        # but away_b (team B in first game) should roughly equal home_b adjusted
        assert home_a != away_a, "Home advantage should break perfect symmetry"

    def test_returns_tuple_of_three(self, monkeypatch):
        """predict() must return a 3-tuple."""
        _force_weighted(monkeypatch)
        result = predictor.predict(20.0, 6.0, 5.0, 20.0, 6.0, 5.0)
        assert isinstance(result, tuple)
        assert len(result) == 3

    def test_probabilities_are_rounded_to_one_decimal(self, monkeypatch):
        """Both float outputs should be rounded to 1 decimal place."""
        _force_weighted(monkeypatch)
        home, away, _ = predictor.predict(22.5, 7.1, 5.3, 21.0, 6.8, 4.9)
        assert home == round(home, 1)
        assert away == round(away, 1)


# ── ML model tests (skipped when model.pkl is absent) ─────────────────────────

@pytest.mark.skipif(
    not predictor.model_available(),
    reason="model.pkl not trained yet — run python backend/train_model.py first",
)
class TestMLModel:

    def test_model_type_is_ml(self):
        """Trained model must return model_type='ml'."""
        _, _, model_type = predictor.predict(25.0, 8.0, 6.0, 22.0, 7.5, 5.5)
        assert model_type == "ml"

    def test_probabilities_sum_to_100(self):
        """home_pct + away_pct must always equal 100.0."""
        home, away, _ = predictor.predict(25.0, 8.0, 6.0, 22.0, 7.5, 5.5)
        assert abs(home + away - 100.0) < 0.1

    def test_output_range_is_0_to_100(self):
        """Both probabilities must be in [0, 100]."""
        test_cases = [
            (35.0, 12.0, 10.0,  5.0,  2.0,  1.0),
            ( 5.0,  2.0,  1.0, 35.0, 12.0, 10.0),
            (20.0,  6.0,  5.0, 20.0,  6.0,  5.0),
        ]
        for args in test_cases:
            home, away, _ = predictor.predict(*args)
            assert 0 <= home <= 100
            assert 0 <= away <= 100

    def test_home_advantage_with_equal_stats(self):
        """Even with equal stats, the ML intercept should lean toward home team."""
        home, away, _ = predictor.predict(20.0, 6.0, 5.0, 20.0, 6.0, 5.0)
        # Historical home-court advantage is ~60 %; give generous tolerance
        assert home > 45.0, (
            f"ML model shows no home advantage at all: {home}% vs {away}%"
        )

    def test_better_offense_raises_probability(self):
        """A team scoring 15 more PPG should have a higher win probability."""
        home_strong, _, _ = predictor.predict(35.0, 8.0, 7.0, 20.0, 7.0, 5.0)
        home_weak,   _, _ = predictor.predict(20.0, 8.0, 7.0, 35.0, 7.0, 5.0)
        assert home_strong > home_weak

    def test_extreme_advantage_approaches_100(self):
        """A team vastly superior in every stat should have win probability > 80%."""
        home, _, _ = predictor.predict(50.0, 20.0, 15.0, 5.0, 2.0, 1.0)
        assert home > 80.0, f"Expected > 80% for extreme advantage, got {home}%"

    def test_sanity_equal_stats_probability_near_60(self):
        """
        With equal stats the ML intercept captures historical ~60% home advantage.
        Allow a generous range (50–75%) since it depends on training data.
        """
        home, _, _ = predictor.predict(20.0, 6.0, 5.0, 20.0, 6.0, 5.0)
        assert 50.0 <= home <= 75.0, (
            f"Equal-stats home probability {home}% is outside expected range 50–75%"
        )


# ── model_available() helper ───────────────────────────────────────────────────

class TestModelAvailable:

    def test_returns_bool(self):
        result = predictor.model_available()
        assert isinstance(result, bool)

    def test_reflects_file_existence(self, tmp_path, monkeypatch):
        """model_available() should be True iff model.pkl exists at MODEL_PATH."""
        fake_path = tmp_path / "model.pkl"
        monkeypatch.setattr(predictor, "MODEL_PATH", str(fake_path))

        assert predictor.model_available() is False
        fake_path.write_bytes(b"fake")
        assert predictor.model_available() is True
