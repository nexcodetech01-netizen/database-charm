import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useSaleReturns } from "../hooks/use-returns";
import { REFUND_STATUS_LABEL, type RefundStatus } from "../types";

const REFUND_BADGE: Record<RefundStatus, string> = {
  not_required: "bg-muted text-muted-foreground",
  requested: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  confirmed: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  failed: "bg-destructive/10 text-destructive",
};

export function ReturnsList({ saleId }: { saleId: string }) {
  const { data, isLoading } = useSaleReturns(saleId);

  if (isLoading) {
    return (
      <div className="px-4 py-6 text-sm text-muted-foreground">
        Carregando devoluções...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={RotateCcw}
        title="Nenhuma devolução registrada"
        description="Devoluções aparecerão aqui com estoque, financeiro e estorno rastreados."
        className="border-0 bg-transparent py-10"
      />
    );
  }

  return (
    <div className="divide-y divide-border">
      {data.map((ret) => {
        const rs = (ret.refund_status ?? "not_required") as RefundStatus;
        return (
          <div key={ret.id} className="space-y-3 px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold">{ret.number}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(ret.created_at)} · {ret.items.length}{" "}
                  {ret.items.length === 1 ? "item" : "itens"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(Number(ret.total_value))}
                </span>
                <Badge className={REFUND_BADGE[rs]} variant="secondary">
                  {REFUND_STATUS_LABEL[rs]}
                </Badge>
              </div>
            </div>

            <div className="rounded-md border border-border">
              <div className="grid grid-cols-[1fr_80px_110px_110px] gap-3 border-b border-border bg-muted/40 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                <div>Item</div>
                <div className="text-right">Qtd.</div>
                <div className="text-right">Unitário</div>
                <div className="text-right">Subtotal</div>
              </div>
              {ret.items.map((it) => (
                <div
                  key={it.id}
                  className="grid grid-cols-[1fr_80px_110px_110px] gap-3 border-b border-border px-3 py-1.5 text-sm last:border-b-0"
                >
                  <div className="truncate">{it.description}</div>
                  <div className="text-right tabular-nums">
                    {Number(it.quantity)}
                  </div>
                  <div className="text-right tabular-nums">
                    {formatCurrency(Number(it.unit_price))}
                  </div>
                  <div className="text-right tabular-nums font-medium">
                    {formatCurrency(Number(it.total))}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid gap-1 text-xs text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">Motivo:</span>{" "}
                {ret.reason}
              </div>
              {ret.notes ? (
                <div>
                  <span className="font-medium text-foreground">
                    Observações:
                  </span>{" "}
                  {ret.notes}
                </div>
              ) : null}
              {ret.refund_message ? (
                <div>
                  <span className="font-medium text-foreground">Gateway:</span>{" "}
                  {ret.refund_message}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
