"""
Phase 2 Evaluation
- Computes nMAE and nRMSE for TFT P50 predictions vs Phase 1 baselines
- Computes PICP: % of actuals within the P10-P90 interval
- Prints a comparison table
"""
import sys
import os
import pandas as pd
import numpy as np

sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))
from src.evaluation.metrics import calculate_nmae, calculate_nrmse

# Capacity per asset for normalization
CAPACITY = {
    "SOLAR_PAVAGADA": 2050,
    "WIND_CHITRADURGA": 1500,
}

# Phase 1 baseline results for comparison
BASELINE_RESULTS = {
    "SOLAR_PAVAGADA": {
        "Persistence": {"nMAE": 0.0341, "nRMSE": 0.0676},
        "Climatology": {"nMAE": 0.0524, "nRMSE": 0.0987},
    },
    "WIND_CHITRADURGA": {
        "Persistence": {"nMAE": 0.1391, "nRMSE": 0.2548},
        "Climatology": {"nMAE": 0.1101, "nRMSE": 0.1833},
    },
}


def calculate_picp(y_true: np.ndarray, p10: np.ndarray, p90: np.ndarray) -> float:
    """Prediction Interval Coverage Probability (PICP).
    Target: >= 0.80 for a nominally 80% interval.
    """
    covered = ((y_true >= p10) & (y_true <= p90)).sum()
    return covered / len(y_true)


def evaluate_tft(pred_path: str = "data/predictions/tft_predictions.csv"):
    if not os.path.exists(pred_path):
        print(f"Predictions not found at {pred_path}. Run predict_tft.py first.")
        sys.exit(1)

    pred_df = pd.read_csv(pred_path)

    print("\n" + "=" * 65)
    print(" Phase 2 Evaluation: TFT vs Baselines")
    print("=" * 65)

    all_rows = []

    for asset_id, cap in CAPACITY.items():
        asset_df = pred_df[pred_df["asset_id"] == asset_id]
        if asset_df.empty:
            print(f"  [warning] No predictions found for {asset_id}")
            continue

        y_true = asset_df["actual"].values
        p50 = asset_df["p50"].values
        p10 = asset_df["p10"].values
        p90 = asset_df["p90"].values

        tft_nmae = calculate_nmae(y_true, p50, cap)
        tft_nrmse = calculate_nrmse(y_true, p50, cap)
        picp = calculate_picp(y_true, p10, p90)

        tft_row = {
            "Asset": asset_id,
            "Model": "TFT (P50)",
            "nMAE": round(tft_nmae, 4),
            "nRMSE": round(tft_nrmse, 4),
            "PICP (P10-P90)": f"{picp:.1%}",
        }
        all_rows.append(tft_row)

        for baseline_name, metrics in BASELINE_RESULTS.get(asset_id, {}).items():
            all_rows.append({
                "Asset": asset_id,
                "Model": baseline_name,
                "nMAE": metrics["nMAE"],
                "nRMSE": metrics["nRMSE"],
                "PICP (P10-P90)": "N/A",
            })

    results_df = pd.DataFrame(all_rows)
    results_df = results_df.sort_values(["Asset", "nMAE"])
    print(results_df.to_string(index=False))

    # Save results
    os.makedirs("data/predictions", exist_ok=True)
    out_path = "data/predictions/phase2_evaluation.csv"
    results_df.to_csv(out_path, index=False)
    print(f"\nEvaluation table saved to {out_path}")

    # Summary
    print("\n── Interpretation ──────────────────────────────────────────────")
    print("  nMAE / nRMSE: lower is better (normalized by plant capacity)")
    print("  PICP target : ≥ 80% of actuals should fall inside P10-P90 band")
    print("────────────────────────────────────────────────────────────────")

    return results_df


if __name__ == "__main__":
    evaluate_tft()
