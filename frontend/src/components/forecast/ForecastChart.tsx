import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ForecastPoint, AssetType } from "@/lib/forecast-data";
import { useI18n } from "@/lib/i18n";

interface Props {
  data: ForecastPoint[];
  assetType: AssetType;
  capacity: number;
}

const accentVar = (type: AssetType) => (type === "solar" ? "var(--solar)" : "var(--wind)");

export const ForecastChart = ({ data, assetType, capacity }: Props) => {
  const { t } = useI18n();
  const accent = `hsl(${accentVar(assetType)})`;
  const accentSoft = `hsl(${accentVar(assetType)} / 0.18)`;
  const accentMid = `hsl(${accentVar(assetType)} / 0.42)`;

  return (
    <div className="h-[380px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="bandFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={accent} stopOpacity={0.35} />
              <stop offset="100%" stopColor={accent} stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis
            dataKey="label"
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            interval={2}
          />
          <YAxis
            stroke="hsl(var(--muted-foreground))"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            domain={[0, capacity]}
            tickFormatter={(v) => `${v}`}
            label={{
              value: "MW",
              angle: -90,
              position: "insideLeft",
              fill: "hsl(var(--muted-foreground))",
              fontSize: 11,
              offset: 18,
            }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as ForecastPoint;
              return (
                <div className="rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-elevated px-4 py-3 text-xs">
                  <div className="font-display text-sm font-semibold mb-2">{label}</div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 tabular">
                    <span className="text-muted-foreground">{t("chart.tooltip.p50")}</span>
                    <span className="font-medium text-right">{p.p50} MW</span>
                    <span className="text-muted-foreground">{t("chart.tooltip.band")}</span>
                    <span className="font-medium text-right">
                      {p.p10} – {p.p90}
                    </span>
                    {p.actual !== undefined && (
                      <>
                        <span className="text-muted-foreground">{t("chart.tooltip.actual")}</span>
                        <span className="font-medium text-right text-success">{p.actual} MW</span>
                      </>
                    )}
                    <span className="text-muted-foreground">
                      {assetType === "solar" ? t("chart.tooltip.irradiance") : t("chart.tooltip.windSpeed")}
                    </span>
                    <span className="font-medium text-right">
                      {p.weather} {assetType === "solar" ? "W/m²" : "m/s"}
                    </span>
                  </div>
                </div>
              );
            }}
          />
          {/* Uncertainty band: render p10 invisible baseline + p90 as area to create the band */}
          <Area
            type="monotone"
            dataKey="p10"
            stroke="transparent"
            fill="transparent"
            stackId="band"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey={(d: ForecastPoint) => d.p90 - d.p10}
            name="P10 – P90"
            stroke={accentMid}
            strokeWidth={1}
            fill="url(#bandFill)"
            stackId="band"
            isAnimationActive
            animationDuration={700}
          />
          <Line
            type="monotone"
            dataKey="p50"
            stroke={accent}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: accent, stroke: "hsl(var(--background))", strokeWidth: 2 }}
            isAnimationActive
            animationDuration={700}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke="hsl(var(--foreground))"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <LegendDot color={accent} label={t("chart.legend.p50")} />
        <LegendDot color={accentSoft} label={t("chart.legend.band")} square />
        <LegendDot color="hsl(var(--foreground))" label={t("chart.legend.actual")} dashed />
      </div>
    </div>
  );
};

const LegendDot = ({
  color,
  label,
  square,
  dashed,
}: {
  color: string;
  label: string;
  square?: boolean;
  dashed?: boolean;
}) => (
  <span className="inline-flex items-center gap-2">
    {dashed ? (
      <span className="inline-block w-4 border-t-2 border-dashed" style={{ borderColor: color }} />
    ) : (
      <span
        className={square ? "inline-block h-3 w-4 rounded-sm" : "inline-block h-2.5 w-2.5 rounded-full"}
        style={{ backgroundColor: color }}
      />
    )}
    <span>{label}</span>
  </span>
);
