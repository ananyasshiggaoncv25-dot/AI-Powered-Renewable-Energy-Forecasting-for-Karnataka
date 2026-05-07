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
} from "@/lib/forecast-data";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/hooks/use-toast";

const REFRESH_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const TICK_MS = 1000;

const Index = () => {
  const { t } = useI18n();
  const [district, setDistrict] = useState<District | "all">("all");
  const [filter, setFilter] = useState<AssetType | "all">("all");
  const [selectedId, setSelectedId] = useState(ASSETS[0].id);
  const [horizon, setHorizon] = useState<Horizon>("intra-day");

  const [revision, setRevision] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());
  const [nextInMs, setNextInMs] = useState(REFRESH_INTERVAL_MS);

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

  // Forecast for the current revision + previous revision (for delta highlighting)
  const data = useMemo(
    () => generateForecast(asset, horizon, 14, revision),
    [asset, horizon, revision]
  );
  const prevData = useMemo(
    () =>
      revision === 0
        ? data
        : generateForecast(asset, horizon, 14, revision - 1),
    [asset, horizon, revision, data]
  );

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

  return (
    <div className="min-h-screen bg-gradient-surface">
      <Header />

      <main className="max-w-[1440px] mx-auto px-6 lg:px-10 py-8 lg:py-12">
        {/* Hero */}
        <section className="mb-8 lg:mb-10 animate-fade-in-up">
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full bg-primary/8 text-primary border border-primary/15 mb-4">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{t("hero.badge")}</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <RefreshControl
                enabled={autoRefresh}
                onToggle={() => setAutoRefresh((v) => !v)}
                onRefresh={() => triggerRefresh(false)}
                lastUpdated={lastUpdated}
                nextInMs={nextInMs}
                intervalMs={REFRESH_INTERVAL_MS}
              />
              <button className="px-4 py-2.5 text-sm font-medium rounded-xl bg-gradient-hero text-primary-foreground shadow-elevated hover:shadow-glow transition-all">
                {t("hero.runPrediction")}
              </button>
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
