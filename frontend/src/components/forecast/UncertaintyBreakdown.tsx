import { ShieldAlert } from "lucide-react";
import {
  getUncertaintyDrivers,
  type Asset,
  type Horizon,
} from "@/lib/forecast-data";
import { useI18n } from "@/lib/i18n";

interface Props {
  asset: Asset;
  horizon: Horizon;
  avgBandWidth: number;
}

export const UncertaintyBreakdown = ({ asset, horizon, avgBandWidth }: Props) => {
  const { t } = useI18n();
  const drivers = getUncertaintyDrivers(asset, horizon);
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between mb-1">
        <div>
          <h3 className="font-display text-base font-semibold">{t("uncertainty.title")}</h3>
          <div className="text-xs text-muted-foreground">
            {t("uncertainty.subtitle", { horizon: t(`horizon.${horizon}`) })}
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-warning/15 text-warning-foreground border border-warning/30">
          <ShieldAlert className="h-3 w-3" />
          ±{(avgBandWidth / 2).toFixed(0)} MW
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {drivers.map((d) => (
          <div key={d.factor}>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium">{d.factor}</span>
              <span className="tabular text-muted-foreground">
                {(d.share * 100).toFixed(0)}%
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
              <div
                className={
                  asset.type === "solar"
                    ? "h-full bg-gradient-solar"
                    : "h-full bg-gradient-wind"
                }
                style={{ width: `${d.share * 100}%`, transition: "width 600ms" }}
              />
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 leading-snug">
              {d.description}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-border text-[11px] text-muted-foreground leading-relaxed">
        {t("uncertainty.footer")}
      </div>
    </div>
  );
};
