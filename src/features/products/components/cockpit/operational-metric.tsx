import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface OperationalMetricProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  className?: string;
  intent?: "neutral" | "positive" | "negative" | "warning";
}

export function OperationalMetric({
  label,
  value,
  icon: Icon,
  description,
  trend,
  className,
  intent = "neutral",
}: OperationalMetricProps) {
  const intentColors = {
    neutral: "text-muted-foreground",
    positive: "text-emerald-600 dark:text-emerald-400",
    negative: "text-red-600 dark:text-red-400",
    warning: "text-amber-600 dark:text-amber-400",
  };

  return (
    <Card className={cn("overflow-hidden border-border/50 shadow-sm", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className={cn("h-4 w-4", intentColors[intent])} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums tracking-tight">{value}</div>
        {(description || trend) && (
          <div className="mt-1 flex items-center gap-2">
            {trend && (
              <span
                className={cn(
                  "text-[10px] font-bold uppercase px-1.5 py-0.5 rounded",
                  trend.isPositive ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
                )}
              >
                {trend.isPositive ? "+" : "-"}{Math.abs(trend.value)}%
              </span>
            )}
            {description && (
              <p className="text-[11px] text-muted-foreground line-clamp-1">{description}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
