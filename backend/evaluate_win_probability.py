# backend/evaluate_win_probability.py
"""
Standalone evaluation script. Re-runs AUC and Brier score against the
persisted test set without retraining.

Usage:
    cd backend
    python evaluate_win_probability.py
"""

import os
import json
import joblib
import numpy as np

MODEL_PATH    = os.path.join(os.path.dirname(__file__), "win_prob_model.pkl")
TEST_SET_PATH = os.path.join(os.path.dirname(__file__), "win_prob_test_set.npz")
METRICS_PATH  = os.path.join(os.path.dirname(__file__), "model_metrics.json")


def evaluate():
    if not os.path.exists(MODEL_PATH):
        print(f"Model not found: {MODEL_PATH}")
        print("Run train_win_probability.py first.")
        return

    if not os.path.exists(TEST_SET_PATH):
        print(f"Test set not found: {TEST_SET_PATH}")
        print("Run train_win_probability.py first.")
        return

    model    = joblib.load(MODEL_PATH)
    test_set = np.load(TEST_SET_PATH)
    X_test   = test_set["X_test"]
    y_test   = test_set["y_test"]

    from sklearn.metrics import roc_auc_score, brier_score_loss

    y_pred = model.predict_proba(X_test)[:, 1]
    auc    = roc_auc_score(y_test, y_pred)
    brier  = brier_score_loss(y_test, y_pred)

    print(f"AUC-ROC:     {auc:.4f}  (target ≥ 0.85)")
    print(f"Brier score: {brier:.4f} (target ≤ 0.15)")

    if os.path.exists(METRICS_PATH):
        with open(METRICS_PATH) as f:
            m = json.load(f)
        print(f"\nRecorded at training:")
        print(f"  AUC:        {m.get('auc')}")
        print(f"  Brier:      {m.get('brier')}")
        print(f"  Seasons:    {m.get('seasons')}")
        print(f"  N games:    {m.get('n_games')}")
        print(f"  Trained at: {m.get('trained_at')}")


if __name__ == "__main__":
    evaluate()
