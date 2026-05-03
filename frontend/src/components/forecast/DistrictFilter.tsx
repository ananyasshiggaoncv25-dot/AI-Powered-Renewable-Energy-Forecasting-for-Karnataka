import { DISTRICTS, type District } from "@/lib/forecast-data";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  value: District | "all";
  onChange: (d: District | "all") => void;
  counts: Record<District | "all", number>;
}

export const DistrictFilter = ({ value, onChange, counts }: Props) => {
  const { t } = useI18n();
  const items: (District | "all")[] = ["all", ...DISTRICTS];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground mr-1">
        {t("district.label")}
      </span>
      {items.map((d) => {
        const active = value === d;
        const count = counts[d] ?? 0;
        const disabled = d !== "all" && count === 0;
        const label = d === "all" ? t("district.all") : t(`district.${d}`);
        return (
          <button
            key={d}
            disabled={disabled}
            onClick={() => onChange(d)}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              active
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-foreground border-border hover:border-primary/40 hover:bg-secondary/60",
              disabled && "opacity-40 cursor-not-allowed hover:bg-card hover:border-border"
            )}
          >
            <span>{label}</span>
            <span
              className={cn(
                "tabular text-[10px] px-1.5 py-0.5 rounded-full",
                active ? "bg-primary-foreground/20" : "bg-secondary text-muted-foreground"
              )}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};
