import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, Gauge, Sparkles, Sun, TrendingUp, Wind } from "lucide-react";
import { Header } from "@/components/forecast/Header";
import { KpiCard } from "@/components/forecast/KpiCard";
import { ForecastChart } from "@/components/forecast/ForecastChart";
import { AssetSelector } from "@/components/forecast/AssetSelector";
import { WeatherPanel } from "@/components/forecast/WeatherPanel";
import { HorizonTabs } from "@/components/forecast/HorizonTabs";
import { KarnatakaMap } from "@/components/forecast/KarnatakaMap";
import { DistrictFilter } from "@/components/forecast/DistrictFilter";
import { RefreshControl } from "@/components/forecast/RefreshControl";
import { UncertaintyBreakdown } from "@/components/forecast/UncertaintyBreakdown";
import {
  ASSETS,
  AssetType,
  DISTRICTS,
  District,
  Horizon,
  computeStats,
  generateForecast,
  type ForecastPoint,
} from "@/lib/forecast-data";
import {
  fetchForecast,
  getApiBaseUrl,
  getBackendAssetId,
  hourlyToForecastPoints,
} from "@/lib/forecast-api";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/hooks/use-toast";

const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const TICK_MS = 1000;

type Tab = 'dashboard' | 'assets' | 'models' | 'reports';

const Index = () => {
  const { t } = useI18n();
  const apiBase = getApiBaseUrl();
  const [currentTab, setCurrentTab] = useState<Tab>('dashboard');
  const [district, setDistrict] = useState<District | "all">("all");
  const [filter, setFilter] = useState<AssetType | "all">("all");
  const [selectedId, setSelectedId] = useState(ASSETS[0].id);
  const [horizon, setHorizon] = useState<Horizon>("intra-day");
  const [forecastDate, setForecastDate] = useState("2023-06-15");

  const [revision, setRevision] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [nextInMs, setNextInMs] = useState(REFRESH_INTERVAL_MS);
  const [apiLivePoints, setApiLivePoints] = useState<ForecastPoint[] | null>(null);
  const [apiPrevPoints, setApiPrevPoints] = useState<ForecastPoint[] | null>(null);

  // District counts for the chip filter
  const districtCounts = useMemo(() => {
    const c: Record<string, number> = { all: ASSETS.length };
    DISTRICTS.forEach((d) => (c[d] = ASSETS.filter((a) => a.district === d).length));
    return c as Record<District | "all", number>;
  }, []);

  // Filter assets by district + type
  const visibleAssets = useMemo(
    () =>
      ASSETS.filter(
        (a) => (district === "all" || a.district === district) && (filter === "all" || a.type === filter)
      ),
    [district, filter]
  );

  // Keep the selected asset valid given the filters
  useEffect(() => {
    if (!visibleAssets.find((a) => a.id === selectedId) && visibleAssets[0]) {
      setSelectedId(visibleAssets[0].id);
    }
  }, [visibleAssets, selectedId]);

  const asset = useMemo(
    () => ASSETS.find((a) => a.id === selectedId) ?? ASSETS[0],
    [selectedId]
  );

  const backendAssetId = getBackendAssetId(asset.id);
  const useTftApi = Boolean(apiBase && backendAssetId);

  const mockSeries = useMemo(
    () => generateForecast(asset, horizon, 14, revision),
    [asset, horizon, revision]
  );

  useEffect(() => {
    if (!apiBase || !backendAssetId) {
      setApiLivePoints(null);
      setApiPrevPoints(null);
      return;
    }
    const ac = new AbortController();
    (async () => {
      try {
        const json = await fetchForecast(apiBase, backendAssetId, forecastDate, ac.signal);
        const pts = hourlyToForecastPoints(json.hourly, asset);
        setApiLivePoints((old) => {
          setApiPrevPoints(old);
          return pts;
        });
      } catch (err: unknown) {
        if (ac.signal.aborted) return;
        const msg = err instanceof Error ? err.message : String(err);
        toast({ title: "Forecast API", description: msg, variant: "destructive" });
        setApiLivePoints(null);
        setApiPrevPoints(null);
      }
    })();
    return () => ac.abort();
  }, [apiBase, backendAssetId, forecastDate, revision, asset.id, asset.type, asset.capacity]);

  // TFT-backed assets use API quantiles when configured; others stay mock.
  const data = useTftApi && apiLivePoints !== null ? apiLivePoints : mockSeries;

  const prevData = useMemo(() => {
    if (useTftApi) {
      return apiPrevPoints !== null ? apiPrevPoints : data;
    }
    return revision === 0 ? mockSeries : generateForecast(asset, horizon, 14, revision - 1);
  }, [useTftApi, apiPrevPoints, data, revision, mockSeries, asset, horizon]);

  const stats = useMemo(() => computeStats(data, asset.capacity), [data, asset]);
  const prevStats = useMemo(
    () => computeStats(prevData, asset.capacity),
    [prevData, asset]
  );

  const peak = Math.max(...data.map((d) => d.p50));
  const avgBandWidth = data.reduce((s, d) => s + (d.p90 - d.p10), 0) / data.length;

  const deltaPredicted = stats.predictedMWh - prevStats.predictedMWh;
  const deltaAccuracy = stats.accuracy - prevStats.accuracy;
  const deltaBand = avgBandWidth - prevData.reduce((s, d) => s + (d.p90 - d.p10), 0) / prevData.length;

  // KPIs for the active district scope (sum across visible assets, current horizon)
  const scopeStats = useMemo(() => {
    const totalCap = visibleAssets.reduce((s, a) => s + a.capacity, 0);
    const totalPredicted = visibleAssets.reduce((s, a) => {
      const d = generateForecast(a, horizon, 14, revision);
      return s + d.reduce((ss, p) => ss + p.p50, 0);
    }, 0);
    return { totalCap, totalPredicted };
  }, [visibleAssets, horizon, revision]);

  // ---- Auto-refresh loop ----
  const triggerRefresh = (silent = false) => {
    setRevision((r) => r + 1);
    setLastUpdated(new Date());
    setNextInMs(REFRESH_INTERVAL_MS);
    if (!silent) {
      toast({
        title: t("refresh.toastTitle"),
        description: `${t("refresh.updated")} ${new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}`,
      });
    }
  };

  const tickRef = useRef<number | null>(null);
  useEffect(() => {
    if (!autoRefresh) {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    setNextInMs(REFRESH_INTERVAL_MS);
    setLastUpdated(new Date());
    tickRef.current = window.setInterval(() => {
      setNextInMs((ms) => {
        const next = ms - TICK_MS;
        if (next <= 0) {
          // refresh
          setRevision((r) => r + 1);
          setLastUpdated(new Date());
          return REFRESH_INTERVAL_MS;
        }
        return next;
      });
    }, TICK_MS);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [autoRefresh]);

  const renderDashboard = () => (
    <>
      {/* Hero */}
      <section className="mb-8 lg:mb-10 animate-fade-in-up">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-primary/8 text-primary border border-primary/15 mb-4">
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t("hero.badge")}</span>
            </div>
            <h1 className="font-display text-4xl lg:text-5xl font-semibold leading-[1.05] tracking-tight">
              {t("hero.title1")}
              <span className="block text-muted-foreground font-normal italic">
                {t("hero.title2")}
              </span>
            </h1>
            <p className="mt-4 text-base text-muted-foreground leading-relaxed max-w-xl">
              {t("hero.subtitle")}
            </p>
          </div>
          <div className="flex flex-col items-stretch sm:items-end gap-3">
            {apiBase && backendAssetId ? (
              <label className="flex flex-col gap-1.5 text-xs text-muted-foreground w-full sm:w-auto sm:min-w-[200px]">
                <span className="font-medium uppercase tracking-wide text-[10px]">
                  TFT forecast date
                </span>
                <input
                  type="date"
                  min="2022-01-03"
                  max="2023-12-30"
                  value={forecastDate}
                  onChange={(e) => setForecastDate(e.target.value)}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm"
                />
              </label>
            ) : null}
            <div className="flex items-center gap-3">
              <RefreshControl
                enabled={autoRefresh}
                onToggle={() => setAutoRefresh((v) => !v)}
                onRefresh={() => triggerRefresh(false)}
                lastUpdated={lastUpdated}
                nextInMs={nextInMs}
                intervalMs={REFRESH_INTERVAL_MS}
              />
              <button
                type="button"
                onClick={() => triggerRefresh(false)}
                className="px-4 py-2.5 text-sm font-medium rounded-xl bg-gradient-hero text-primary-foreground shadow-elevated hover:shadow-glow transition-all"
              >
                {t("hero.runPrediction")}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* District filter */}
      <section className="mb-6">
        <DistrictFilter value={district} onChange={setDistrict} counts={districtCounts} />
      </section>

      {/* KPIs */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KpiCard
          label={t("kpi.accuracy")}
          value={stats.accuracy.toFixed(1)}
          unit="%"
          badge={{ text: t("kpi.accuracy.badge"), tone: "success" }}
          hint={t("kpi.accuracy.hint", { mae: stats.mae, cap: asset.capacity })}
          delta={
            revision > 0
              ? { value: deltaAccuracy, unit: "pp", goodDirection: "up" }
              : undefined
          }
        />
        <KpiCard
          label={t("kpi.predicted")}
          value={(stats.predictedMWh / 1000).toFixed(2)}
          unit="GWh"
          badge={{
            text: asset.type === "solar" ? t("assets.solar") : t("assets.wind"),
            tone: asset.type === "solar" ? "solar" : "wind",
          }}
          hint={t("kpi.predicted.hint", { peak: peak.toFixed(0) })}
          delta={
            revision > 0
              ? { value: deltaPredicted / 1000, unit: "GWh", goodDirection: "up" }
              : undefined
          }
        />
        <KpiCard
          label={t("kpi.confidence")}
          value={stats.confidence}
          badge={{ text: `±${(avgBandWidth / 2).toFixed(0)} MW`, tone: "neutral" }}
          hint={t("kpi.confidence.hint")}
          delta={
            revision > 0
              ? { value: deltaBand / 2, unit: "MW", goodDirection: "down" }
              : undefined
          }
        />
        <KpiCard
          label={
            district === "all"
              ? t("kpi.scope.all")
              : t("kpi.scope.district", { district: t(`district.${district}`) })
          }
          value={(scopeStats.totalPredicted / 1000).toFixed(1)}
          unit="GWh"
          badge={{ text: t("kpi.plants", { n: visibleAssets.length }), tone: "neutral" }}
          hint={t("kpi.scope.hint", {
            cap: scopeStats.totalCap.toLocaleString(),
            horizon: t(`horizon.${horizon}`),
          })}
        />
      </section>

      {/* Main grid */}
      <section className="grid grid-cols-1 lg:grid-cols-[300px_1fr_300px] gap-5">
        <div className="space-y-5">
          <KarnatakaMap
            selectedId={selectedId}
            onSelect={setSelectedId}
            districtFilter={district}
          />
          <AssetSelector
            selectedId={selectedId}
            onSelect={setSelectedId}
            filter={filter}
            onFilterChange={setFilter}
            assets={visibleAssets}
          />
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${
                    asset.type === "solar"
                      ? "bg-gradient-solar text-solar-foreground"
                      : "bg-gradient-wind text-wind-foreground"
                  }`}
                >
                  {asset.type === "solar" ? (
                    <Sun className="h-3.5 w-3.5" />
                  ) : (
                    <Wind className="h-3.5 w-3.5" />
                  )}
                </span>
                <h2 className="font-display text-xl font-semibold">{asset.name}</h2>
                {useTftApi && apiLivePoints !== null ? (
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                    TFT API
                  </span>
                ) : null}
                {revision > 0 && (
                  <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {t("chart.rev")} {revision}
                  </span>
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {t(`district.${asset.district}`)} · {asset.cluster} ·{" "}
                {t("chart.installed", { cap: asset.capacity })}
              </div>
            </div>
            <HorizonTabs value={horizon} onChange={setHorizon} />
          </div>

          <ForecastChart data={data} assetType={asset.type} capacity={asset.capacity} />

          <div className="mt-6 pt-5 border-t border-border grid grid-cols-3 gap-4">
            <MiniStat icon={TrendingUp} label={t("chart.peak")} value={`${peak.toFixed(0)} MW`} />
            <MiniStat
              icon={Gauge}
              label={t("chart.uncertainty")}
              value={`±${(avgBandWidth / 2).toFixed(0)} MW`}
            />
            <MiniStat icon={Activity} label={t("chart.resolution")} value="60 min" />
          </div>
        </div>

        <div className="space-y-5">
          <UncertaintyBreakdown
            asset={asset}
            horizon={horizon}
            avgBandWidth={avgBandWidth}
          />
          <WeatherPanel asset={asset} />
        </div>
      </section>
    </>
  );

  const renderAssets = () => (
    <div className="space-y-8">
      <section className="text-center">
        <h1 className="font-display text-4xl font-semibold mb-4">{t("assets.section.title")}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">{t("assets.section.subtitle")}</p>
      </section>
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KpiCard
          label={t("assets.total")}
          value={ASSETS.length.toString()}
          badge={{ text: t("assets.total"), tone: "neutral" }}
        />
        <KpiCard
          label={t("assets.solarCount")}
          value={ASSETS.filter(a => a.type === 'solar').length.toString()}
          badge={{ text: t("assets.solar"), tone: "solar" }}
        />
        <KpiCard
          label={t("assets.windCount")}
          value={ASSETS.filter(a => a.type === 'wind').length.toString()}
          badge={{ text: t("assets.wind"), tone: "wind" }}
        />
      </section>
      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-display text-xl font-semibold mb-4">{t("assets.title")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {ASSETS.map(asset => (
            <div key={asset.id} className="p-4 border border-border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {asset.type === 'solar' ? <Sun className="h-4 w-4" /> : <Wind className="h-4 w-4" />}
                <span className="font-medium">{asset.name}</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {t(`district.${asset.district}`)} · {asset.capacity} MW
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  const renderModels = () => (
    <div className="space-y-8">
      <section className="text-center">
        <h1 className="font-display text-4xl font-semibold mb-4">{t("models.section.title")}</h1>
        <p className="text-muted-foreground max-w-2xl mx-auto">{t("models.section.subtitle")}</p>
      </section>
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-xl font-semibold mb-4">{t("models.tft.title")}</h2>
          <p className="text-muted-foreground mb-4">{t("models.tft.description")}</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>{t("models.accuracy")}</span>
              <span className="font-medium">95.2%</span>
            </div>
            <div className="flex justify-between">
              <span>{t("models.lastTrained")}</span>
              <span className="font-medium">2024-12-15</span>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-display text-xl font-semibold mb-4">Model Status</h2>
          <div className="flex items-center gap-2 text-success">
            <div className="w-2 h-2 bg-success rounded-full"></div>
            <span>Active & Running</span>
          </div>
        </div>
      </section>
    </div>
  );

  const renderReports = () => {
    const [showPastData, setShowPastData] = useState(false);
    return (
      <div className="space-y-8">
        <section className="text-center">
          <h1 className="font-display text-4xl font-semibold mb-4">{t("reports.section.title")}</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">{t("reports.section.subtitle")}</p>
        </section>
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button className="p-6 border border-border rounded-2xl bg-card hover:bg-secondary/50 transition-colors">
            <h3 className="font-display text-lg font-semibold mb-2">{t("reports.generate")}</h3>
            <p className="text-sm text-muted-foreground">Create new forecasting report</p>
          </button>
          <button 
            onClick={() => setShowPastData(!showPastData)}
            className="p-6 border border-border rounded-2xl bg-card hover:bg-secondary/50 transition-colors"
          >
            <h3 className="font-display text-lg font-semibold mb-2">{t("pastData.toggle")}</h3>
            <p className="text-sm text-muted-foreground">View historical data graphs</p>
          </button>
          <button className="p-6 border border-border rounded-2xl bg-card hover:bg-secondary/50 transition-colors">
            <h3 className="font-display text-lg font-semibold mb-2">{t("reports.download")}</h3>
            <p className="text-sm text-muted-foreground">Download existing reports</p>
          </button>
        </section>
        {showPastData && (
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="font-display text-xl font-semibold mb-4">{t("pastData.title")}</h2>
            <p className="text-muted-foreground mb-6">{t("pastData.subtitle")}</p>
            <ForecastChart data={prevData} assetType={asset.type} capacity={asset.capacity} />
          </section>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-surface">
      <Header currentTab={currentTab} onTabChange={setCurrentTab} />

      <main className="max-w-[1440px] mx-auto px-6 lg:px-10 py-8 lg:py-12">
        {currentTab === 'dashboard' && renderDashboard()}
        {currentTab === 'assets' && renderAssets()}
        {currentTab === 'models' && renderModels()}
        {currentTab === 'reports' && renderReports()}
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-primary/8 text-primary border border-primary/15 mb-4">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{t("hero.badge")}</span>
              </div>
              <h1 className="font-display text-4xl lg:text-5xl font-semibold leading-[1.05] tracking-tight">
                {t("hero.title1")}
                <span className="block text-muted-foreground font-normal italic">
                  {t("hero.title2")}
                </span>
              </h1>
              <p className="mt-4 text-base text-muted-foreground leading-relaxed max-w-xl">
                {t("hero.subtitle")}
              </p>
            </div>
            <div className="flex flex-col items-stretch sm:items-end gap-3">
              {apiBase && backendAssetId ? (
                <label className="flex flex-col gap-1.5 text-xs text-muted-foreground w-full sm:w-auto sm:min-w-[200px]">
                  <span className="font-medium uppercase tracking-wide text-[10px]">
                    TFT forecast date
                  </span>
                  <input
                    type="date"
                    min="2022-01-03"
                    max="2023-12-30"
                    value={forecastDate}
                    onChange={(e) => setForecastDate(e.target.value)}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground shadow-sm"
                  />
                </label>
              ) : null}
              <div className="flex items-center gap-3">
                <RefreshControl
                  enabled={autoRefresh}
                  onToggle={() => setAutoRefresh((v) => !v)}
                  onRefresh={() => triggerRefresh(false)}
                  lastUpdated={lastUpdated}
                  nextInMs={nextInMs}
                  intervalMs={REFRESH_INTERVAL_MS}
                />
                <button
                  type="button"
                  onClick={() => triggerRefresh(false)}
                  className="px-4 py-2.5 text-sm font-medium rounded-xl bg-gradient-hero text-primary-foreground shadow-elevated hover:shadow-glow transition-all"
                >
                  {t("hero.runPrediction")}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* District filter */}
        <section className="mb-6">
          <DistrictFilter value={district} onChange={setDistrict} counts={districtCounts} />
        </section>

        {/* KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard
            label={t("kpi.accuracy")}
            value={stats.accuracy.toFixed(1)}
            unit="%"
            badge={{ text: t("kpi.accuracy.badge"), tone: "success" }}
            hint={t("kpi.accuracy.hint", { mae: stats.mae, cap: asset.capacity })}
            delta={
              revision > 0
                ? { value: deltaAccuracy, unit: "pp", goodDirection: "up" }
                : undefined
            }
          />
          <KpiCard
            label={t("kpi.predicted")}
            value={(stats.predictedMWh / 1000).toFixed(2)}
            unit="GWh"
            badge={{
              text: asset.type === "solar" ? t("assets.solar") : t("assets.wind"),
              tone: asset.type === "solar" ? "solar" : "wind",
            }}
            hint={t("kpi.predicted.hint", { peak: peak.toFixed(0) })}
            delta={
              revision > 0
                ? { value: deltaPredicted / 1000, unit: "GWh", goodDirection: "up" }
                : undefined
            }
          />
          <KpiCard
            label={t("kpi.confidence")}
            value={stats.confidence}
            badge={{ text: `±${(avgBandWidth / 2).toFixed(0)} MW`, tone: "neutral" }}
            hint={t("kpi.confidence.hint")}
            delta={
              revision > 0
                ? { value: deltaBand / 2, unit: "MW", goodDirection: "down" }
                : undefined
            }
          />
          <KpiCard
            label={
              district === "all"
                ? t("kpi.scope.all")
                : t("kpi.scope.district", { district: t(`district.${district}`) })
            }
            value={(scopeStats.totalPredicted / 1000).toFixed(1)}
            unit="GWh"
            badge={{ text: t("kpi.plants", { n: visibleAssets.length }), tone: "neutral" }}
            hint={t("kpi.scope.hint", {
              cap: scopeStats.totalCap.toLocaleString(),
              horizon: t(`horizon.${horizon}`),
            })}
          />
        </section>

        {/* Main grid */}
        <section className="grid grid-cols-1 lg:grid-cols-[300px_1fr_300px] gap-5">
          <div className="space-y-5">
            <KarnatakaMap
              selectedId={selectedId}
              onSelect={setSelectedId}
              districtFilter={district}
            />
            <AssetSelector
              selectedId={selectedId}
              onSelect={setSelectedId}
              filter={filter}
              onFilterChange={setFilter}
              assets={visibleAssets}
            />
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-card min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${
                      asset.type === "solar"
                        ? "bg-gradient-solar text-solar-foreground"
                        : "bg-gradient-wind text-wind-foreground"
                    }`}
                  >
                    {asset.type === "solar" ? (
                      <Sun className="h-3.5 w-3.5" />
                    ) : (
                      <Wind className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <h2 className="font-display text-xl font-semibold">{asset.name}</h2>
                  {useTftApi && apiLivePoints !== null ? (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                      TFT API
                    </span>
                  ) : null}
                  {revision > 0 && (
                    <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {t("chart.rev")} {revision}
                    </span>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {t(`district.${asset.district}`)} · {asset.cluster} ·{" "}
                  {t("chart.installed", { cap: asset.capacity })}
                </div>
              </div>
              <HorizonTabs value={horizon} onChange={setHorizon} />
            </div>

            <ForecastChart data={data} assetType={asset.type} capacity={asset.capacity} />

            <div className="mt-6 pt-5 border-t border-border grid grid-cols-3 gap-4">
              <MiniStat icon={TrendingUp} label={t("chart.peak")} value={`${peak.toFixed(0)} MW`} />
              <MiniStat
                icon={Gauge}
                label={t("chart.uncertainty")}
                value={`±${(avgBandWidth / 2).toFixed(0)} MW`}
              />
              <MiniStat icon={Activity} label={t("chart.resolution")} value="60 min" />
            </div>
          </div>

          <div className="space-y-5">
            <UncertaintyBreakdown
              asset={asset}
              horizon={horizon}
              avgBandWidth={avgBandWidth}
            />
            <WeatherPanel asset={asset} />
          </div>
        </section>

        <footer className="mt-16 pt-8 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>{t("footer.copyright")}</div>
          <div className="flex items-center gap-4">
            <span>v3.4.0</span>
            <span>·</span>
            <span>
              {t("footer.lastTraining", {
                rev: revision,
                time: lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              })}
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
};

const MiniStat = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) => (
  <div className="flex items-center gap-3">
    <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center">
      <Icon className="h-4 w-4 text-muted-foreground" />
    </div>
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular">{value}</div>
    </div>
  </div>
);

export default Index;
