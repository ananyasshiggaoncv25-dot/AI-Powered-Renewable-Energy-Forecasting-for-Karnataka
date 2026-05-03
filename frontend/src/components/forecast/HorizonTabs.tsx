import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";
import type { Horizon } from "@/lib/forecast-data";

interface Props {
  value: Horizon;
  onChange: (h: Horizon) => void;
}

const TABS: { id: Horizon; sub: string }[] = [
  { id: "day-ahead", sub: "T+24h" },
  { id: "intra-day", sub: "T+6h" },
  { id: "hourly", sub: "T+1h" },
];

export const HorizonTabs = ({ value, onChange }: Props) => {
  const { t } = useI18n();
  return (
    <div className="inline-flex p-1 bg-secondary rounded-xl">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "px-4 py-2 text-xs font-medium rounded-lg transition-all flex items-center gap-2",
            value === tab.id
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span>{t(`horizon.${tab.id}`)}</span>
          <span className="tabular text-[10px] opacity-70">{tab.sub}</span>
        </button>
      ))}
    </div>
  );
};
