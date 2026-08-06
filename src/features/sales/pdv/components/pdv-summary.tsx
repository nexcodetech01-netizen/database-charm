import { Info, TrendingUp, DollarSign, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { computeSaleMetrics, type SaleItemDraft } from "../../types";
import type { SaleTotals } from "../../engine/types";
import type { DiscountEvaluation } from "../../lib/discounts";
import type { DiscountEvaluation } from "../../lib/discounts";

type Props = {
  totals: SaleTotals;
  /** Quantidade total de unidades no carrinho. */
  itemCount: number;
  /** Quantidade de linhas (itens distintos). */
  lineCount?: number;
  discountValue: number;
  discount: DiscountEvaluation;
  onDiscountChange: (value: number) => void;
  /** Troco — exibido apenas em pagamento em dinheiro. */
  changeDue?: number | null;
  /** Bloqueia edição depois que a venda foi gravada. */
  readOnly?: boolean;
  onOpenNotes?: () => void;
};

function discountHint(evaluation: DiscountEvaluation): string | null {
  switch (evaluation.kind) {
    case "disabled_by_policy":
    case "no_discount":
      return null;
    case "disabled_by_method":
      return evaluation.reason;
    case "ok":
      return `Desconto de ${evaluation.percent.toFixed(1)}% dentro da política`;
    case "exceeds":
      return `Desconto de ${evaluation.percent.toFixed(1)}% acima da política`;
    default:
      return null;
  }
}

function Row({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex h-7 items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          strong
            ? "font-semibold tabular-nums"
            : "font-medium tabular-nums text-foreground/90"
        }
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Painel financeiro do PDV — apresenta os valores já calculados pelo
 * SaleEngine. Nenhum total é recalculado aqui.
 */
export function PDVSummary({
  totals,
  itemCount,
  lineCount,
  discountValue,
  discount,
  onDiscountChange,
  changeDue,
  readOnly,
}: Props) {
  const hint = discountHint(discount);

  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="space-y-0.5 text-[13px]">
        <Row
          label="Itens"
          value={`${lineCount ?? itemCount} · ${itemCount} un`}
        />
        <Row label="Subtotal" value={formatCurrency(totals.items_total)} strong />

        <div className="flex h-8 items-center justify-between gap-3">
          <label htmlFor="pdv-discount" className="text-muted-foreground">
            Desconto
          </label>
          <Input
            id="pdv-discount"
            type="number"
            min={0}
            step="0.01"
            disabled={readOnly}
            value={discountValue || ""}
            onChange={(e) => onDiscountChange(Number(e.target.value) || 0)}
            placeholder="0,00"
            className="h-8 w-28 rounded-lg text-right text-sm font-medium tabular-nums"
          />
        </div>
        {hint && (
          <p
            className={
              discount.kind === "exceeds"
                ? "pb-1 text-xs font-medium text-destructive"
                : "pb-1 text-xs text-muted-foreground"
            }
          >
            {hint}
          </p>
        )}

        {changeDue != null && (
          <Row label="Troco" value={formatCurrency(changeDue)} strong />
        )}
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Total
        </p>
        <p
          data-testid="pdv-grand-total"
          className="truncate text-2xl font-bold leading-none tracking-tight tabular-nums text-primary"
        >
          {formatCurrency(totals.grand_total)}
        </p>
      </div>
    </div>
  );
}

