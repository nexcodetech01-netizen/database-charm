import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Standard KPI/summary card used across NexOS dashboards and module headers.
 * Keep the visual weight low: title in muted, value in display size, one
 * optional trend indicator, and an optional leading icon in a soft tint.
 */
export interface KpiCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  trend?: {
    value: string;
    direction: "up" | "down" | "flat";
    /** Semantic intent — "positive" renders green regardless of direction. */
    intent?: "positive" | "negative" | "neutral";
  };
  loading?: boolean;
  className?: string;
  onClick?: () => void;
  /** Render with stronger contrast to highlight a primary KPI. */
  highlight?: boolean;
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  trend,
  loading,
  className,
  onClick,
  highlight,
}: KpiCardProps) {
  const interactive = typeof onClick === "function";
  return (
    <Card
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "overflow-hidden transition-all duration-200",
        interactive &&
          "cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        highlight &&
          "border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-sm",
        className,
      )}
    >
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 flex-1 space-y-1">
          <p
            className={cn(
              "line-clamp-2 text-xs font-medium uppercase tracking-wide",
              highlight ? "text-primary/80" : "text-muted-foreground",
            )}
          >
            {label}
          </p>
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p
              className={cn(
                "font-semibold tracking-tight tabular-nums break-words",
                highlight ? "text-2xl text-foreground xl:text-3xl" : "text-xl text-foreground xl:text-2xl",
              )}
            >
              {value}
            </p>
          )}
          {trend || hint ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {trend ? <TrendPill {...trend} /> : null}
              {hint ? <span className="truncate">{hint}</span> : null}
            </div>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-lg",
              highlight
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-primary/10 text-primary",
            )}
            aria-hidden="true"
          >
            <Icon className="h-4 w-4" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}


function TrendPill({
  value,
  direction,
  intent = "neutral",
}: NonNullable<KpiCardProps["trend"]>) {
  const Icon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const tone =
    intent === "positive"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : intent === "negative"
        ? "bg-red-500/10 text-red-600 dark:text-red-400"
        : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
        tone,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {value}
    </span>
  );
}
