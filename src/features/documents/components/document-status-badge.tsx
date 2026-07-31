import { cn } from "@/lib/utils";
import { DOCUMENT_STATUS_LABELS } from "../data";
import type { DocumentStatus } from "../types";

const TONE: Record<DocumentStatus, string> = {
  ready: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  generating: "border-primary/20 bg-primary/10 text-primary",
  pending: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  shared: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  signed: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  archived: "border-border bg-muted text-muted-foreground",
  failed: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
};

export function DocumentStatusBadge({ status }: { status: DocumentStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium",
        TONE[status],
      )}
    >
      {status === "generating" ? (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      ) : null}
      {DOCUMENT_STATUS_LABELS[status]}
    </span>
  );
}
