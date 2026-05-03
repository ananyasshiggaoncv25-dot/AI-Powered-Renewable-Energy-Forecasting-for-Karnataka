# Product Requirements Document

## Project Overview

**AI-Powered Renewable Energy Forecasting for Karnataka** is a decision-support product that delivers 24-hour probabilistic power generation forecasts for utility-scale solar and wind assets in Karnataka. The current implementation includes:

- A FastAPI inference service with a `/forecast` endpoint for generating TFT-based forecasts.
- A React frontend dashboard for interactive forecast exploration, uncertainty visualization, and narrative summaries.
- A shared inference service that loads a trained Temporal Fusion Transformer checkpoint and featured historical data.

The product is currently optimized for two assets:

- `SOLAR_PAVAGADA`
- `WIND_CHITRADURGA`

## Problem Statement

Grid operators and renewable energy planners need reliable day-ahead generation forecasts to match supply with demand, manage reserves, and reduce curtailment. Existing forecasts may not provide probabilistic uncertainty bands, nor do they clearly compare performance against baseline persistence and climatology models.

This product aims to provide a high-confidence, operationally useful forecast experience by delivering:

- hourly probabilistic generation forecasts (P10/P50/P90)
- model performance metrics normalized by asset capacity
- baseline comparisons to earlier Phase 1 models
- interpretable variable importance and narrative summaries

## Target Users

- Renewable energy operations managers
- Grid planning analysts
- Forecasting engineers
- Product managers overseeing deployment of AI-powered renewable forecasting

## Success Metrics

The product is successful when:

- it can generate a valid 24-hour forecast for a selected asset and date
- it returns actionable probabilistic output including P10, P50, and P90 values
- the forecast service reports normalized error metrics (`nMAE`, `nRMSE`)
- the dashboard enables users to compare TFT performance against persistence and climatology baselines
- the system can load the trained checkpoint and featured dataset reliably

## Current Product Capabilities

### Forecast API

The backend exposes a FastAPI service with the following endpoints:

- `GET /health`
  - returns service status, model readiness, and diagnostic detail
- `POST /forecast`
  - accepts `asset_id` and `forecast_date`
  - returns 24-hour forecast rows with `timestamp`, `p10`, `p50`, `p90`, and `actual_mw`
  - includes `capacity_mw`, `tft_metrics`, `baseline_reference`, `narrative`, and `variable_importance`
- `GET /variable-importance`
  - returns the most recent forecast’s variable importance rows

The model response is designed for integration with dashboards and downstream decision systems.

### Dashboard Experience

The React frontend provides:

- asset selection for supported assets
- forecast date picker
- remote API execution against the FastAPI backend
- a time-series chart showing median forecast, uncertainty band, and actual output
- a benchmark comparison chart for TFT vs persistence and climatology baselines
- a variable importance chart for encoder and decoder inputs
- a narrative summary describing the forecast shape, peak hour, uncertainty, and error performance

### Inference Pipeline

The shared inference service:

- loads featured data from `data/processed/featured_generation.csv`
- builds TFT training and inference datasets using `src.models.train_tft.build_datasets`
- loads the best checkpoint from `models/tft_best*.ckpt`
- runs one-window forecast inference via `pytorch_forecasting.TemporalFusionTransformer`
- computes normalized metrics using `src.evaluation.metrics`
- interprets model variable importance and sorts variables by aggregated importance
- constructs a human-readable narrative summarizing output and baseline reference stats

## User Stories

1. As a forecast analyst, I want to request a 24-hour forecast for a selected asset and date so I can plan generation schedules.
2. As a grid operator, I want to see P10/P50/P90 uncertainty bands so I can understand the range of likely outcomes.
3. As a product owner, I want an API health check so I can monitor whether the model is loaded and ready.
4. As a decision-maker, I want benchmark comparisons to persistence and climatology so I can trust TFT improvements over earlier approaches.
5. As a data scientist, I want variable importance detail so I can investigate which features drive encoder and decoder predictions.
6. As an operations engineer, I want the dashboard to run locally or via remote API so I can validate deployment options.

## Functional Requirements

### Forecast Service

- FR1: The system must expose a REST endpoint to accept `asset_id` and `forecast_date`.
- FR2: The service must validate input and return `400` for invalid asset or date values.
- FR3: The service must return `503` when the model checkpoint or dataset is unavailable.
- FR4: Forecast output must include hourly `p10`, `p50`, `p90`, and actual values.
- FR5: Forecast output must include model performance metrics normalized to asset capacity.
- FR6: Forecast output must include baseline reference values for persistence and climatology.
- FR7: A dedicated variable importance endpoint must return the latest forecast’s importance ranking.

### Dashboard

- FR8: The dashboard must allow users to input forecast date and asset selection.
- FR9: The dashboard must support both in-process model execution and remote API usage.
- FR10: Forecast visualization must display median prediction, uncertainty band, and actual outcomes.
- FR11: Benchmark visualization must compare TFT error metrics against baseline models.
- FR12: The dashboard must present a narrative summary of the forecast window.

## Technical Requirements

### Data Requirements

- DR1: The system depends on prepared featured data at `data/processed/featured_generation.csv`.
- DR2: The model uses checkpoint files matching `models/tft_best*.ckpt`.
- DR3: The service expects consistent history for the selected asset and forecast date; insufficient history must be handled gracefully.

### Model Requirements

- MR1: The product uses a trained Temporal Fusion Transformer (TFT) checkpoint.
- MR2: The model must load once per service process and remain ready for inference.
- MR3: The inference service must compute variable importance via TFT interpretation.

### Architecture and Deployment

- AR1: The backend uses FastAPI and is deployable via `uvicorn api.app:app --reload`.
- AR2: The frontend uses a React/Vite app and is launchable via `npm run dev` from `frontend/`.
- AR3: CORS is enabled for the API with origins controlled by `CORS_ALLOW_ORIGINS`.
- AR4: The shared backend service is reusable by the React frontend.

## Constraints and Assumptions

- The product currently supports only two assets, defined in code as `SOLAR_PAVAGADA` and `WIND_CHITRADURGA`.
- The model checkpoint must already exist in `models/`; training is not part of the deployed service.
- Historical and featured data are prepared offline and available before inference.
- The dashboard and API do not currently include authentication or multi-tenant support.

## Future Roadmap

### Phase 4: Expanded Operational Readiness

- Expand asset coverage to additional solar and wind farms across Karnataka.
- Add automated checkpoint discovery and model retraining pipelines.
- Implement production-grade deployment with Docker, Kubernetes, or cloud serverless infrastructure.
- Add authentication, telemetry, and usage logging for API endpoints.
- Add scheduled batch forecasting and alerting for anomalous forecast errors.

### Phase 5: Enhanced Forecast Products

- Support multi-day ahead horizons beyond 24 hours.
- Add weather-driven input uplift and dynamic exogenous feature ingestion.
- Introduce probabilistic scenario comparisons with weather ensemble data.
- Offer API contract versioning and documented OpenAPI/Swagger schemas.

### Phase 6: User and Business Value

- Build stakeholder-facing reports for capacity planning, reserve sizing, and renewable integration.
- Add operational dashboards for reserve margin, curtailment risk, and intraday balancing.
- Measure business value by forecasting accuracy improvement, reserve reduction, and operational confidence.

## Risks and Mitigations

- Risk: model checkpoint or featured data is missing or incompatible.
  - Mitigation: validate paths at startup and expose health status with diagnostic detail.
- Risk: insufficient history for a forecast window.
  - Mitigation: return user-friendly error responses and document data requirements.
- Risk: users misinterpret median forecasts as deterministic output.
  - Mitigation: clearly label P10/P50/P90 and show uncertainty bands in the dashboard.

## Appendix

### Key Implementation Notes

- The API and dashboard share `api.service.get_service()` to load the TFT checkpoint and data once per process.
- Forecast narratives are generated from the median curve, peak hour, uncertainty band, and normalized error metrics.
- Baseline comparisons are hard-coded in `api.service.BASELINE_RESULTS` for the supported assets.

### Launch Checklist

- [ ] Confirm `models/tft_best*.ckpt` is available and compatible.
- [ ] Confirm `data/processed/featured_generation.csv` is present and up-to-date.
- [ ] Test `POST /forecast` for both supported asset IDs.
- [ ] Validate dashboard rendering and the in-process / remote API mode.
- [ ] Review health endpoint behavior when model load fails.
