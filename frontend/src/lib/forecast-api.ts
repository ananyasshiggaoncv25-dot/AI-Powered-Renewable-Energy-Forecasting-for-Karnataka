/**
 * FastAPI /forecast client + mapping to chart rows.
 *
 * Set ``VITE_API_BASE_URL`` (e.g. ``/api`` with Vite proxy, or ``http://127.0.0.1:8000``).
 * Only assets listed in ``BACKEND_ASSET_IDS`` use the API; others stay on mock data.
 */
import type { Asset, ForecastPoint } from "@/lib/forecast-data";

/** Frontend asset id → TFT ``asset_id`` in featured CSV / API. */
export const BACKEND_ASSET_IDS: Record<string, string> = {
  "sol-pavagada-01": "SOLAR_PAVAGADA",
  "win-chitradurga-01": "WIND_CHITRADURGA",
};

export function getApiBaseUrl(): string {
  return (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? "";
}

export function getBackendAssetId(frontendAssetId: string): string | undefined {
  return BACKEND_ASSET_IDS[frontendAssetId];
}

export interface ForecastApiHourlyRow {
  timestamp: string;
  p10: number;
  p50: number;
  p90: number;
  actual_mw: number;
}

export interface ForecastApiResponse {
  asset_id: string;
  forecast_date: string;
  capacity_mw: number;
  hourly: ForecastApiHourlyRow[];
  tft_metrics: { nMAE: number; nRMSE: number };
  baseline_reference: Record<string, { nMAE: number; nRMSE: number }>;
  narrative: string;
  variable_importance?: { variable: string; importance: number; role: string }[];
}

export async function fetchForecast(
  baseUrl: string,
  asset_id: string,
  forecast_date: string,
  signal?: AbortSignal,
): Promise<ForecastApiResponse> {
  const root = baseUrl.replace(/\/$/, "");
  const res = await fetch(`${root}/forecast`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ asset_id, forecast_date }),
    signal,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(text || `${res.status} ${res.statusText}`);
  }
  return JSON.parse(text) as ForecastApiResponse;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

/** Derive a simple ``weather`` scalar for charts/tooltips from median MW (irradiance proxy / wind proxy). */
export function hourlyToForecastPoints(hourly: ForecastApiHourlyRow[], asset: Asset): ForecastPoint[] {
  const cap = Math.max(asset.capacity, 1);
  return hourly.map((row, hour) => {
    const { p50 } = row;
    const weather =
      asset.type === "solar"
        ? Math.min(980, (p50 / cap) * 950)
        : 3 + (p50 / cap) * 12;

    return {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      p10: round1(row.p10),
      p50: round1(row.p50),
      p90: round1(row.p90),
      actual: round1(row.actual_mw),
      weather: round1(weather),
    };
  });
}
