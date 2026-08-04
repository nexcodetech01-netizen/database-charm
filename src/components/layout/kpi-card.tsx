import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
      <CardContent className="flex items-start justify-between gap-2 p-3 sm:p-4">
        <div className="min-w-0 flex-1 space-y-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <p
                  className={cn(
                    "truncate text-[10px] font-semibold uppercase tracking-wider",
                    highlight ? "text-primary/80" : "text-muted-foreground",
                  )}
                >
                  {label}
                </p>
              </TooltipTrigger>
              <TooltipContent>
                <p>{label}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {loading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p
              className={cn(
                "font-bold tracking-tight tabular-nums truncate",
                highlight ? "text-xl text-foreground xl:text-2xl" : "text-lg text-foreground xl:text-xl",
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
              "grid h-7 w-7 shrink-0 place-items-center rounded-lg sm:h-8 sm:w-8",
              highlight
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-primary/10 text-primary",
            )}
            aria-hidden="true"
          >
            <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
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
