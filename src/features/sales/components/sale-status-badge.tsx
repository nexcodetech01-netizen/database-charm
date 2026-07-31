import { Badge } from "@/components/ui/badge";
import type { SaleStatus } from "../types";

const MAP: Record<SaleStatus, { label: string; className: string }> = {
  draft: {
    label: "Rascunho",
    className: "bg-muted text-muted-foreground border-border",
  },
  pending: {
    label: "Pendente",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  partially_paid: {
    label: "Parcialmente paga",
    className:
      "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  },
  paid: {
    label: "Paga",
    className: "bg-success/10 text-success border-success/20",
  },
  cancelled: {
    label: "Cancelada",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
};

export function SaleStatusBadge({ status }: { status: string }) {
  const cfg = MAP[status as SaleStatus] ?? MAP.draft;
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}
