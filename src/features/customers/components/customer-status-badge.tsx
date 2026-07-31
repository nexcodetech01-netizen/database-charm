import { Badge } from "@/components/ui/badge";
import type { CustomerStatus } from "../types";

const MAP: Record<string, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-success/10 text-success border-success/20" },
  inactive: { label: "Inativo", className: "bg-muted text-muted-foreground border-border" },
  archived: { label: "Arquivado", className: "bg-warning/10 text-warning border-warning/20" },
};

export function CustomerStatusBadge({ status }: { status: CustomerStatus | string }) {
  const cfg = MAP[status] ?? MAP.inactive;
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}
