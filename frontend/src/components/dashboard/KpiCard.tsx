import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { KpiMetric } from "@/lib/types";

interface KpiCardProps {
  metric: KpiMetric;
}

export default function KpiCard({ metric }: KpiCardProps) {
  const { label, value, unit, trend, trendValue } = metric;

  const displayValue =
    value === null || value === undefined || value === ""
      ? "—"
      : typeof value === "number" && !Number.isFinite(value)
      ? "—"
      : value;

  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  const trendColor =
    trend === "up"
      ? "text-emerald-600 bg-emerald-50"
      : trend === "down"
      ? "text-red-500 bg-red-50"
      : "text-slate-500 bg-slate-100";

  return (
    <Card className="flex-1 min-w-0">
      <CardContent className="p-5">
        <p className="text-sm font-medium text-slate-500 truncate">{label}</p>
        <div className="mt-2 flex items-end justify-between gap-2">
          <p className="text-3xl font-bold text-slate-900 tabular-nums leading-none">
            {displayValue}
            {unit && displayValue !== "—" && (
              <span className="ml-1 text-base font-normal text-slate-400">
                {unit}
              </span>
            )}
          </p>
          {trend && trendValue && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${trendColor}`}
            >
              <TrendIcon className="h-3 w-3" />
              {trendValue}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
