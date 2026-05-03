import { Languages } from "lucide-react";
import { useI18n, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const LanguageToggle = () => {
  const { lang, setLang, t } = useI18n();
  const opts: { id: Lang; label: string }[] = [
    { id: "en", label: "EN" },
    { id: "kn", label: "ಕ" },
  ];
  return (
    <div
      className="inline-flex items-center gap-1 p-1 rounded-full border border-border bg-card"
      role="group"
      aria-label={t("lang.label")}
    >
      <Languages className="h-3.5 w-3.5 text-muted-foreground ml-1.5" aria-hidden />
      {opts.map((o) => (
        <button
          key={o.id}
          onClick={() => setLang(o.id)}
          title={o.id === "en" ? t("lang.en") : t("lang.kn")}
          className={cn(
            "px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors",
            lang === o.id
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
};
