import { Badge } from "@/components/ui/badge";
import type { PurchaseStatus } from "../types";

const MAP: Record<PurchaseStatus, { label: string; className: string }> = {
  draft: {
    label: "Rascunho",
    className: "bg-muted text-muted-foreground border-border",
  },
  pending: {
    label: "Pendente",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  received: {
    label: "Recebida",
    className: "bg-success/10 text-success border-success/20",
  },
  cancelled: {
    label: "Cancelada",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export function PurchaseStatusBadge({ status }: { status: string }) {
  const cfg = MAP[status as PurchaseStatus] ?? MAP.draft;
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}
