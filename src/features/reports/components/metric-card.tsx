import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value?: string;
  hint?: string;
  icon: LucideIcon;
  tone?: string;
  loading?: boolean;
}

export function MetricCard({ label, value, hint, icon: Icon, tone = "text-primary", loading }: Props) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <div className="mt-2">
            {loading || value === undefined ? (
              <Skeleton className="h-7 w-28" />
            ) : (
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
            )}
          </div>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn("grid h-9 w-9 place-items-center rounded-lg bg-muted", tone)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
