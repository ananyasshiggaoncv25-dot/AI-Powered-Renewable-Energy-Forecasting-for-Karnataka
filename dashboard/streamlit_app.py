"""
Decision-support dashboard for TFT forecasts (Phase 3).

Run from repository root::

    streamlit run dashboard/streamlit_app.py

Ensure featured data and ``models/tft_best*.ckpt`` exist (train TFT first).
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import pandas as pd
import plotly.graph_objects as go
import requests
import streamlit as st

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from api.service import get_service  # noqa: E402

ASSET_LABELS = {
    "SOLAR_PAVAGADA": "Solar — Pavagada",
    "WIND_CHITRADURGA": "Wind — Chitradurga",
}


def _fetch_via_api(api_base: str, asset_id: str, forecast_date: str) -> dict:
    url = api_base.rstrip("/") + "/forecast"
    r = requests.post(url, json={"asset_id": asset_id, "forecast_date": forecast_date}, timeout=120)
    if not r.ok:
        raise RuntimeError(f"API error {r.status_code}: {r.text}")
    data = r.json()
    data["_importance"] = data.get("variable_importance") or []
    return data


def _forecast_local(asset_id: str, forecast_date: str) -> dict:
    svc = get_service()
    if not svc.is_ready():
        raise RuntimeError(svc.load_error or "Model not loaded")
    out = svc.forecast(asset_id, forecast_date)
    return {
        "asset_id": out.asset_id,
        "forecast_date": out.forecast_date,
        "capacity_mw": out.capacity_mw,
        "hourly": [
            {
                "timestamp": h.timestamp,
                "p10": h.p10,
                "p50": h.p50,
                "p90": h.p90,
                "actual_mw": h.actual_mw,
            }
            for h in out.hourly
        ],
        "tft_metrics": out.tft_metrics,
        "baseline_reference": out.baseline_reference,
        "narrative": out.narrative,
        "_importance": [
            {"variable": v.variable, "importance": v.importance, "role": v.role}
            for v in out.variable_importance
        ],
    }


def _make_chart(rows: list[dict], asset_id: str) -> go.Figure:
    df = pd.DataFrame(rows)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    fig = go.Figure()
    fig.add_trace(
        go.Scatter(
            x=df["timestamp"],
            y=df["p90"],
            mode="lines",
            line=dict(width=0),
            showlegend=False,
            hoverinfo="skip",
        )
    )
    fig.add_trace(
        go.Scatter(
            x=df["timestamp"],
            y=df["p10"],
            mode="lines",
            fill="tonexty",
            fillcolor="rgba(56, 189, 248, 0.18)",
            line=dict(width=0),
            name="P10–P90 band",
        )
    )
    fig.add_trace(
        go.Scatter(
            x=df["timestamp"],
            y=df["p50"],
            mode="lines+markers",
            line=dict(color="#38bdf8", width=2),
            marker=dict(size=4),
            name="P50 (median)",
        )
    )
    fig.add_trace(
        go.Scatter(
            x=df["timestamp"],
            y=df["actual_mw"],
            mode="lines",
            line=dict(color="#fbbf24", width=2, dash="dot"),
            name="Actual",
        )
    )
    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=48, r=24, t=48, b=48),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        yaxis_title="MW",
        xaxis_title="Hour",
        title=f"24-hour probabilistic forecast — {ASSET_LABELS.get(asset_id, asset_id)}",
        hovermode="x unified",
    )
    fig.update_yaxes(gridcolor="rgba(148,163,184,0.15)")
    fig.update_xaxes(gridcolor="rgba(148,163,184,0.15)")
    return fig


def _baseline_figure(tft: dict[str, float], baseline: dict[str, dict[str, float]]) -> go.Figure:
    models = ["TFT (P50)"] + list(baseline.keys())
    nmae = [tft["nMAE"]] + [baseline[m]["nMAE"] for m in baseline]
    nrmse = [tft["nRMSE"]] + [baseline[m]["nRMSE"] for m in baseline]
    fig = go.Figure()
    fig.add_bar(name="nMAE", x=models, y=nmae, marker_color="#38bdf8")
    fig.add_bar(name="nRMSE", x=models, y=nrmse, marker_color="#a78bfa")
    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        barmode="group",
        margin=dict(l=48, r=24, t=48, b=80),
        legend=dict(orientation="h", yanchor="bottom", y=1.02, xanchor="right", x=1),
        title="Normalized error vs Phase 1 baselines (this forecast window)",
        yaxis_title="Error / capacity",
    )
    fig.update_yaxes(gridcolor="rgba(148,163,184,0.15)")
    return fig


def _importance_figure(rows: list[dict], top_n: int = 12) -> go.Figure:
    df = pd.DataFrame(rows).sort_values("importance", ascending=True).tail(top_n)
    y_labels = df["variable"].astype(str) + " (" + df["role"].astype(str) + ")"
    fig = go.Figure(
        go.Bar(
            x=df["importance"],
            y=y_labels,
            orientation="h",
            marker=dict(color=df["role"].map({"encoder": "#34d399", "decoder": "#60a5fa"})),
        )
    )
    fig.update_layout(
        template="plotly_dark",
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(0,0,0,0)",
        margin=dict(l=200, r=24, t=48, b=48),
        title="Variable importance (last TFT inference)",
        xaxis_title="Importance (aggregated)",
    )
    fig.update_xaxes(gridcolor="rgba(148,163,184,0.15)")
    return fig


def main() -> None:
    st.set_page_config(
        page_title="Renewable Forecast — Decision Support",
        page_icon="⚡",
        layout="wide",
    )
    st.markdown(
        "<h1 style='margin-bottom:0.2rem'>Karnataka renewable forecasts</h1>"
        "<p style='color:#94a3b8;margin-top:0'>Phase 3 · TFT quantiles · operational narrative</p>",
        unsafe_allow_html=True,
    )

    default_api_base = os.environ.get("STREAMLIT_API_BASE", "")

    with st.sidebar:
        st.subheader("Controls")
        api_base = st.text_input(
            "API base URL (empty = in-process)",
            value=default_api_base or "",
            placeholder="http://127.0.0.1:8000",
        )
        asset_id = st.selectbox("Asset", list(ASSET_LABELS.keys()), format_func=lambda k: ASSET_LABELS[k])
        forecast_date = st.date_input("Forecast date", value=pd.Timestamp("2023-06-15").date())
        run = st.button("Run forecast", type="primary")

    if not run:
        st.info("Pick an asset and date, then click **Run forecast**.")
        return

    importance: list[dict[str, object]] = []
    try:
        fd = forecast_date.isoformat()
        if api_base.strip():
            payload = _fetch_via_api(api_base.strip(), asset_id, fd)
        else:
            payload = _forecast_local(asset_id, fd)
        importance = payload.get("_importance", [])
    except Exception as exc:  # noqa: BLE001
        st.error(str(exc))
        return

    col_chart, col_side = st.columns([2.1, 1.0])

    with col_chart:
        st.plotly_chart(_make_chart(payload["hourly"], payload["asset_id"]), use_container_width=True)

    with col_side:
        st.metric("Capacity", f"{payload['capacity_mw']:.0f} MW")
        st.metric("nMAE (TFT)", f"{payload['tft_metrics']['nMAE']:.4f}")
        st.metric("nRMSE (TFT)", f"{payload['tft_metrics']['nRMSE']:.4f}")

    st.plotly_chart(
        _baseline_figure(payload["tft_metrics"], payload["baseline_reference"]),
        use_container_width=True,
    )

    imp_rows = importance if importance else payload.get("_importance", [])
    if imp_rows:
        st.plotly_chart(_importance_figure(imp_rows), use_container_width=True)

    st.subheader("Operational narrative")
    st.write(payload.get("narrative", ""))


if __name__ == "__main__":
    main()
