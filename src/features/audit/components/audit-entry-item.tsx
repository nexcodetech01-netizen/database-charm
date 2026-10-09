import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { describeChanges, describeEntry, VIA_LABEL, type AuditEntry } from "../lib/describe";

const ACTION_TINT: Record<string, string> = {
  insert: "bg-emerald-500",
  update: "bg-amber-500",
  delete: "bg-destructive",
};

/** Uma linha do histórico: quem, quando, por onde e o que mudou. */
export function AuditEntryItem({
  entry,
  compact = false,
}: {
  entry: AuditEntry;
  compact?: boolean;
}) {
  const lines = describeChanges(entry);
  const shown = compact && entry.action !== "update" ? lines.slice(0, 4) : lines;
  const when = new Date(entry.created_at).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: compact ? undefined : "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <li className="flex gap-3 py-2.5">
      <span
        className={cn(
          "mt-1.5 h-2 w-2 shrink-0 rounded-full",
          ACTION_TINT[entry.action] ?? "bg-muted-foreground",
        )}
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
          <span className="font-medium">{describeEntry(entry)}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{when}</span>
          {entry.via !== "app" ? (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">
              {VIA_LABEL[entry.via] ?? entry.via}
            </Badge>
          ) : null}
        </div>
        {shown.length > 0 ? (
          <ul className="space-y-0.5 text-xs text-muted-foreground">
            {shown.map((l) => (
              <li key={l.field} className="flex flex-wrap items-center gap-1">
                <span className="text-foreground/80">{l.label}:</span>
                {l.before !== undefined ? (
                  <>
                    <span className="line-through decoration-muted-foreground/50">{l.before}</span>
                    <ArrowRight className="h-3 w-3" />
                  </>
                ) : null}
                <span className="font-medium text-foreground">{l.after}</span>
              </li>
            ))}
            {shown.length < lines.length ? <li>…</li> : null}
          </ul>
        ) : null}
      </div>
    </li>
  );
}
