import { Info, TrendingUp, DollarSign, MessageSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { computeSaleMetrics, type SaleItemDraft } from "../../types";
import type { SaleTotals } from "../../engine/types";
import { type DiscountEvaluation } from "../../lib/discounts";
import {
  percentToValue,
  readDiscountMode,
  valueToPercent,
  writeDiscountMode,
  type DiscountMode,
} from "../../lib/discount-mode";
import { useEffect, useState } from "react";
import { useCardPriceConfig } from "@/features/payment-methods/hooks/use-card-price-config";
import { calcParcela, maxInstallmentsFor, calcTotalCartaoPdv } from "@/lib/pricing/card-price";

type Props = {
  companyId: string;
  items: SaleItemDraft[];
  totals: SaleTotals;
  /** Quantidade total de unidades no carrinho. */
  itemCount: number;
  /** Quantidade de linhas (itens distintos). */
  lineCount?: number;
  discountValue: number;
  shipping?: number;
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
  companyId,
  items,
  totals,
  itemCount,
  lineCount,
  discountValue,
  shipping = 0,
  discount,
  onDiscountChange,
  changeDue,
  readOnly,
  onOpenNotes,
}: Props) {
    const { data: cardPriceConfig } = useCardPriceConfig(companyId);
  // Desconto em R$ ou %: a venda sempre recebe o valor em reais.
  const [discountMode, setDiscountMode] = useState<DiscountMode>(readDiscountMode);
  const [percentInput, setPercentInput] = useState(() =>
    discountValue > 0 ? String(valueToPercent(totals.items_total, discountValue)) : "",
  );
  // Venda zerada/limpa: zera também o % digitado.
  useEffect(() => {
    if (!discountValue) setPercentInput("");
  }, [discountValue]);
    // Em %, o desconto acompanha o subtotal (ex.: adicionou um item).
  useEffect(() => {
    if (discountMode !== "percent" || !percentInput) return;
    const next = percentToValue(totals.items_total, Number(percentInput) || 0);
    if (next !== discountValue) onDiscountChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totals.items_total]);
  function changeMode(mode: DiscountMode) {
    if (mode === discountMode) return;
    if (mode === "percent") {
      setPercentInput(discountValue > 0 ? String(valueToPercent(totals.items_total, discountValue)) : "");
    }
    setDiscountMode(mode);
    writeDiscountMode(mode);
  }
  const hint = discountHint(discount);
  const { profit, margin, hasCost } = computeSaleMetrics(items, discountValue);
  const isNegative = profit < 0;
  const hasNotes = items.some(it => !!it.notes);
  const cardTotal = cardPriceConfig?.active && items.length > 0
    ? calcTotalCartaoPdv(items, discountValue, shipping, cardPriceConfig)
    : null;
    // Abaixo do valor mínimo para parcelar, o cartão é só 1x.
  const cardMaxInstallments =
    cardTotal != null && cardPriceConfig ? maxInstallmentsFor(cardTotal, cardPriceConfig) : 1;
  const cardInstallment = cardTotal != null
    ? calcParcela(cardTotal, cardMaxInstallments)
    : null;

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
            <div className="flex items-center gap-1.5">
              <div className="flex h-8 overflow-hidden rounded-lg border border-slate-700/60 text-xs">
                {(["value", "percent"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    disabled={readOnly}
                    onClick={() => changeMode(m)}
                    className={cn(
                      "px-2 font-semibold transition-colors",
                      discountMode === m
                        ? "bg-primary text-primary-foreground"
                        : "text-slate-400 hover:bg-slate-800/60",
                    )}
                    aria-pressed={discountMode === m}
                  >
                    {m === "value" ? "R$" : "%"}
                  </button>
                ))}
              </div>
              <Input
                id="pdv-discount"
                type="number"
                min={0}
                max={discountMode === "percent" ? 100 : undefined}
                step={discountMode === "percent" ? "0.1" : "0.01"}
                disabled={readOnly}
                value={discountMode === "percent" ? percentInput : discountValue || ""}
                onChange={(e) => {
                  if (discountMode === "percent") {
                    setPercentInput(e.target.value);
                    onDiscountChange(
                      percentToValue(totals.items_total, Number(e.target.value) || 0),
                    );
                  } else {
                    onDiscountChange(Number(e.target.value) || 0);
                  }
                }}
                placeholder={discountMode === "percent" ? "0" : "0,00"}
                className="h-8 w-24 rounded-lg text-right text-sm font-medium tabular-nums"
              />
            </div>
          </div>
          {discountMode === "percent" && discountValue > 0 ? (
            <p className="text-right text-xs text-slate-500 tabular-nums">
              {percentInput || 0}% = {formatCurrency(discountValue)}
            </p>
          ) : null}
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

        {cardTotal != null && cardInstallment != null && cardPriceConfig && (
          <p
            data-testid="pdv-card-total"
            className="mt-1.5 px-3 text-right text-xs font-medium tabular-nums text-slate-500"
          >
                        No cartão: {formatCurrency(cardTotal)}
            {cardMaxInstallments > 1
              ? ` · até ${cardMaxInstallments}x de ${formatCurrency(cardInstallment)}`
              : " · 1x"}
          </p>
        )}

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
