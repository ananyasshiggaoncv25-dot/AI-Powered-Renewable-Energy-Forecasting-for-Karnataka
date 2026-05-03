"""
Load processed featured generation data and build slices for TFT inference.
Paths resolve relative to the repository root (parent of ``api/``).
"""
from __future__ import annotations

from datetime import date, datetime
from pathlib import Path
from typing import Final

import pandas as pd

REPO_ROOT: Final[Path] = Path(__file__).resolve().parents[1]
DEFAULT_FEATURED_PATH: Final[Path] = REPO_ROOT / "data" / "processed" / "featured_generation.csv"

VALID_ASSETS: Final[frozenset[str]] = frozenset({"SOLAR_PAVAGADA", "WIND_CHITRADURGA"})

CAPACITY_MW: Final[dict[str, float]] = {
    "SOLAR_PAVAGADA": 2050.0,
    "WIND_CHITRADURGA": 1500.0,
}


def load_featured_data(csv_path: Path | str | None = None) -> pd.DataFrame:
    """Load ``featured_generation.csv`` and parse timestamps."""
    path = Path(csv_path) if csv_path else DEFAULT_FEATURED_PATH
    if not path.is_file():
        raise FileNotFoundError(f"Featured data not found: {path}")
    df = pd.read_csv(path)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    return df


def parse_forecast_date(value: str | date | datetime) -> pd.Timestamp:
    """Normalize user input to midnight UTC-naive pandas Timestamp (first forecast hour)."""
    if isinstance(value, pd.Timestamp):
        ts = value.normalize()
        return ts
    if isinstance(value, datetime):
        return pd.Timestamp(value.date())
    if isinstance(value, date):
        return pd.Timestamp(datetime(value.year, value.month, value.day))
    s = str(value).strip()
    ts = pd.to_datetime(s)
    return ts.normalize()


def truncate_for_forecast_window(
    df: pd.DataFrame,
    asset_id: str,
    forecast_date: str | date | datetime,
) -> pd.DataFrame:
    """
    Keep rows for ``asset_id`` with timestamps up to and including the hour before
    forecast-day midnight. TFT ``predict=True`` then forecasts the 24 hours starting
    at ``forecast_date`` 00:00.
    """
    if asset_id not in VALID_ASSETS:
        raise ValueError(f"Unknown asset_id={asset_id!r}. Expected one of {sorted(VALID_ASSETS)}")

    day_start = parse_forecast_date(forecast_date)
    last_known = day_start - pd.Timedelta(hours=1)

    sub = df.loc[(df["asset_id"] == asset_id) & (df["timestamp"] <= last_known)].copy()
    if sub.empty:
        raise ValueError(
            f"No data for asset {asset_id} on or before {last_known}. "
            "Pick a later date within the dataset."
        )
    return sub.sort_values("timestamp").reset_index(drop=True)


def forecast_hour_timestamps(forecast_date: str | date | datetime) -> list[pd.Timestamp]:
    """24 hourly timestamps starting at forecast-day midnight."""
    start = parse_forecast_date(forecast_date)
    return [start + pd.Timedelta(hours=h) for h in range(24)]
