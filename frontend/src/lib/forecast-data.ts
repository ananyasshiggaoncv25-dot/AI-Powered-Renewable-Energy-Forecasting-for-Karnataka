// Mock forecast data generator for solar & wind probabilistic forecasts.
// Produces hourly P10/P50/P90 bands plus actuals up to "now".

export type AssetType = "solar" | "wind";
export type Horizon = "day-ahead" | "intra-day" | "hourly";

export interface ForecastPoint {
  hour: number;
  label: string;
  p10: number;
  p50: number;
  p90: number;
  actual?: number;
  weather: number; // irradiance for solar (W/m²) or wind speed (m/s)
}

export const DISTRICTS = [
  "Tumakuru",
  "Kalaburagi",
  "Koppal",
  "Chitradurga",
  "Gadag",
  "Ballari",
] as const;
export type District = (typeof DISTRICTS)[number];

export interface Asset {
  id: string;
  name: string;
  type: AssetType;
  capacity: number; // MW
  district: District;
  region: string;
  cluster: string;
  lat: number;
  lng: number;
}

export const ASSETS: Asset[] = [
  { id: "sol-pavagada-01", name: "Pavagada Solar Park", type: "solar", capacity: 2050, district: "Tumakuru", region: "Tumakuru, Karnataka", cluster: "Pavagada Solar Cluster", lat: 14.10, lng: 77.28 },
  { id: "sol-kalaburagi-02", name: "Kalaburagi PV Field", type: "solar", capacity: 320, district: "Kalaburagi", region: "Kalaburagi, Karnataka", cluster: "North Karnataka Solar Cluster", lat: 17.33, lng: 76.83 },
  { id: "sol-koppal-03", name: "Koppal Solar Plant", type: "solar", capacity: 280, district: "Koppal", region: "Koppal, Karnataka", cluster: "North Karnataka Solar Cluster", lat: 15.35, lng: 76.15 },
  { id: "win-chitradurga-01", name: "Chitradurga Wind Farm", type: "wind", capacity: 410, district: "Chitradurga", region: "Chitradurga, Karnataka", cluster: "Chitradurga Wind Cluster", lat: 14.23, lng: 76.40 },
  { id: "win-gadag-02", name: "Kappatagudda Wind Farm", type: "wind", capacity: 260, district: "Gadag", region: "Gadag, Karnataka", cluster: "Gadag Wind Cluster", lat: 15.43, lng: 75.63 },
  { id: "win-bellary-03", name: "Sandur Ridge Wind", type: "wind", capacity: 180, district: "Ballari", region: "Ballari, Karnataka", cluster: "Bellary Wind Cluster", lat: 15.10, lng: 76.55 },
];

// Deterministic pseudo-random for stable mock data
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function generateForecast(
  asset: Asset,
  horizon: Horizon,
  currentHour = 14,
  revision = 0,
): ForecastPoint[] {
  const horizonSeed = horizon === "day-ahead" ? 7 : horizon === "intra-day" ? 11 : 17;
  const rand = seeded(asset.id.length * 13 + horizonSeed + revision * 31);
  const hours = 24;
  const out: ForecastPoint[] = [];

  // Uncertainty width shrinks as horizon gets shorter
  const widthFactor = horizon === "day-ahead" ? 0.22 : horizon === "intra-day" ? 0.13 : 0.07;

  for (let h = 0; h < hours; h++) {
    let base = 0;
    let weather = 0;

    if (asset.type === "solar") {
      // Bell curve around solar noon (h=12)
      const x = (h - 12) / 5;
      base = Math.max(0, Math.exp(-x * x) * asset.capacity * (0.78 + rand() * 0.18));
      weather = Math.max(0, Math.exp(-x * x) * 950 + (rand() - 0.5) * 80);
    } else {
      // Wind: noisy diurnal pattern
      const diurnal = 0.6 + 0.35 * Math.sin((h / 24) * Math.PI * 2 + asset.lat * 0.1);
      base = Math.max(0, asset.capacity * diurnal * (0.55 + rand() * 0.4));
      weather = 4 + diurnal * 8 + (rand() - 0.5) * 2;
    }

    const noise = (rand() - 0.5) * asset.capacity * 0.05;
    const p50 = Math.max(0, base + noise);
    const width = p50 * widthFactor + asset.capacity * 0.02;
    const p10 = Math.max(0, p50 - width);
    const p90 = Math.min(asset.capacity, p50 + width);

    const point: ForecastPoint = {
      hour: h,
      label: `${String(h).padStart(2, "0")}:00`,
      p10: round(p10),
      p50: round(p50),
      p90: round(p90),
      weather: round(weather),
    };

    if (h <= currentHour && horizon !== "day-ahead") {
      point.actual = round(Math.max(0, p50 + (rand() - 0.5) * width * 0.8));
    }

    out.push(point);
  }
  return out;
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}

export interface ClusterStats {
  totalCapacity: number;
  predictedMWh: number;
  accuracy: number;
  confidence: "High" | "Medium" | "Low";
  mae: number;
}

export function computeStats(points: ForecastPoint[], capacity: number): ClusterStats {
  const predictedMWh = points.reduce((s, p) => s + p.p50, 0);
  const withActual = points.filter((p) => p.actual !== undefined);
  const errors = withActual.map((p) => Math.abs((p.actual as number) - p.p50));
  const mae = errors.length ? errors.reduce((a, b) => a + b, 0) / errors.length : 0;
  const accuracy = withActual.length ? Math.max(0, 100 - (mae / capacity) * 100) : 96.4;
  const conf: ClusterStats["confidence"] = accuracy > 95 ? "High" : accuracy > 90 ? "Medium" : "Low";
  return {
    totalCapacity: capacity,
    predictedMWh: round(predictedMWh),
    accuracy: round(accuracy),
    confidence: conf,
    mae: round(mae),
  };
}

// Driver attribution for the P10/P50/P90 spread.
export interface UncertaintyDriver {
  factor: string;
  share: number; // 0..1
  description: string;
}

export function getUncertaintyDrivers(
  asset: Asset,
  horizon: Horizon,
): UncertaintyDriver[] {
  // Horizon-dependent emphasis. Longer horizon → weather model error dominates.
  const long = horizon === "day-ahead" ? 1 : horizon === "intra-day" ? 0.6 : 0.3;
  if (asset.type === "solar") {
    const raw = [
      { factor: "Cloud cover variability", share: 0.45 + 0.15 * long, description: "Convective clouds shift P10 sharply on hot afternoons." },
      { factor: "Aerosol & dust load", share: 0.18 + 0.05 * long, description: "Pre-monsoon dust over Tumakuru reduces direct irradiance." },
      { factor: "Panel temperature", share: 0.12, description: "Higher module temp lowers efficiency, biases P50 down." },
      { factor: "NWP irradiance error", share: 0.15 + 0.10 * long, description: "ECMWF SSRD bias grows with lead time." },
      { factor: "Soiling & telemetry noise", share: 0.10, description: "Sensor drift between O&M cleanings." },
    ];
    return normalize(raw);
  }
  const raw = [
    { factor: "Wind speed forecast error", share: 0.50 + 0.15 * long, description: "Hub-height wind from NWP is the largest driver of MW spread." },
    { factor: "Wind direction shifts", share: 0.15 + 0.05 * long, description: "Wake effects change with veer across the farm." },
    { factor: "Air density (temp & pressure)", share: 0.12, description: "Cooler nights raise density and output; thermal cycle adds noise." },
    { factor: "Turbulence intensity", share: 0.13 + 0.05 * long, description: "Affects derating and short-term ramps." },
    { factor: "Curtailment & availability", share: 0.10, description: "Grid curtailments and turbine downtime." },
  ];
  return normalize(raw);
}

function normalize(rows: UncertaintyDriver[]): UncertaintyDriver[] {
  const total = rows.reduce((s, r) => s + r.share, 0);
  return rows
    .map((r) => ({ ...r, share: r.share / total }))
    .sort((a, b) => b.share - a.share);
}
