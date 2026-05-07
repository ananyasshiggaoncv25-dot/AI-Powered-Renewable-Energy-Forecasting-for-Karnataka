# AI-Powered Renewable Energy Forecasting for Karnataka

This repository implements a decision-support product for 24-hour probabilistic renewable energy forecasting across Karnataka. The current system combines a FastAPI inference backend with a React frontend to provide median and uncertainty-aware generation forecasts for selected solar and wind assets.

## What’s included

- **FastAPI backend** with a `/health` endpoint and a `/forecast` endpoint.
- **React frontend** UI implemented in `frontend/`.
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

### Frontend

```bash
cd frontend
npm install
npm run dev
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

### Run both services with Docker Compose

```bash
docker compose up --build
```

## Netlify deployment

For deploying the frontend to Netlify (static hosting) and API to a separate service:

### Frontend deployment
1. **Connect to Netlify**: Link your GitHub repo or drag-drop the `frontend/` folder.
2. **Build settings** (auto-detected from `netlify.toml`):
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: 20
3. **Environment variables** in Netlify dashboard:
   - `VITE_API_BASE_URL`: Set to your deployed API URL (e.g., `https://your-api.onrender.com`)
4. **SPA redirects**: Handled by `netlify.toml` (serves `index.html` for all routes).

### API deployment
Deploy the API to a service that supports Docker or Python:
- **Railway**: Connect GitHub repo, set build command `docker build .`, start command `uvicorn api.app:app --host 0.0.0.0 --port $PORT`
- **Render**: Use Docker, set environment variables.
- **Heroku**: Use Python buildpack or Docker.

Required environment variables for API:
- `CORS_ALLOW_ORIGINS`: Include your Netlify domain (e.g., `https://your-site.netlify.app`)
- `DATA_PATH`: Path to featured data (upload or mount)
- `CHECKPOINT_GLOB`: Path to model checkpoint

### Full deployment steps
1. Deploy API first, note the URL.
2. Deploy frontend to Netlify, set `VITE_API_BASE_URL` to API URL.
3. Test the deployed site.

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

(To clarify about the other contributor,that was is my personal git account) 
