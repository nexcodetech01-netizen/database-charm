/**
 * ProductCostBreakdown
 * ====================
 * Bloco de CUSTOS OPERACIONAIS + PRECIFICAÇÃO da ficha do produto.
 *
 * Camada 100% de apresentação:
 *   - Toda soma vem de `useProductFinancials` (fonte única).
 *   - Nenhuma gravação automática: preço/margem só mudam no banco quando o
 *     usuário clica explicitamente em "Salvar preço e margem".
 */
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Calculator,
  Info,
  Percent,
  RotateCcw,
  Save,
  Wallet,
} from "lucide-react";
import { Section } from "@/components/design";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useUpdateProduct } from "@/features/products/hooks/use-products";
import {
  useProductFinancials,
  type ProductFinancialsInput,
} from "@/features/products/hooks/use-product-financials";

export type MarginMode = "margin" | "markup";

interface Props {
  productId: string;
  product: ProductFinancialsInput & { margin_mode?: string | null };
  canEdit?: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const parseNum = (v: string) => {
  const n = Number(v.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
const toInput = (n: number) => String(round2(n)).replace(".", ",");

const MODE_OPTIONS: { value: MarginMode; label: string; hint: string }[] = [
  {
    value: "margin",
    label: "Margem sobre o preço de venda",
    hint: "Preço = Custo ÷ (1 − margem%)",
  },
  {
    value: "markup",
    label: "Markup sobre o custo",
    hint: "Preço = Custo × (1 + markup%)",
  },
];

export function ProductCostBreakdown({ productId, product, canEdit = true }: Props) {
  const [taxInput, setTaxInput] = useState("0");
  const taxRatePct = parseNum(taxInput);
  const fin = useProductFinancials(product, { taxRatePct })!;

  const storedMode: MarginMode =
    product.margin_mode === "markup" ? "markup" : "margin";
  const [mode, setMode] = useState<MarginMode>(storedMode);
  const [marginInput, setMarginInput] = useState(() => toInput(fin.marginPctReal));
  const [priceInput, setPriceInput] = useState(() => toInput(fin.price));
  const [dirty, setDirty] = useState(false);

  const update = useUpdateProduct();

  // Recalcula os campos quando o produto (ou a alíquota simulada) muda e o
  // usuário ainda não editou nada — nunca sobrescreve edição em andamento.
  // Nunca zera o preço já gravado: se o produto tem preço no banco, ele é
  // sempre a fonte inicial do campo.
  useEffect(() => {
    if (dirty) return;
    setMode(storedMode);
    setMarginInput(toInput(fin.marginPctReal));
    setPriceInput(toInput(fin.price));
  }, [dirty, storedMode, fin.marginPctReal, fin.price]);

  const baseCost = fin.costTotalWithoutTax;

  /** Percentual desejado -> preço sugerido, conforme o modo selecionado. */
  const priceFromPct = (pct: number, m: MarginMode = mode): number => {
    if (m === "markup") {
      const divisor = 1 - taxRatePct / 100;
      if (divisor <= 0) return 0;
      return round2((baseCost * (1 + pct / 100)) / divisor);
    }
    const divisor = 1 - (pct + taxRatePct) / 100;
    if (divisor <= 0) return 0;
    return round2(baseCost / divisor);
  };

  /** Preço informado -> percentual, conforme o modo selecionado. */
  const pctFromPrice = (priceValue: number, m: MarginMode = mode): number => {
    if (priceValue <= 0) return 0;
    const tax = (priceValue * taxRatePct) / 100;
    const profit = priceValue - baseCost - tax;
    if (m === "markup") {
      if (baseCost <= 0) return 0;
      return round2((profit / baseCost) * 100);
    }
    return round2((profit / priceValue) * 100);
  };


  const simulated = useMemo(() => {
    const p = parseNum(priceInput);
    const tax = round2((p * taxRatePct) / 100);
    const total = round2(baseCost + tax);
    const profit = round2(p - total);
    return {
      price: p,
      tax,
      costTotal: total,
      profit,
      marginPct: p > 0 ? round2((profit / p) * 100) : 0,
      markupPct: total > 0 ? round2((profit / total) * 100) : 0,
    };
  }, [priceInput, taxRatePct, baseCost]);

  const handleModeChange = (next: MarginMode) => {
    if (next === mode) return;
    setDirty(true);
    setMode(next);
    // O número digitado permanece — só a fórmula muda daqui em diante.
    const price = priceFromPct(parseNum(marginInput), next);
    if (price > 0) setPriceInput(toInput(price));
  };

  const handleMarginChange = (v: string) => {
    setDirty(true);
    setMarginInput(v);
    const next = priceFromPct(parseNum(v));
    // Só propaga para o preço quando o cálculo é válido — evita zerar um
    // preço existente enquanto o usuário digita a margem.
    if (next > 0) setPriceInput(toInput(next));
  };

  const handlePriceChange = (v: string) => {
    setDirty(true);
    setPriceInput(v);
    setMarginInput(toInput(pctFromPrice(parseNum(v))));
  };

  const reset = () => {
    setDirty(false);
    setMode(storedMode);
    setMarginInput(toInput(fin.marginPctReal));
    setPriceInput(toInput(fin.price));
  };

  const save = async () => {
    const nextPrice = round2(parseNum(priceInput));
    // Proteção: nunca sobrescrever um preço já gravado com R$ 0,00.
    if (nextPrice <= 0 && fin.price > 0) {
      toast.error("Informe um preço de venda válido para salvar.");
      return;
    }
    try {
      await update.mutateAsync({
        id: productId,
        input: {
          price: nextPrice,
          margin: round2(parseNum(marginInput)),
          margin_mode: mode,
        },
      });


      setDirty(false);
      toast.success("Preço e margem atualizados");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar preço");
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Section
        title="Custos operacionais e precificação"
        description="Quebra transparente de como o Custo Total é formado e simulação de margem por produto."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Composição de custo */}
          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Composição do custo</h3>
            </div>

            <dl className="divide-y divide-border/50">
              {fin.components.map((c) => (
                <div
                  key={c.key}
                  className="flex items-center justify-between gap-3 py-2.5"
                >
                  <dt className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
                    <span className="truncate">{c.label}</span>
                    {c.pct != null ? (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {formatPercent(c.pct)}%
                      </Badge>
                    ) : null}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label={`Origem de ${c.label}`}
                          className="shrink-0 text-muted-foreground/70 hover:text-foreground"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs text-xs">
                        {c.source}
                      </TooltipContent>
                    </Tooltip>
                  </dt>
                  <dd
                    className={cn(
                      "shrink-0 text-sm font-medium tabular-nums",
                      c.amount === 0 && "text-muted-foreground",
                    )}
                  >
                    {formatCurrency(c.amount)}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-primary/5 px-3 py-3">
              <span className="text-sm font-semibold uppercase tracking-wide">
                Custo total do produto
              </span>
              <span className="text-lg font-semibold tabular-nums">
                {formatCurrency(fin.costTotal)}
              </span>
            </div>

            <div className="mt-4 space-y-1.5">
              <Label htmlFor="tax-rate" className="text-xs">
                Impostos / Alíquota (%) — simulação
              </Label>
              <Input
                id="tax-rate"
                inputMode="decimal"
                value={taxInput}
                onChange={(e) => setTaxInput(e.target.value)}
                className="max-w-[160px]"
              />
              <p className="text-[11px] text-muted-foreground">
                Aplicada sobre o preço de venda somente nesta tela. Nenhum custo
                histórico do produto é alterado.
              </p>
            </div>
          </div>

          {/* Margem / preço */}
          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="mb-3 flex items-center gap-2">
              <Calculator className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Margem e preço de venda</h3>
            </div>

            <div className="mb-4 space-y-1.5">
              <Label className="text-xs">Modo de cálculo</Label>
              <div
                role="radiogroup"
                aria-label="Modo de cálculo do percentual"
                className="grid gap-2 sm:grid-cols-2"
              >
                {MODE_OPTIONS.map((opt) => {
                  const active = mode === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      disabled={!canEdit}
                      onClick={() => handleModeChange(opt.value)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-60",
                        active
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background hover:bg-muted/50",
                      )}
                    >
                      <span className="block text-xs font-medium">{opt.label}</span>
                      <span className="block text-[11px] text-muted-foreground tabular-nums">
                        {opt.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Trocar o modo não altera o número digitado — apenas a fórmula
                usada dali em diante.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="desired-margin" className="text-xs">
                  {mode === "markup"
                    ? "Markup desejado (%)"
                    : "Margem desejada (%)"}
                </Label>
                <Input
                  id="desired-margin"
                  inputMode="decimal"
                  value={marginInput}
                  onChange={(e) => handleMarginChange(e.target.value)}
                  disabled={!canEdit}
                />
                <p className="text-[11px] text-muted-foreground">
                  Livre por produto — sugere o preço ideal.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sale-price" className="text-xs">
                  Preço de venda (R$)
                </Label>
                <Input
                  id="sale-price"
                  inputMode="decimal"
                  value={priceInput}
                  onChange={(e) => handlePriceChange(e.target.value)}
                  disabled={!canEdit}
                />
                <p className="text-[11px] text-muted-foreground">
                  Alterar aqui recalcula a margem sem mexer no custo.
                </p>
              </div>
            </div>

            <dl className="mt-4 divide-y divide-border/50">
              <Row label="Custo total considerado" value={formatCurrency(simulated.costTotal)} />
              <Row
                label="Lucro unitário"
                value={formatCurrency(simulated.profit)}
                intent={simulated.profit >= 0 ? "positive" : "negative"}
              />
              <Row
                label="Margem real"
                value={`${formatPercent(simulated.marginPct)}%`}
                intent={simulated.marginPct >= 0 ? "positive" : "negative"}
              />
              <Row label="Markup sobre custo" value={`${formatPercent(simulated.markupPct)}%`} />
              <Row
                label="Margem salva no cadastro"
                value={`${formatPercent(fin.marginPctStored)}%`}
              />
            </dl>

            {canEdit ? (
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={save} disabled={!dirty || update.isPending}>
                  <Save className="mr-1.5 h-4 w-4" />
                  {update.isPending ? "Salvando..." : "Salvar preço e margem"}
                </Button>
                <Button size="sm" variant="outline" onClick={reset} disabled={!dirty}>
                  <RotateCcw className="mr-1.5 h-4 w-4" /> Descartar
                </Button>
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Percent className="h-3 w-3" /> Nada é gravado automaticamente.
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </Section>
    </TooltipProvider>
  );
}

function Row({
  label,
  value,
  intent = "neutral",
}: {
  label: string;
  value: string;
  intent?: "neutral" | "positive" | "negative";
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "text-sm font-medium tabular-nums",
          intent === "positive" && "text-emerald-600 dark:text-emerald-400",
          intent === "negative" && "text-red-600 dark:text-red-400",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
