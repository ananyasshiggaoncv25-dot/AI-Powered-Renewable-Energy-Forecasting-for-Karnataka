"""
Feature Engineering for TFT
- Cyclical time encodings (hour, month)
- Lag features
- Rolling statistics
- Normalises generation by capacity to create capacity_factor
"""
import pandas as pd
import numpy as np
import os


def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    hour = df['timestamp'].dt.hour
    month = df['timestamp'].dt.month
    df['hour'] = hour
    df['month'] = month
    df['day_of_year'] = df['timestamp'].dt.dayofyear
    df['time_idx'] = (
        (df['timestamp'] - df['timestamp'].min()).dt.total_seconds() // 3600
    ).astype(int)
    # Cyclical encodings
    df['hour_sin'] = np.sin(2 * np.pi * hour / 24)
    df['hour_cos'] = np.cos(2 * np.pi * hour / 24)
    df['month_sin'] = np.sin(2 * np.pi * month / 12)
    df['month_cos'] = np.cos(2 * np.pi * month / 12)
    return df


def add_lag_and_rolling(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df = df.sort_values(['asset_id', 'timestamp'])
    for asset_id, grp in df.groupby('asset_id'):
        idx = grp.index
        df.loc[idx, 'lag_24'] = grp['generation_mw'].shift(24)
        df.loc[idx, 'lag_48'] = grp['generation_mw'].shift(48)
        df.loc[idx, 'rolling_mean_24h'] = (
            grp['generation_mw'].shift(1).rolling(24, min_periods=1).mean()
        )
    return df


def add_capacity_factor(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df['capacity_factor'] = df['generation_mw'] / df['capacity_mw']
    return df


def engineer_features(input_path: str, output_path: str) -> pd.DataFrame:
    print(f"Loading data from {input_path}...")
    df = pd.read_csv(input_path)
    df = add_time_features(df)
    df = add_lag_and_rolling(df)
    df = add_capacity_factor(df)
    # Drop rows with NaN lags (first 48 hours per asset)
    df = df.dropna(subset=['lag_24', 'lag_48']).reset_index(drop=True)
    # Ensure correct dtypes for pytorch-forecasting
    df['asset_id'] = df['asset_id'].astype(str)
    df['asset_type'] = df['asset_type'].astype(str)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    df.to_csv(output_path, index=False)
    print(f"Features saved to {output_path}  (shape: {df.shape})")
    return df


if __name__ == "__main__":
    engineer_features(
        input_path='data/raw/synthetic_generation.csv',
        output_path='data/processed/featured_generation.csv',
    )
