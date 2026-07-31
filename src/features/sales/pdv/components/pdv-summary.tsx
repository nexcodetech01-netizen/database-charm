import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import type { SaleTotals } from "../../engine/types";
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Resumo compacto do PDV — apresenta os valores já calculados pelo SaleEngine.
 * Nenhum total é recalculado aqui.
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
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-sm font-semibold">Resumo</p>

      <div className="mt-3 space-y-2 text-sm">
        <Row label="Quantidade total" value={String(itemCount)} />
        <Row label="Itens" value={String(lineCount ?? itemCount)} />
        <Row label="Subtotal" value={formatCurrency(totals.items_total)} />

        <div className="flex items-center justify-between gap-3">
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
            className="h-10 w-32 text-right text-base tabular-nums"
          />
        </div>
        {hint && (
          <p
            className={
              discount.kind === "exceeds"
                ? "text-xs font-medium text-destructive"
                : "text-xs text-muted-foreground"
            }
          >
            {hint}
          </p>
        )}

        {changeDue != null && (
          <Row label="Troco" value={formatCurrency(changeDue)} />
        )}
      </div>

      <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-3">
          <span className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Total da venda
          </span>
          <span
            data-testid="pdv-grand-total"
            className="shrink-0 text-3xl font-bold tabular-nums text-primary"
          >
            {formatCurrency(totals.grand_total)}
          </span>
        </div>
      </div>
    </div>
  );
}
