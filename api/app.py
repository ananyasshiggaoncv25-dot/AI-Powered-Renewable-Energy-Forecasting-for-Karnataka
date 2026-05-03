"""
FastAPI inference API for TFT forecasts (Phase 3).
Run from repository root: ``uvicorn api.app:app --reload``
"""
from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from api.service import get_service


class ForecastRequest(BaseModel):
    asset_id: str = Field(..., examples=["SOLAR_PAVAGADA"])
    forecast_date: str = Field(
        ...,
        description="ISO calendar date for the 24-hour forecast window starting at midnight.",
        examples=["2023-06-15"],
    )


class HourlyRow(BaseModel):
    timestamp: str
    p10: float
    p50: float
    p90: float
    actual_mw: float


class ForecastResponse(BaseModel):
    asset_id: str
    forecast_date: str
    capacity_mw: float
    hourly: list[HourlyRow]
    tft_metrics: dict[str, float]
    baseline_reference: dict[str, dict[str, float]]
    narrative: str
    variable_importance: list[dict[str, Any]] = Field(default_factory=list)


class VariableImportanceResponse(BaseModel):
    variables: list[dict[str, Any]]


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    detail: str | None = None


app = FastAPI(title="Karnataka Renewable TFT API", version="0.1.0")

_cors_raw = os.environ.get("CORS_ALLOW_ORIGINS", "*").strip()
_cors_list = [o.strip() for o in _cors_raw.split(",") if o.strip()]
_origins = _cors_list if _cors_list else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    svc = get_service()
    if svc.is_ready():
        return HealthResponse(status="ok", model_loaded=True, detail=None)
    return HealthResponse(
        status="degraded",
        model_loaded=False,
        detail=svc.load_error or "Model not loaded",
    )


@app.post("/forecast", response_model=ForecastResponse)
def forecast(body: ForecastRequest) -> ForecastResponse:
    svc = get_service()
    if not svc.is_ready():
        raise HTTPException(
            status_code=503,
            detail=svc.load_error or "Model unavailable. Train TFT and place checkpoint under models/",
        )
    try:
        result = svc.forecast(body.asset_id.strip(), body.forecast_date.strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    hourly = [
        HourlyRow(
            timestamp=h.timestamp,
            p10=h.p10,
            p50=h.p50,
            p90=h.p90,
            actual_mw=h.actual_mw,
        )
        for h in result.hourly
    ]
    importance_payload = [
        {"variable": r.variable, "importance": r.importance, "role": r.role}
        for r in result.variable_importance
    ]
    return ForecastResponse(
        asset_id=result.asset_id,
        forecast_date=result.forecast_date,
        capacity_mw=result.capacity_mw,
        hourly=hourly,
        tft_metrics=result.tft_metrics,
        baseline_reference=result.baseline_reference,
        narrative=result.narrative,
        variable_importance=importance_payload,
    )


@app.get("/variable-importance", response_model=VariableImportanceResponse)
def variable_importance() -> VariableImportanceResponse:
    svc = get_service()
    if not svc.last_variable_importance:
        raise HTTPException(
            status_code=404,
            detail="No inference yet. POST /forecast first.",
        )
    rows = [
        {"variable": r.variable, "importance": r.importance, "role": r.role}
        for r in svc.last_variable_importance
    ]
    return VariableImportanceResponse(variables=rows)
