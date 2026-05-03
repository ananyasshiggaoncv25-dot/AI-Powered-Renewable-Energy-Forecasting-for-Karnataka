import { RefreshCw, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n";

interface Props {
  enabled: boolean;
  onToggle: () => void;
  onRefresh: () => void;
  lastUpdated: Date;
  nextInMs: number; // ms until next refresh
  intervalMs: number;
}

const formatTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const formatCountdown = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

export const RefreshControl = ({
  enabled,
  onToggle,
  onRefresh,
  lastUpdated,
  nextInMs,
  intervalMs,
}: Props) => {
  const { t } = useI18n();
  const progress = enabled ? 1 - nextInMs / intervalMs : 0;

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={onRefresh}
        title={t("refresh.title")}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-border bg-card hover:bg-secondary/60 transition-colors"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span>{t("refresh.refresh")}</span>
      </button>

      <button
        onClick={onToggle}
        className={cn(
          "relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors overflow-hidden",
          enabled
            ? "bg-success/10 text-success border-success/30"
            : "bg-card text-muted-foreground border-border hover:bg-secondary/60"
        )}
      >
        {enabled && (
          <span
            className="absolute inset-y-0 left-0 bg-success/15 transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress * 100}%` }}
            aria-hidden
          />
        )}
        <span className="relative inline-flex items-center gap-2">
          {enabled ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-75 animate-pulse-soft" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              <span>{t("refresh.auto")}</span>
              <span className="tabular opacity-80">({formatCountdown(nextInMs)})</span>
            </>
          ) : (
            <>
              <Pause className="h-3.5 w-3.5" />
              <span>{t("refresh.off")}</span>
            </>
          )}
        </span>
      </button>

      <span className="hidden lg:inline text-[11px] text-muted-foreground tabular">
        {t("refresh.updated")} {formatTime(lastUpdated)}
      </span>
    </div>
  );
};
