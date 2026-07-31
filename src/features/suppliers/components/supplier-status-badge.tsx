import { Badge } from "@/components/ui/badge";
import type { SupplierStatus } from "../types";

const MAP: Record<SupplierStatus, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-success/10 text-success border-success/20" },
  inactive: {
    label: "Inativo",
    className: "bg-muted text-muted-foreground border-border",
  },
  archived: {
    label: "Arquivado",
    className: "bg-muted text-muted-foreground border-border opacity-70",
  },
};

export function SupplierStatusBadge({ status }: { status: string }) {
  const cfg = MAP[status as SupplierStatus] ?? MAP.inactive;
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}
