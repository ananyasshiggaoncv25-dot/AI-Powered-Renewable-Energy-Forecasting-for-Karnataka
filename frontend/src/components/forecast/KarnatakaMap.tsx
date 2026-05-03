import { Sun, Wind } from "lucide-react";
import { ASSETS, type Asset, type District } from "@/lib/forecast-data";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import mapImg from "@/assets/karnataka-map.png";

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
  districtFilter: District | "all";
}

// Pixel-anchor positions calibrated against src/assets/karnataka-map.png
// Values are percentages of the image's intrinsic box (left %, top %).
const DISTRICT_ANCHORS: Record<District, { x: number; y: number }> = {
  Kalaburagi:  { x: 60, y: 17 },
  Koppal:      { x: 52, y: 40 },
  Gadag:       { x: 41, y: 45 },
  Ballari:     { x: 61, y: 46 },
  Chitradurga: { x: 55, y: 58 },
  Tumakuru:    { x: 58, y: 71 },
};

// Small offsets so multiple assets in the same district don't fully overlap
const ASSET_OFFSETS: Record<string, { dx: number; dy: number }> = {
  "sol-pavagada-01":   { dx: 1.5,  dy: 2.5 },
  "sol-kalaburagi-02": { dx: 0,    dy: 0 },
  "sol-koppal-03":     { dx: 0,    dy: 0 },
  "win-chitradurga-01":{ dx: 0,    dy: 0 },
  "win-gadag-02":      { dx: 0,    dy: 0 },
  "win-bellary-03":    { dx: 0,    dy: 0 },
};

function anchorFor(asset: Asset) {
  const base = DISTRICT_ANCHORS[asset.district];
  const off = ASSET_OFFSETS[asset.id] ?? { dx: 0, dy: 0 };
  return { x: base.x + off.dx, y: base.y + off.dy };
}

export const KarnatakaMap = ({ selectedId, onSelect, districtFilter }: Props) => {
  const { t: tt } = useI18n();

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display text-base font-semibold">{tt("map.title")}</h3>
          <div className="text-xs text-muted-foreground">{tt("map.subtitle")}</div>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-solar" /> {tt("map.solar")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-wind" /> {tt("map.wind")}
          </span>
        </div>
      </div>

      <div className="relative w-full overflow-hidden rounded-xl bg-secondary/40">
        <img
          src={mapImg}
          alt="Districts of Karnataka"
          className="block w-full h-auto select-none pointer-events-none"
          draggable={false}
        />

        {/* Marker overlay positioned with the same aspect as the image */}
        <div className="absolute inset-0">
          {ASSETS.map((a) => {
            const { x, y } = anchorFor(a);
            const active = a.id === selectedId;
            const dim = districtFilter !== "all" && a.district !== districtFilter;
            const color = a.type === "solar" ? "hsl(var(--solar))" : "hsl(var(--wind))";
            return (
              <button
                key={a.id}
                onClick={() => onSelect(a.id)}
                style={{ left: `${x}%`, top: `${y}%` }}
                className={cn(
                  "absolute -translate-x-1/2 -translate-y-1/2 group/marker",
                  "transition-opacity duration-200",
                  dim ? "opacity-25" : "opacity-100"
                )}
                aria-label={a.name}
              >
                {active && (
                  <span
                    className="absolute inset-0 -m-2 rounded-full animate-ping"
                    style={{ background: color, opacity: 0.35 }}
                  />
                )}
                <span
                  className={cn(
                    "relative block rounded-full border-2 border-card shadow-md transition-all",
                    active ? "h-4 w-4" : "h-3 w-3 group-hover/marker:h-3.5 group-hover/marker:w-3.5"
                  )}
                  style={{ background: color }}
                />
                <span
                  className={cn(
                    "absolute left-1/2 -translate-x-1/2 mt-1 whitespace-nowrap rounded-md border border-border bg-card/95 px-1.5 py-0.5 text-[10px] font-medium shadow-sm inline-flex items-center gap-1",
                    active
                      ? "opacity-100"
                      : "opacity-0 group-hover/marker:opacity-100 transition-opacity"
                  )}
                >
                  {a.type === "solar" ? (
                    <Sun className="h-2.5 w-2.5 text-solar" />
                  ) : (
                    <Wind className="h-2.5 w-2.5 text-wind" />
                  )}
                  {a.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
