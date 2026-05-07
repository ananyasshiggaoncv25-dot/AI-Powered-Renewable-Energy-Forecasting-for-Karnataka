import { useState } from "react";
import { Zap } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { LanguageToggle } from "./LanguageToggle";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const NAV = [
  { key: "nav.dashboard", id: "dashboard" },
  { key: "nav.assets", id: "assets" },
  { key: "nav.models", id: "models" },
  { key: "nav.reports", id: "reports" },
  { key: "nav.settings", id: "settings" },
] as const;

export const Header = () => {
  const { t } = useI18n();
  const [active, setActive] = useState<string>("dashboard");

  const handleClick = (e: React.MouseEvent, id: string, label: string) => {
    e.preventDefault();
    setActive(id);
    if (id === "dashboard") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    toast({
      title: t("nav.comingSoon"),
      description: t("nav.comingSoonDesc", { section: label }),
    });
  };

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
          {NAV.map(({ key, id }) => {
            const label = t(key);
            return (
              <a
                key={key}
                href="#"
                onClick={(e) => handleClick(e, id, label)}
                className={cn(
                  "px-3 py-1.5 rounded-lg transition-colors",
                  active === id
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                {label}
              </a>
            );
          })}
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
