import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PROCESS_STATUS_LABELS } from "../data";
import type { ProcessStatus } from "../types";

const TONE: Record<ProcessStatus, string> = {
  running:
    "border-primary/20 bg-primary/10 text-primary",
  completed:
    "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  failed:
    "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
  cancelled: "bg-muted text-muted-foreground",
  scheduled:
    "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  queued:
    "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400",
};

export function ProcessStatusBadge({ status }: { status: ProcessStatus }) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "h-5 gap-1 px-1.5 text-[10px] font-medium uppercase tracking-wide",
        TONE[status],
      )}
    >
      {status === "running" ? (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      ) : null}
      {PROCESS_STATUS_LABELS[status]}
    </Badge>
  );
}
