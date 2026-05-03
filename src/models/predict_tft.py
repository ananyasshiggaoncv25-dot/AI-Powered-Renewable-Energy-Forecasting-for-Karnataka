"""
TFT Inference & Explainability Script
- Loads best checkpoint from training
- Produces 24-hour quantile forecasts (P10, P50, P90)
- Extracts built-in TFT attention weights for interpretability
- Saves outputs to data/predictions/
"""
import os
import sys
import warnings
import pandas as pd
import torch
from pytorch_forecasting import TemporalFusionTransformer, TimeSeriesDataSet

warnings.filterwarnings("ignore")

# Reuse training helpers
sys.path.append(os.path.join(os.path.dirname(__file__)))
from train_tft import build_datasets, BATCH_SIZE

OUTPUT_DIR = "data/predictions"


def load_model_and_data(
    checkpoint_path: str,
    data_path: str = "data/processed/featured_generation.csv",
):
    df = pd.read_csv(data_path)
    df['timestamp'] = pd.to_datetime(df['timestamp'])

    training_ds, validation_ds = build_datasets(df)
    model = TemporalFusionTransformer.load_from_checkpoint(checkpoint_path)
    model.eval()
    return model, training_ds, validation_ds, df


def predict_and_save(checkpoint_path: str, data_path: str = "data/processed/featured_generation.csv"):
    print(f"Loading checkpoint: {checkpoint_path}")
    model, training_ds, validation_ds, df = load_model_and_data(checkpoint_path, data_path)

    val_loader = validation_ds.to_dataloader(
        train=False, batch_size=BATCH_SIZE * 2, num_workers=0
    )

    print("Running inference...")
    raw_predictions = model.predict(val_loader, mode="raw", return_x=True)

    # Extract quantile predictions  shape: (samples, pred_length, n_quantiles)
    preds = raw_predictions.output.prediction  # tensor
    x = raw_predictions.x

    # Decode target back to original scale
    decoder_target = x["decoder_target"]          # (batch, pred_len)
    groups = x["groups"]                           # (batch, 1) — encoded asset_id

    # Map encoded group back to asset_id string
    group_ids = training_ds.group_ids  # list of group id column names
    # In pytorch-forecasting 1.x, use the label_encoder stored in the dataset
    asset_label_encoder = training_ds.target_normalizer.normalizers["SOLAR_PAVAGADA"].__class__ if False else None
    # Simpler: build a reverse mapping directly from the raw dataframe
    df_raw = pd.read_csv(data_path)
    df_raw['timestamp'] = pd.to_datetime(df_raw['timestamp'])
    # asset_ids ordered by their encoded integer (same order as groupby in dataset)
    ordered_assets = sorted(df_raw['asset_id'].unique())
    rows = []
    for i in range(preds.shape[0]):
        asset_enc = int(groups[i, 0].item())
        # The dataset sorts group ids alphabetically by default
        asset_id = ordered_assets[asset_enc] if asset_enc < len(ordered_assets) else str(asset_enc)
        for t in range(preds.shape[1]):
            rows.append({
                "sample_idx": i,
                "step_ahead": t + 1,
                "asset_id": asset_id,
                "p10": float(preds[i, t, 0].item()),
                "p50": float(preds[i, t, 1].item()),
                "p90": float(preds[i, t, 2].item()),
                "actual": float(decoder_target[i, t].item()),
            })

    pred_df = pd.DataFrame(rows)
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    pred_path = os.path.join(OUTPUT_DIR, "tft_predictions.csv")
    pred_df.to_csv(pred_path, index=False)
    print(f"Predictions saved to {pred_path}  (rows: {len(pred_df)})")

    # ── Attention / Interpretability ─────────────────────────────────────────
    print("Extracting attention weights (interpretability)...")
    try:
        interpretation = model.interpret_output(raw_predictions.output, reduction="sum")
        attn_df = pd.DataFrame(
            interpretation["attention"].cpu().numpy(),
        )
        # Column names = encoder time steps
        attn_path = os.path.join(OUTPUT_DIR, "attention_weights.csv")
        attn_df.to_csv(attn_path, index=False)
        print(f"Attention weights saved to {attn_path}")

        # Variable importance
        var_importance = interpretation["encoder_variables"]
        var_names = model.encoder_variables + model.decoder_variables
        imp_df = pd.DataFrame({
            "variable": var_names[:len(var_importance)],
            "importance": var_importance.cpu().numpy(),
        }).sort_values("importance", ascending=False)
        imp_path = os.path.join(OUTPUT_DIR, "variable_importance.csv")
        imp_df.to_csv(imp_path, index=False)
        print(f"Variable importance saved to {imp_path}")
        print("\nTop feature importances:")
        print(imp_df.head(10).to_string(index=False))
    except Exception as e:
        print(f"[Warning] Could not extract attention: {e}")

    return pred_df


if __name__ == "__main__":
    import glob
    checkpoints = glob.glob("models/tft_best*.ckpt")
    if not checkpoints:
        print("No checkpoint found. Please run train_tft.py first.")
        sys.exit(1)
    predict_and_save(checkpoints[0])
