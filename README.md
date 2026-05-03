# AI-Powered Renewable Energy Forecasting for Karnataka

This repository implements a decision-support product for 24-hour probabilistic renewable energy forecasting across Karnataka. The current system combines a FastAPI inference backend with a Streamlit dashboard to provide median and uncertainty-aware generation forecasts for selected solar and wind assets.

## What’s included

- **FastAPI backend** with a `/health` endpoint and a `/forecast` endpoint.
- **Streamlit dashboard** with asset selection, date input, forecast visualization, and narrative summaries.
- **Shared inference service** that loads featured data and a trained Temporal Fusion Transformer (TFT) checkpoint.
- **Baseline comparison** functionality for persistence and climatology models.
- **Docker deployment artifacts** for Phase 4 operational readiness.

## Supported assets

- `SOLAR_PAVAGADA`
- `WIND_CHITRADURGA`

## How to run locally

### API

```bash
uvicorn api.app:app --reload
```

### Dashboard

```bash
streamlit run dashboard/streamlit_app.py
```

## Data and model requirements

- `data/processed/featured_generation.csv` must exist and contain the featured dataset.
- `models/tft_best*.ckpt` must exist and be a trained TFT checkpoint.

## React frontend

The app frontend UI is implemented in the `frontend/` directory and matches the UI/UX from the referenced repository.

### Local development

```bash
cd frontend
npm install
npm run dev
```

The frontend runs by default on `http://localhost:8080` and expects the API at the `VITE_API_BASE_URL` environment variable.

## Docker deployment

### Build the container

```bash
docker build -t karnataka-renewable-forecast .
```

### Run the API container

```bash
docker run --rm -p 8000:8000 \
  -v "$PWD/data/processed:/app/data/processed:ro" \
  -v "$PWD/models:/app/models:ro" \
  -e CORS_ALLOW_ORIGINS="*" \
  -e DATA_PATH="/app/data/processed/featured_generation.csv" \
  -e CHECKPOINT_GLOB="/app/models/tft_best*.ckpt" \
  karnataka-renewable-forecast \
  uvicorn api.app:app --host 0.0.0.0 --port 8000
```

### Run the dashboard container

```bash
docker run --rm -p 8501:8501 \
  -v "$PWD:/app:ro" \
  -e STREAMLIT_API_BASE="http://host.docker.internal:8000" \
  karnataka-renewable-forecast \
  streamlit run dashboard/streamlit_app.py --server.port 8501 --server.address 0.0.0.0 --server.headless true
```

### Run both services with Docker Compose

```bash
docker compose up --build
```

## Current capabilities

- Hourly probabilistic forecasts with `P10`, `P50`, `P90`, and actual output.
- Capacity-normalized error metrics `nMAE` and `nRMSE`.
- Benchmark comparisons against Phase 1 baselines.
- Variable importance interpretation for encoder and decoder features.
- Narrative summaries describing forecast shape, peak hour, uncertainty, and performance.

## Phase 4: Expanded Operational Readiness

This project roadmap includes a Phase 4 focus on making the forecasting system operationally robust and scalable:

- Expand supported asset coverage to additional solar and wind farms across Karnataka.
- Add automated checkpoint discovery and model retraining pipelines.
- Implement production-grade deployment tooling such as Docker, Kubernetes, or cloud infrastructure.
- Add authentication, telemetry, and usage logging for API endpoints.
- Add scheduled batch forecasting and alerting for anomalous forecast errors.

## Future enhancements

- Support multi-day ahead horizons.
- Integrate weather-driven exogenous features and ensemble forecast scenarios.
- Provide documented API versioning with OpenAPI/Swagger.
- Add stakeholder-facing dashboards for reserve margin, curtailment risk, and operational confidence.

## Notes

The current codebase assumes offline data preparation and model training. The API and dashboard are designed for evaluation and decision support rather than a fully packaged production deployment.
