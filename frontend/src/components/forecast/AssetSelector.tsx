import { Sun, Wind, MapPin } from "lucide-react";
import { ASSETS, type Asset, type AssetType } from "@/lib/forecast-data";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
  filter: AssetType | "all";
  onFilterChange: (f: AssetType | "all") => void;
  /** Already-scoped (e.g. by district). Defaults to all assets. */
  assets?: Asset[];
}

export const AssetSelector = ({
  selectedId,
  onSelect,
  filter,
  onFilterChange,
  assets,
}: Props) => {
  const { t } = useI18n();
  const source = assets ?? ASSETS;
  const filtered = source.filter((a) => filter === "all" || a.type === filter);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-base font-semibold">{t("assets.title")}</h3>
        <span className="text-xs text-muted-foreground tabular">
          {t("assets.active", { n: filtered.length })}
        </span>
      </div>
      <div className="flex gap-1 p-1 bg-secondary rounded-xl mb-4">
        {(["all", "solar", "wind"] as const).map((f) => (
          <button
            key={f}
            onClick={() => onFilterChange(f)}
            className={cn(
              "flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
              filter === f
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t(`assets.${f}`)}
          </button>
        ))}
      </div>
      <div className="space-y-1.5 max-h-[420px] overflow-y-auto -mr-2 pr-2">
        {filtered.length === 0 && (
          <div className="text-xs text-muted-foreground px-3 py-6 text-center">
            {t("assets.empty")}
          </div>
        )}
        {filtered.map((a) => (
          <AssetRow
            key={a.id}
            asset={a}
            active={a.id === selectedId}
            onClick={() => onSelect(a.id)}
          />
        ))}
      </div>
    </div>
  );
};

const AssetRow = ({
  asset,
  active,
  onClick,
}: {
  asset: Asset;
  active: boolean;
  onClick: () => void;
}) => {
  const Icon = asset.type === "solar" ? Sun : Wind;
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all border",
        active
          ? "border-primary/40 bg-primary/5 shadow-sm"
          : "border-transparent hover:bg-secondary/60"
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg shrink-0",
          asset.type === "solar"
            ? "bg-gradient-solar text-solar-foreground"
            : "bg-gradient-wind text-wind-foreground"
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{asset.name}</div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span className="truncate">{asset.region}</span>
          <span>·</span>
          <span className="tabular">{asset.capacity} MW</span>
        </div>
      </div>
    </button>
  );
};
