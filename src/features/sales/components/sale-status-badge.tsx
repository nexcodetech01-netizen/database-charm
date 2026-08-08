import { Badge } from "@/components/ui/badge";
import type { SaleStatus } from "../types";

const MAP: Record<SaleStatus, { label: string; className: string }> = {
  draft: {
    label: "Rascunho",
    className: "bg-slate-700/50 text-slate-400 border-slate-700/50",
  },
  pending: {
    label: "Pendente",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  partially_paid: {
    label: "Parcialmente paga",
    className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  paid: {
    label: "Paga",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  cancelled: {
    label: "Cancelada",
    className: "bg-slate-700/50 text-slate-400 border-slate-700/50",
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
