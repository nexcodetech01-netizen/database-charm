import { cn } from "@/lib/utils";
import type { TrendComparison } from "../types";
import { directionSymbol } from "../lib/trend";

/** TrendBadge — indicador visual ↑ ↓ → (apenas apresentação). */
export interface TrendBadgeProps {
  trend?: TrendComparison | null;
  className?: string;
}

export function TrendBadge({ trend, className }: TrendBadgeProps) {
  if (!trend || !trend.hasHistory) {
    return (
      <span className={cn("text-[11px] text-muted-foreground", className)}>
        sem histórico suficiente
      </span>
    );
  }

  const tone =
    trend.direction === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend.direction === "down"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <span className={cn("text-[11px] font-medium tabular-nums", tone, className)}>
      {directionSymbol(trend.direction)} {trend.label}
    </span>
  );
}
