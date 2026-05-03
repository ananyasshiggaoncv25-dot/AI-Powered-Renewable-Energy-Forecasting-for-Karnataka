import { Cloud, Droplets, Thermometer, Wind as WindIcon, Sun } from "lucide-react";
import type { Asset } from "@/lib/forecast-data";
import { useI18n } from "@/lib/i18n";

interface Props {
  asset: Asset;
}

export const WeatherPanel = ({ asset }: Props) => {
  const { t } = useI18n();
  // Deterministic mock based on asset
  const seed = asset.lat + asset.lng;
  const temp = Math.round(15 + Math.sin(seed) * 10);
  const wind = Math.round(6 + Math.abs(Math.cos(seed)) * 10);
  const cloud = Math.round(20 + Math.abs(Math.sin(seed * 1.3)) * 60);
  const humidity = Math.round(40 + Math.abs(Math.cos(seed * 0.7)) * 35);
  const irradiance = Math.round(420 + Math.abs(Math.sin(seed * 2)) * 480);

  const items = [
    { icon: Thermometer, label: t("weather.temperature"), value: `${temp}°C` },
    { icon: WindIcon, label: t("weather.windSpeed"), value: `${wind} m/s` },
    { icon: Cloud, label: t("weather.cloudCover"), value: `${cloud}%` },
    { icon: Droplets, label: t("weather.humidity"), value: `${humidity}%` },
    { icon: Sun, label: t("weather.irradiance"), value: `${irradiance} W/m²` },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <h3 className="font-display text-base font-semibold mb-4">{t("weather.title")}</h3>
      <div className="space-y-3">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </div>
            <span className="text-sm font-medium tabular">{value}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground leading-relaxed">
        {t("weather.footer")}
      </div>
    </div>
  );
};
