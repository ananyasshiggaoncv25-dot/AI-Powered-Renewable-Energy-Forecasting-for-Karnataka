import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";

export type Lang = "en" | "kn";

type Dict = Record<string, string>;

const EN: Dict = {
  // Header
  "header.brand": "Aether Energy",
  "header.tagline": "Probabilistic forecasting",
  "header.modelsLive": "Models live",
  "nav.dashboard": "Dashboard",
  "nav.assets": "Assets",
  "nav.models": "Models",
  "nav.reports": "Reports",
  "nav.settings": "Settings",

  // Hero
  "hero.badge": "Unified model · solar + wind · Karnataka grid",
  "hero.title1": "Forecast every megawatt",
  "hero.title2": "with calibrated uncertainty.",
  "hero.subtitle":
    "Day-ahead, intra-day and hourly probabilistic predictions for solar and wind plants across Karnataka — trained on IMD & ECMWF weather data and KPTCL operational telemetry, generalising from Pavagada to Chitradurga without per-site retraining.",
  "hero.runPrediction": "Run new prediction",

  // Districts
  "district.label": "District",
  "district.all": "All districts",
  "district.Tumakuru": "Tumakuru",
  "district.Kalaburagi": "Kalaburagi",
  "district.Koppal": "Koppal",
  "district.Chitradurga": "Chitradurga",
  "district.Gadag": "Gadag",
  "district.Ballari": "Ballari",

  // Horizons
  "horizon.day-ahead": "Day-ahead",
  "horizon.intra-day": "Intra-day",
  "horizon.hourly": "Hourly",

  // Refresh
  "refresh.refresh": "Refresh",
  "refresh.auto": "Auto · 15 min",
  "refresh.off": "Auto-refresh off",
  "refresh.updated": "Updated",
  "refresh.title": "Pull latest forecast",
  "refresh.toastTitle": "Forecast refreshed",

  // KPIs
  "kpi.accuracy": "Forecast accuracy",
  "kpi.accuracy.badge": "24h MAPE",
  "kpi.accuracy.hint": "MAE {mae} MW vs {cap} MW capacity",
  "kpi.predicted": "Predicted energy",
  "kpi.predicted.hint": "Peak {peak} MW · over next 24h",
  "kpi.confidence": "Model confidence",
  "kpi.confidence.hint": "Average P10–P90 band half-width",
  "kpi.scope.all": "Karnataka scope",
  "kpi.scope.district": "{district} scope",
  "kpi.scope.hint": "{cap} MW installed · {horizon}",
  "kpi.plants": "{n} plants",

  // Asset selector
  "assets.title": "Assets & Clusters",
  "assets.active": "{n} active",
  "assets.all": "all",
  "assets.solar": "solar",
  "assets.wind": "wind",
  "assets.empty": "No matching plants in this district.",

  // Map
  "map.title": "Karnataka plant map",
  "map.subtitle": "Click a marker to load its forecast",
  "map.solar": "Solar",
  "map.wind": "Wind",

  // Chart
  "chart.peak": "Peak generation",
  "chart.uncertainty": "Uncertainty (avg)",
  "chart.resolution": "Resolution",
  "chart.rev": "rev",
  "chart.installed": "{cap} MW installed",
  "chart.legend.p50": "P50 (median forecast)",
  "chart.legend.band": "P10 – P90 uncertainty",
  "chart.legend.actual": "Actual",
  "chart.tooltip.p50": "P50 forecast",
  "chart.tooltip.band": "P10 — P90",
  "chart.tooltip.actual": "Actual",
  "chart.tooltip.irradiance": "Irradiance",
  "chart.tooltip.windSpeed": "Wind speed",

  // Uncertainty
  "uncertainty.title": "Uncertainty drivers",
  "uncertainty.subtitle": "What widens the P10–P90 band on this {horizon} run",
  "uncertainty.footer":
    "Attribution computed via SHAP-style decomposition over the quantile regressor's weather features.",

  // Weather
  "weather.title": "Weather inputs",
  "weather.temperature": "Temperature",
  "weather.windSpeed": "Wind speed",
  "weather.cloudCover": "Cloud cover",
  "weather.humidity": "Humidity",
  "weather.irradiance": "Irradiance",
  "weather.footer":
    "IMD station data blended with ECMWF forecasts, downscaled to plant coordinates in Karnataka.",

  // Footer
  "footer.copyright": "© 2026 Aether Energy · Karnataka generation forecasting",
  "footer.lastTraining": "Last training: 6h ago · Revision {rev} · Updated {time}",

  // Language
  "lang.label": "Language",
  "lang.en": "English",
  "lang.kn": "ಕನ್ನಡ",
};

const KN: Dict = {
  "header.brand": "ಏಥರ್ ಎನರ್ಜಿ",
  "header.tagline": "ಸಂಭವನೀಯ ಮುನ್ಸೂಚನೆ",
  "header.modelsLive": "ಮಾದರಿಗಳು ಸಕ್ರಿಯ",
  "nav.dashboard": "ಡ್ಯಾಶ್‌ಬೋರ್ಡ್",
  "nav.assets": "ಆಸ್ತಿಗಳು",
  "nav.models": "ಮಾದರಿಗಳು",
  "nav.reports": "ವರದಿಗಳು",
  "nav.settings": "ಸಂಯೋಜನೆ",

  "hero.badge": "ಏಕೀಕೃತ ಮಾದರಿ · ಸೌರ + ಪವನ · ಕರ್ನಾಟಕ ಗ್ರಿಡ್",
  "hero.title1": "ಪ್ರತಿ ಮೆಗಾವಾಟ್‌ನ ಮುನ್ಸೂಚನೆ",
  "hero.title2": "ಮಾಪಾಂಕಿತ ಅನಿಶ್ಚಿತತೆಯೊಂದಿಗೆ.",
  "hero.subtitle":
    "ಕರ್ನಾಟಕದ ಸೌರ ಮತ್ತು ಪವನ ಸ್ಥಾವರಗಳಿಗಾಗಿ ದಿನ-ಮುಂಚಿನ, ದಿನದೊಳಗಿನ ಮತ್ತು ಗಂಟೆಯ ಸಂಭವನೀಯ ಮುನ್ಸೂಚನೆಗಳು — IMD ಮತ್ತು ECMWF ಹವಾಮಾನ ದತ್ತಾಂಶ ಹಾಗೂ KPTCL ಕಾರ್ಯಾಚರಣಾ ಟೆಲಿಮೆಟ್ರಿಯಲ್ಲಿ ತರಬೇತಿ, ಪಾವಗಡದಿಂದ ಚಿತ್ರದುರ್ಗದವರೆಗೆ ಪ್ರತಿ-ಸ್ಥಳ ಮರು-ತರಬೇತಿಯಿಲ್ಲದೆ ಸಾಮಾನ್ಯೀಕರಣ.",
  "hero.runPrediction": "ಹೊಸ ಮುನ್ಸೂಚನೆ ಚಲಾಯಿಸಿ",

  "district.label": "ಜಿಲ್ಲೆ",
  "district.all": "ಎಲ್ಲಾ ಜಿಲ್ಲೆಗಳು",
  "district.Tumakuru": "ತುಮಕೂರು",
  "district.Kalaburagi": "ಕಲಬುರಗಿ",
  "district.Koppal": "ಕೊಪ್ಪಳ",
  "district.Chitradurga": "ಚಿತ್ರದುರ್ಗ",
  "district.Gadag": "ಗದಗ",
  "district.Ballari": "ಬಳ್ಳಾರಿ",

  "horizon.day-ahead": "ದಿನ-ಮುಂಚಿನ",
  "horizon.intra-day": "ದಿನದೊಳಗಿನ",
  "horizon.hourly": "ಗಂಟೆಯ",

  "refresh.refresh": "ಮರುಲೋಡ್",
  "refresh.auto": "ಸ್ವಯಂ · 15 ನಿಮಿಷ",
  "refresh.off": "ಸ್ವಯಂ-ಮರುಲೋಡ್ ಆಫ್",
  "refresh.updated": "ನವೀಕರಿಸಲಾಗಿದೆ",
  "refresh.title": "ಇತ್ತೀಚಿನ ಮುನ್ಸೂಚನೆ ಪಡೆಯಿರಿ",
  "refresh.toastTitle": "ಮುನ್ಸೂಚನೆ ನವೀಕರಿಸಲಾಗಿದೆ",

  "kpi.accuracy": "ಮುನ್ಸೂಚನೆ ನಿಖರತೆ",
  "kpi.accuracy.badge": "24ಗಂ MAPE",
  "kpi.accuracy.hint": "MAE {mae} MW · {cap} MW ಸಾಮರ್ಥ್ಯ",
  "kpi.predicted": "ಮುನ್ಸೂಚಿತ ಶಕ್ತಿ",
  "kpi.predicted.hint": "ಗರಿಷ್ಠ {peak} MW · ಮುಂದಿನ 24ಗಂ",
  "kpi.confidence": "ಮಾದರಿ ವಿಶ್ವಾಸ",
  "kpi.confidence.hint": "ಸರಾಸರಿ P10–P90 ಬ್ಯಾಂಡ್ ಅರ್ಧ-ಅಗಲ",
  "kpi.scope.all": "ಕರ್ನಾಟಕ ವ್ಯಾಪ್ತಿ",
  "kpi.scope.district": "{district} ವ್ಯಾಪ್ತಿ",
  "kpi.scope.hint": "{cap} MW ಸ್ಥಾಪಿಸಲಾಗಿದೆ · {horizon}",
  "kpi.plants": "{n} ಸ್ಥಾವರಗಳು",

  "assets.title": "ಆಸ್ತಿಗಳು ಮತ್ತು ಸಮೂಹಗಳು",
  "assets.active": "{n} ಸಕ್ರಿಯ",
  "assets.all": "ಎಲ್ಲಾ",
  "assets.solar": "ಸೌರ",
  "assets.wind": "ಪವನ",
  "assets.empty": "ಈ ಜಿಲ್ಲೆಯಲ್ಲಿ ಹೊಂದಾಣಿಕೆ ಸ್ಥಾವರಗಳಿಲ್ಲ.",

  "map.title": "ಕರ್ನಾಟಕ ಸ್ಥಾವರ ನಕ್ಷೆ",
  "map.subtitle": "ಮುನ್ಸೂಚನೆ ಲೋಡ್ ಮಾಡಲು ಗುರುತು ಒತ್ತಿರಿ",
  "map.solar": "ಸೌರ",
  "map.wind": "ಪವನ",

  "chart.peak": "ಗರಿಷ್ಠ ಉತ್ಪಾದನೆ",
  "chart.uncertainty": "ಅನಿಶ್ಚಿತತೆ (ಸರಾಸರಿ)",
  "chart.resolution": "ರೆಸಲ್ಯೂಷನ್",
  "chart.rev": "ಆವೃತ್ತಿ",
  "chart.installed": "{cap} MW ಸ್ಥಾಪಿಸಲಾಗಿದೆ",
  "chart.legend.p50": "P50 (ಮಧ್ಯಮ ಮುನ್ಸೂಚನೆ)",
  "chart.legend.band": "P10 – P90 ಅನಿಶ್ಚಿತತೆ",
  "chart.legend.actual": "ವಾಸ್ತವಿಕ",
  "chart.tooltip.p50": "P50 ಮುನ್ಸೂಚನೆ",
  "chart.tooltip.band": "P10 — P90",
  "chart.tooltip.actual": "ವಾಸ್ತವಿಕ",
  "chart.tooltip.irradiance": "ವಿಕಿರಣ",
  "chart.tooltip.windSpeed": "ಗಾಳಿ ವೇಗ",

  "uncertainty.title": "ಅನಿಶ್ಚಿತತೆಯ ಚಾಲಕರು",
  "uncertainty.subtitle": "ಈ {horizon} ರನ್‌ನಲ್ಲಿ P10–P90 ಬ್ಯಾಂಡ್ ಅಗಲಿಸುವುದು ಯಾವುದು",
  "uncertainty.footer":
    "ಕ್ವಾಂಟೈಲ್ ರಿಗ್ರೆಸರ್‌ನ ಹವಾಮಾನ ವೈಶಿಷ್ಟ್ಯಗಳ ಮೇಲೆ SHAP-ಶೈಲಿಯ ವಿಭಜನೆಯ ಮೂಲಕ ಲೆಕ್ಕಹಾಕಲಾಗಿದೆ.",

  "weather.title": "ಹವಾಮಾನ ಒಳಹರಿವುಗಳು",
  "weather.temperature": "ತಾಪಮಾನ",
  "weather.windSpeed": "ಗಾಳಿ ವೇಗ",
  "weather.cloudCover": "ಮೇಘ ಆವರಣ",
  "weather.humidity": "ಆರ್ದ್ರತೆ",
  "weather.irradiance": "ವಿಕಿರಣ",
  "weather.footer":
    "IMD ಸ್ಟೇಷನ್ ದತ್ತಾಂಶವನ್ನು ECMWF ಮುನ್ಸೂಚನೆಗಳೊಂದಿಗೆ ಮಿಶ್ರಗೊಳಿಸಿ, ಕರ್ನಾಟಕದ ಸ್ಥಾವರ ನಿರ್ದೇಶಾಂಕಗಳಿಗೆ ಡೌನ್‌ಸ್ಕೇಲ್ ಮಾಡಲಾಗಿದೆ.",

  "footer.copyright": "© 2026 ಏಥರ್ ಎನರ್ಜಿ · ಕರ್ನಾಟಕ ಉತ್ಪಾದನೆ ಮುನ್ಸೂಚನೆ",
  "footer.lastTraining": "ಕೊನೆಯ ತರಬೇತಿ: 6ಗಂ ಹಿಂದೆ · ಆವೃತ್ತಿ {rev} · ನವೀಕರಿಸಲಾಗಿದೆ {time}",

  "lang.label": "ಭಾಷೆ",
  "lang.en": "English",
  "lang.kn": "ಕನ್ನಡ",
};

const DICTS: Record<Lang, Dict> = { en: EN, kn: KN };

interface I18nCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export const I18nProvider = ({ children }: { children: ReactNode }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    return (localStorage.getItem("aether.lang") as Lang) || "en";
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("aether.lang", lang);
  }, [lang]);

  const value = useMemo<I18nCtx>(
    () => ({
      lang,
      setLang: setLangState,
      t: (key, vars) => {
        const dict = DICTS[lang] ?? EN;
        let s = dict[key] ?? EN[key] ?? key;
        if (vars) {
          for (const [k, v] of Object.entries(vars)) {
            s = s.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
          }
        }
        return s;
      },
    }),
    [lang]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export const useI18n = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
};
