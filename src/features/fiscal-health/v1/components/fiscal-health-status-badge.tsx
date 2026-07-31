import { cn } from "@/lib/utils";
import type { HealthStatus } from "../service/fiscal-health.service";

const MAP: Record<HealthStatus, { label: string; cls: string }> = {
  green: { label: "Dentro do planejado", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" },
  yellow: { label: "Atenção", cls: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20" },
  orange: { label: "Próximo do limite", cls: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20" },
  red: { label: "Risco tributário", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20" },
  unknown: { label: "Sem dados", cls: "bg-muted text-muted-foreground border-border" },
};

export function FiscalHealthStatusBadge({ status, className }: { status: HealthStatus; className?: string }) {
  const it = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        it.cls,
        className,
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {it.label}
    </span>
  );
}

export function healthBarColor(status: HealthStatus): string {
  switch (status) {
    case "green": return "bg-emerald-500";
    case "yellow": return "bg-yellow-500";
    case "orange": return "bg-orange-500";
    case "red": return "bg-rose-500";
    default: return "bg-muted-foreground";
  }
}
