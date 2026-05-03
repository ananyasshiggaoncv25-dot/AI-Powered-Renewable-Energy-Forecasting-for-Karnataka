"""
TFT inference orchestration shared by FastAPI and the Streamlit dashboard.

Environment (optional):

- ``FORECAST_DATA_PATH`` or ``DATA_PATH`` — CSV path (default: ``data/processed/featured_generation.csv`` under repo root).
- ``FORECAST_CHECKPOINT_GLOB`` or ``CHECKPOINT_GLOB`` — glob for TFT checkpoints (default: ``<repo>/models/tft_best*.ckpt``).
"""
from __future__ import annotations

import glob
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import pandas as pd
import torch
from pytorch_forecasting import TemporalFusionTransformer, TimeSeriesDataSet

# Repository root on sys.path for ``src.models``
_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from src.models.train_tft import build_datasets  # noqa: E402
from src.evaluation.metrics import calculate_nmae, calculate_nrmse  # noqa: E402

from api.data_utils import (  # noqa: E402
    CAPACITY_MW,
    DEFAULT_FEATURED_PATH,
    forecast_hour_timestamps,
    load_featured_data,
    parse_forecast_date,
    truncate_for_forecast_window,
)

# Phase 1 baseline constants (see ``src/evaluation/evaluate_phase2.py``)
BASELINE_RESULTS: dict[str, dict[str, dict[str, float]]] = {
    "SOLAR_PAVAGADA": {
        "Persistence": {"nMAE": 0.0341, "nRMSE": 0.0676},
        "Climatology": {"nMAE": 0.0524, "nRMSE": 0.0987},
    },
    "WIND_CHITRADURGA": {
        "Persistence": {"nMAE": 0.1391, "nRMSE": 0.2548},
        "Climatology": {"nMAE": 0.1101, "nRMSE": 0.1833},
    },
}


@dataclass
class ForecastSeriesPoint:
    timestamp: str
    p10: float
    p50: float
    p90: float
    actual_mw: float


@dataclass
class VariableImportanceRow:
    variable: str
    importance: float
    role: str  # "encoder" | "decoder"


@dataclass
class ForecastResult:
    asset_id: str
    forecast_date: str
    capacity_mw: float
    hourly: list[ForecastSeriesPoint]
    tft_metrics: dict[str, float]
    baseline_reference: dict[str, dict[str, float]]
    variable_importance: list[VariableImportanceRow] = field(default_factory=list)
    narrative: str = ""


class InferenceService:
    """Loads checkpoint + featured data once; runs single-window forecasts."""

    def __init__(
        self,
        *,
        data_path: Path | str | None = None,
        checkpoint_glob: str | None = None,
    ):
        self._data_path = Path(data_path) if data_path else DEFAULT_FEATURED_PATH
        glob_pat = checkpoint_glob or str(_REPO_ROOT / "models" / "tft_best*.ckpt")
        matches = sorted(glob.glob(glob_pat))
        self._checkpoint_path = matches[0] if matches else None

        self._df: pd.DataFrame | None = None
        self._training_ds: TimeSeriesDataSet | None = None
        self._model: TemporalFusionTransformer | None = None

        self.last_variable_importance: list[VariableImportanceRow] = []
        self.last_forecast_result: ForecastResult | None = None
        self.load_error: str | None = None

    def is_ready(self) -> bool:
        return self._model is not None and self._training_ds is not None

    def warmup(self) -> None:
        """Load CSV, datasets, and TFT checkpoint."""
        self.load_error = None
        try:
            if not self._checkpoint_path:
                self.load_error = "No checkpoint matched models/tft_best*.ckpt"
                return
            df = load_featured_data(self._data_path)
            training_ds, _ = build_datasets(df)
            model = TemporalFusionTransformer.load_from_checkpoint(self._checkpoint_path)
            model.eval()
            self._df = df
            self._training_ds = training_ds
            self._model = model
        except Exception as exc:  # noqa: BLE001
            self.load_error = str(exc)
            self._df = None
            self._training_ds = None
            self._model = None

    def forecast(self, asset_id: str, forecast_date: str) -> ForecastResult:
        if not self.is_ready():
            raise RuntimeError(self.load_error or "Inference service not initialized")

        assert self._model is not None and self._training_ds is not None and self._df is not None

        sub = truncate_for_forecast_window(self._df, asset_id, forecast_date)
        pred_ds = TimeSeriesDataSet.from_dataset(
            self._training_ds,
            sub,
            predict=True,
            stop_randomization=True,
        )
        if len(pred_ds) < 1:
            raise ValueError("Insufficient contiguous history for this forecast date.")

        dl = pred_ds.to_dataloader(train=False, batch_size=1, num_workers=0)
        with torch.no_grad():
            raw = self._model.predict(dl, mode="raw", return_x=True)
        preds = raw.output.prediction[0].detach().cpu().numpy()  # (24, 3)
        actual = raw.x["decoder_target"][0].detach().cpu().numpy()

        hours = forecast_hour_timestamps(forecast_date)
        hourly: list[ForecastSeriesPoint] = []
        for t in range(preds.shape[0]):
            hourly.append(
                ForecastSeriesPoint(
                    timestamp=hours[t].isoformat(),
                    p10=float(preds[t, 0]),
                    p50=float(preds[t, 1]),
                    p90=float(preds[t, 2]),
                    actual_mw=float(actual[t]),
                )
            )

        cap = CAPACITY_MW[asset_id]
        y_true = actual
        y_pred = preds[:, 1]
        tft_metrics = {
            "nMAE": float(calculate_nmae(y_true, y_pred, cap)),
            "nRMSE": float(calculate_nrmse(y_true, y_pred, cap)),
        }

        interp = self._model.interpret_output(raw.output, reduction="sum")
        enc_names = list(self._model.encoder_variables)
        dec_names = list(self._model.decoder_variables)
        enc_imp = interp["encoder_variables"].detach().cpu().numpy().reshape(-1)
        dec_imp = interp["decoder_variables"].detach().cpu().numpy().reshape(-1)

        importance_rows: list[VariableImportanceRow] = []
        for name, val in zip(enc_names, enc_imp):
            importance_rows.append(VariableImportanceRow(variable=name, importance=float(val), role="encoder"))
        for name, val in zip(dec_names, dec_imp):
            importance_rows.append(VariableImportanceRow(variable=name, importance=float(val), role="decoder"))
        importance_rows.sort(key=lambda r: r.importance, reverse=True)

        self.last_variable_importance = importance_rows

        day = parse_forecast_date(forecast_date).date().isoformat()
        narrative = _build_narrative(asset_id, hourly, tft_metrics, BASELINE_RESULTS.get(asset_id, {}))

        result = ForecastResult(
            asset_id=asset_id,
            forecast_date=day,
            capacity_mw=cap,
            hourly=hourly,
            tft_metrics=tft_metrics,
            baseline_reference=BASELINE_RESULTS.get(asset_id, {}),
            variable_importance=importance_rows,
            narrative=narrative,
        )
        self.last_forecast_result = result
        return result


def _build_narrative(
    asset_id: str,
    hourly: list[ForecastSeriesPoint],
    tft_metrics: dict[str, float],
    baselines: dict[str, dict[str, float]],
) -> str:
    p50s = [h.p50 for h in hourly]
    peak_idx = max(range(len(p50s)), key=lambda i: p50s[i])
    peak_h = peak_idx
    band = sum(h.p90 - h.p10 for h in hourly) / len(hourly)
    energy_gwh = sum(h.p50 for h in hourly) / 1000.0

    lines = [
        f"{asset_id.replace('_', ' ')} — median scenario integrates to about {energy_gwh:.2f} GWh "
        f"over the 24-hour horizon.",
        f"The strongest median output occurs around hour {peak_h:02d}:00 local clock ({p50s[peak_idx]:.0f} MW).",
        f"Average uncertainty bandwidth (P90−P10) is near {band:.0f} MW across the day.",
        (
            f"TFT normalized errors for this window: nMAE {tft_metrics['nMAE']:.4f}, "
            f"nRMSE {tft_metrics['nRMSE']:.4f} (capacity-normalized)."
        ),
    ]
    pers = baselines.get("Persistence")
    clim = baselines.get("Climatology")
    if pers and clim:
        lines.append(
            "Phase 1 reference baselines on held-out evaluation — Persistence: "
            f"nMAE {pers['nMAE']:.4f}, nRMSE {pers['nRMSE']:.4f}; "
            f"Climatology: nMAE {clim['nMAE']:.4f}, nRMSE {clim['nRMSE']:.4f}. "
            "Compare the TFT panel figures above to these benchmarks."
        )
    return " ".join(lines)


# Shared singleton for API + Streamlit (same process per worker)
_SERVICE: InferenceService | None = None


def get_service() -> InferenceService:
    global _SERVICE  # noqa: PLW0603
    if _SERVICE is None:
        data_raw = os.environ.get("FORECAST_DATA_PATH") or os.environ.get("DATA_PATH")
        ckpt_raw = os.environ.get("FORECAST_CHECKPOINT_GLOB") or os.environ.get("CHECKPOINT_GLOB")
        _SERVICE = InferenceService(
            data_path=Path(data_raw).expanduser() if data_raw else None,
            checkpoint_glob=ckpt_raw if ckpt_raw else None,
        )
        _SERVICE.warmup()
    return _SERVICE


def reset_service_for_tests() -> None:
    global _SERVICE  # noqa: PLW0603
    _SERVICE = None
