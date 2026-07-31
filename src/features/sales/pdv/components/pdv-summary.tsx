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
    <div className="flex h-9 items-center justify-between gap-3">
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
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <p className="text-sm font-semibold tracking-tight">Resumo da venda</p>

      <div className="mt-4 space-y-1 text-sm">
        <Row label="Itens" value={String(lineCount ?? itemCount)} />
        <Row label="Quantidade" value={String(itemCount)} />
        <Row label="Subtotal" value={formatCurrency(totals.items_total)} strong />

        <div className="flex h-9 items-center justify-between gap-3">
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
            className="h-9 w-32 rounded-xl text-right text-sm font-medium tabular-nums"
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

      <div className="mt-4 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Total da venda
        </p>
        <p
          data-testid="pdv-grand-total"
          className="mt-1 truncate text-4xl font-bold leading-none tracking-tight tabular-nums text-primary"
        >
          {formatCurrency(totals.grand_total)}
        </p>
      </div>
    </div>
  );
}

