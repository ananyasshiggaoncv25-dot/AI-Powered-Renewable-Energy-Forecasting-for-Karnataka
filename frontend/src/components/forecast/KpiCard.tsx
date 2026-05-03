import { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  unit?: string;
  badge?: { text: string; tone?: "success" | "solar" | "wind" | "neutral" };
  hint?: string;
  /** Numeric delta vs previous update; if set a chip is rendered. */
  delta?: { value: number; unit?: string; goodDirection?: "up" | "down" };
  className?: string;
}

const toneClasses: Record<string, string> = {
  success: "bg-success/12 text-success",
  solar: "bg-solar/15 text-solar-foreground border border-solar/30",
  wind: "bg-wind/15 text-wind border border-wind/30",
  neutral: "bg-secondary text-secondary-foreground",
};

const DeltaChip = ({
  value,
  unit,
  goodDirection = "up",
}: {
  value: number;
  unit?: string;
  goodDirection?: "up" | "down";
}) => {
  const abs = Math.abs(value);
  if (abs < 0.05) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-secondary text-muted-foreground">
        <Minus className="h-3 w-3" /> 0
      </span>
    );
  }
  const isUp = value > 0;
  const isGood = (isUp && goodDirection === "up") || (!isUp && goodDirection === "down");
  const tone = isGood ? "bg-success/12 text-success" : "bg-warning/15 text-warning-foreground";
  const Icon = isUp ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md tabular animate-fade-in-up",
        tone
      )}
      title="Change vs previous update"
    >
      <Icon className="h-3 w-3" />
      {isUp ? "+" : "−"}
      {abs < 10 ? abs.toFixed(1) : abs.toFixed(0)}
      {unit && <span className="ml-0.5 opacity-80">{unit}</span>}
    </span>
  );
};

export const KpiCard = ({ label, value, unit, badge, hint, delta, className }: KpiCardProps) => {
  return (
    <div
      className={cn(
        "group rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-300 hover:shadow-elevated hover:-translate-y-0.5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        {badge && (
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full",
              toneClasses[badge.tone ?? "neutral"]
            )}
          >
            {badge.text}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-4xl font-semibold tabular text-foreground leading-none">
          {value}
        </span>
        {unit && <span className="text-sm font-medium text-muted-foreground">{unit}</span>}
        {delta && <DeltaChip {...delta} />}
      </div>
      {hint && <div className="mt-3 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
};

