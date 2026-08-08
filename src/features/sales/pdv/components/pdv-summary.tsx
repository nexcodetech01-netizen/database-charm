import { Info, TrendingUp, DollarSign, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { computeSaleMetrics, type SaleItemDraft } from "../../types";
import type { SaleTotals } from "../../engine/types";
import { type DiscountEvaluation } from "../../lib/discounts";

type Props = {
  items: SaleItemDraft[];
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
      <span className="text-slate-500">{label}</span>
      <span
        className={
          strong
            ? "font-semibold tabular-nums"
            : "font-medium tabular-nums text-gray-100"
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
  items,
  totals,
  itemCount,
  lineCount,
  discountValue,
  discount,
  onDiscountChange,
  changeDue,
  readOnly,
  onOpenNotes,
}: Props) {
  const hint = discountHint(discount);
  const { profit, margin, hasCost } = computeSaleMetrics(items);
  const isNegative = profit < 0;
  const hasNotes = items.some(it => !!it.notes);

  return (
    <div className="flex flex-col gap-3">
      {/* Enterprise Metrics */}
      <div className="grid grid-cols-2 gap-2">
        <div className={cn(
          "rounded-lg border p-2.5 flex flex-col gap-0.5 min-h-[58px] justify-center",
          isNegative ? "bg-destructive/5 border-destructive/20" : "bg-slate-800/20 border-slate-700/30"
        )}>
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <DollarSign className="h-2.5 w-2.5" /> Lucro Est.
          </span>
          <span className={cn("text-base font-bold tabular-nums leading-tight", isNegative ? "text-destructive" : "text-gray-100")}>
            {formatCurrency(profit)}
          </span>
        </div>
        <div className="rounded-lg border bg-muted/30 p-2.5 flex flex-col gap-0.5 min-h-[58px] justify-center">
          <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <TrendingUp className="h-2.5 w-2.5" /> Margem
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold tabular-nums leading-tight">
              {margin.toFixed(1)}%
            </span>
            {hasCost && (
              <Badge variant="outline" className="text-[7px] h-3 px-1 leading-none uppercase font-bold bg-background">
                Real
              </Badge>
            )}
          </div>
        </div>
      </div>


      <div className="rounded-xl border bg-slate-900 p-3 shadow-sm">
        <div className="space-y-0.5 text-[13px]">
          <Row
            label="Itens"
            value={`${lineCount ?? itemCount} · ${itemCount} un`}
          />
          <Row label="Subtotal" value={formatCurrency(totals.items_total)} strong />

          <div className="flex h-8 items-center justify-between gap-3">
            <label htmlFor="pdv-discount" className="text-slate-500">
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
                  : "pb-1 text-xs text-slate-500"
              }
            >
              {hint}
            </p>
          )}

          {changeDue != null && (
            <Row label="Troco" value={formatCurrency(changeDue)} strong />
          )}
        </div>

        <div className="mt-2 flex items-baseline justify-between gap-3 rounded-lg border border-slate-700/50 bg-slate-800/20 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Total
          </p>
          <p
            data-testid="pdv-grand-total"
            className="truncate text-2xl font-bold leading-none tracking-tight tabular-nums text-gray-100"
          >
            {formatCurrency(totals.grand_total)}
          </p>
        </div>

        <div className="mt-2 flex items-center justify-between px-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenNotes}
            className={cn(
              "h-7 px-2 text-[9px] uppercase font-bold gap-1.5 text-slate-500 hover:text-gray-100",
              hasNotes && "text-gray-100 bg-slate-800/20"
            )}
          >
            <MessageSquare className="h-3 w-3" />
            Observações
          </Button>
          <div className="flex items-center gap-1 text-[9px] text-slate-500 uppercase font-bold italic">
            <Info className="h-2.5 w-2.5" />
            Cálculo Automático
          </div>
        </div>
      </div>
    </div>
  );
}
