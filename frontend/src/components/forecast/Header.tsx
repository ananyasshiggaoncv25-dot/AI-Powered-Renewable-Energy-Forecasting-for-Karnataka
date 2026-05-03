import { Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "./LanguageToggle";

export const Header = () => {
  const { t } = useI18n();
  const navKeys = ["nav.dashboard", "nav.assets", "nav.models", "nav.reports", "nav.settings"];
  return (
    <header className="border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30">
      <div className="max-w-[1440px] mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-hero flex items-center justify-center shadow-glow">
            <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
          </div>
          <div className="leading-tight">
            <div className="font-display text-base font-semibold">{t("header.brand")}</div>
            <div className="text-[11px] text-muted-foreground -mt-0.5">{t("header.tagline")}</div>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-1 text-sm">
          {navKeys.map((k, i) => (
            <a
              key={k}
              href="#"
              className={
                i === 0
                  ? "px-3 py-1.5 rounded-lg bg-secondary font-medium"
                  : "px-3 py-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              }
            >
              {t(k)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <LanguageToggle />
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-pulse-soft" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            <span className="text-success font-medium">{t("header.modelsLive")}</span>
          </div>
          <div className="h-9 w-9 rounded-full bg-gradient-hero text-primary-foreground text-xs font-semibold flex items-center justify-center">
            AE
          </div>
        </div>
      </div>
    </header>
  );
};
