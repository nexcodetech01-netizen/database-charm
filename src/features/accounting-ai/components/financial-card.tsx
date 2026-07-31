import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

/**
 * FinancialCard — card financeiro puramente visual (sem lógica de negócio).
 */
export interface FinancialCardProps {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  trend?: ReactNode;
  icon?: LucideIcon;
  loading?: boolean;
  unavailable?: boolean;
  highlight?: boolean;
  className?: string;
}

export function FinancialCard({
  label,
  value,
  hint,
  trend,
  icon: Icon,
  loading,
  unavailable,
  highlight,
  className,
}: FinancialCardProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl transition-colors",
        highlight && "border-primary/30 bg-primary/5",
        className,
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          {Icon ? (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          ) : null}
        </div>

        {loading ? (
          <Skeleton className="mt-3 h-7 w-28" />
        ) : unavailable ? (
          <Badge variant="outline" className="mt-3 rounded-lg font-normal">
            Sem dados
          </Badge>
        ) : (
          <p
            className={cn(
              "mt-2 truncate text-2xl font-bold leading-tight tabular-nums",
              highlight && "text-primary",
            )}
          >
            {value}
          </p>
        )}

        {hint && !loading ? (
          <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
        ) : null}

        {trend && !loading ? <div className="mt-1">{trend}</div> : null}
      </CardContent>
    </Card>
  );
}
