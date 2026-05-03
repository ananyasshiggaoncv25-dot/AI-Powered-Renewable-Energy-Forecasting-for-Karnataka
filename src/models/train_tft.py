"""
TFT Training Script
- Builds a pytorch-forecasting TimeSeriesDataSet
- Configures and trains a Temporal Fusion Transformer
- Quantile outputs: P10 (0.1), P50 (0.5), P90 (0.9)
- Saves best checkpoint to models/tft_best.ckpt
"""
import os
import sys
import warnings
import pandas as pd
import torch
import lightning as L
from lightning.pytorch.callbacks import EarlyStopping, ModelCheckpoint
from lightning.pytorch.loggers import CSVLogger
from pytorch_forecasting import TimeSeriesDataSet, TemporalFusionTransformer
from pytorch_forecasting.data import GroupNormalizer
from pytorch_forecasting.metrics import QuantileLoss

warnings.filterwarnings("ignore")

# ── Hyper-parameters ───────────────────────────────────────────────────────────
MAX_ENCODER_LENGTH = 72   # 3 days of context
MAX_PREDICTION_LENGTH = 24  # Predict next 24 hours
BATCH_SIZE = 64
MAX_EPOCHS = 10            # Short demo run; increase for production
LEARNING_RATE = 3e-3
HIDDEN_SIZE = 32
ATTENTION_HEAD_SIZE = 2
DROPOUT = 0.1
QUANTILES = [0.1, 0.5, 0.9]
TRAINING_CUTOFF_DATE = "2023-01-01"   # Train on 2022; validate on 2023


def build_datasets(df: pd.DataFrame):
    # time_idx must be contiguous integers per asset
    df = df.sort_values(['asset_id', 'timestamp'])

    # Compute a global training cutoff as a time_idx
    cutoff_ts = pd.to_datetime(TRAINING_CUTOFF_DATE)
    cutoff_idx = int(
        (cutoff_ts - pd.to_datetime(df['timestamp'].min())).total_seconds() // 3600
    ) - MAX_PREDICTION_LENGTH  # leave room for validation windows

    training = TimeSeriesDataSet(
        df[df['time_idx'] <= cutoff_idx],
        time_idx="time_idx",
        target="generation_mw",
        group_ids=["asset_id"],
        min_encoder_length=MAX_ENCODER_LENGTH // 2,
        max_encoder_length=MAX_ENCODER_LENGTH,
        min_prediction_length=1,
        max_prediction_length=MAX_PREDICTION_LENGTH,
        static_categoricals=["asset_id", "asset_type"],
        static_reals=["capacity_mw", "latitude", "longitude"],
        time_varying_known_reals=[
            "time_idx",
            "hour_sin", "hour_cos",
            "month_sin", "month_cos",
            "temperature_c", "cloud_cover_pct", "ghi",
            "wind_speed_ms",
        ],
        time_varying_unknown_reals=[
            "generation_mw",
            "lag_24", "lag_48",
            "rolling_mean_24h",
            "capacity_factor",
        ],
        target_normalizer=GroupNormalizer(
            groups=["asset_id"], transformation="softplus"
        ),
        add_relative_time_idx=True,
        add_target_scales=True,
        add_encoder_length=True,
    )
    validation = TimeSeriesDataSet.from_dataset(
        training, df, predict=True, stop_randomization=True
    )
    return training, validation


def build_model(training: TimeSeriesDataSet) -> TemporalFusionTransformer:
    return TemporalFusionTransformer.from_dataset(
        training,
        learning_rate=LEARNING_RATE,
        hidden_size=HIDDEN_SIZE,
        attention_head_size=ATTENTION_HEAD_SIZE,
        dropout=DROPOUT,
        hidden_continuous_size=16,
        output_size=len(QUANTILES),
        loss=QuantileLoss(quantiles=QUANTILES),
        log_interval=10,
        reduce_on_plateau_patience=4,
    )


def train(data_path: str = "data/processed/featured_generation.csv",
          checkpoint_dir: str = "models"):
    print("Loading featured data...")
    df = pd.read_csv(data_path)
    df['timestamp'] = pd.to_datetime(df['timestamp'])

    print("Building TimeSeriesDataSets...")
    training_ds, validation_ds = build_datasets(df)

    train_loader = training_ds.to_dataloader(
        train=True, batch_size=BATCH_SIZE, num_workers=0, shuffle=True
    )
    val_loader = validation_ds.to_dataloader(
        train=False, batch_size=BATCH_SIZE * 2, num_workers=0
    )

    print(f"Train batches: {len(train_loader)}, Val batches: {len(val_loader)}")

    model = build_model(training_ds)
    print(f"TFT parameters: {sum(p.numel() for p in model.parameters()):,}")

    os.makedirs(checkpoint_dir, exist_ok=True)
    callbacks = [
        EarlyStopping(monitor="val_loss", patience=3, mode="min"),
        ModelCheckpoint(
            dirpath=checkpoint_dir,
            filename="tft_best",
            monitor="val_loss",
            mode="min",
        ),
    ]
    logger = CSVLogger(save_dir="logs", name="tft")

    trainer = L.Trainer(
        max_epochs=MAX_EPOCHS,
        accelerator="cpu",
        gradient_clip_val=0.1,
        callbacks=callbacks,
        logger=logger,
        enable_progress_bar=True,
    )

    print(f"\nStarting training (max {MAX_EPOCHS} epochs)...")
    trainer.fit(model, train_dataloaders=train_loader, val_dataloaders=val_loader)

    best_path = callbacks[1].best_model_path
    print(f"\nTraining complete. Best checkpoint: {best_path}")
    return best_path, training_ds


if __name__ == "__main__":
    best_path, _ = train()
    print(f"Saved: {best_path}")
