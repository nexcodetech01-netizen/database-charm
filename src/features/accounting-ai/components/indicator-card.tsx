import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/** IndicatorCard — indicador compacto (label + valor + referência). */
export interface IndicatorCardProps {
  label: ReactNode;
  value: ReactNode;
  reference?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function IndicatorCard({
  label,
  value,
  reference,
  loading,
  className,
}: IndicatorCardProps) {
  return (
    <div className={cn("rounded-xl border bg-card px-4 py-3", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-5 w-20" />
      ) : (
        <p className="mt-1 truncate text-lg font-semibold tabular-nums">{value}</p>
      )}
      {reference ? (
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{reference}</p>
      ) : null}
    </div>
  );
}
