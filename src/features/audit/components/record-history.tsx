import { useState } from "react";
import { ChevronDown, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCanViewAudit, useRecordHistory } from "../hooks/use-audit";
import { AuditEntryItem } from "./audit-entry-item";

export function RecordHistory({
  companyId,
  table,
  recordId,
  defaultOpen = false,
}: {
  companyId: string;
  table: string;
  recordId: string | null | undefined;
  defaultOpen?: boolean;
}) {
  const { data: canView } = useCanViewAudit(companyId);
  const [open, setOpen] = useState(defaultOpen);
  const { data, isLoading } = useRecordHistory(table, recordId, !!canView && open);

  if (!canView || !recordId) return null;

  return (
    <div className="rounded-md border">
      <Button
        type="button"
        variant="ghost"
        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2">
          <History className="h-4 w-4" /> Histórico de alterações
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open ? (
        <div className="border-t px-3">
          {isLoading ? (
            <div className="space-y-2 py-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (data ?? []).length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              Nada registrado ainda. O histórico começa a contar a partir de quando foi ligado.
            </p>
          ) : (
            <ul className="divide-y">
              {(data ?? []).map((e) => (
                <AuditEntryItem key={e.id} entry={e} compact />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
