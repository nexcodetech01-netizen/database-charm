import { Badge } from "@/components/ui/badge";
import type { ReceivableBadge } from "../lib/receivable-state";

const MAP: Record<ReceivableBadge, { label: string; className: string }> = {
  paid: { label: "Paga", className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
  receivable: { label: "A receber", className: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  overdue: { label: "Vencido", className: "bg-red-500/10 text-red-400 border-red-500/30" },
  draft: { label: "Rascunho", className: "bg-slate-700/50 text-slate-400 border-slate-700/50" },
  cancelled: { label: "Cancelada", className: "bg-slate-700/50 text-slate-400 border-slate-700/50" },
};

/** Selo único da situação de pagamento na lista de vendas. */
export function ReceivableStatusBadge({ badge }: { badge: ReceivableBadge }) {
  const cfg = MAP[badge];
  return (
    <Badge variant="outline" className={cfg.className}>
      {cfg.label}
    </Badge>
  );
}
