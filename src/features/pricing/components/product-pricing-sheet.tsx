import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Calculator, Check } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatNumber } from "@/lib/format";
import { computeOfficialPricing, evaluateOfficialPrice } from "../official";
import { worstCaseFee, effectiveFeePct } from "../official/fees";
import { resolvePricingStatus } from "../official/status";
import { toRoundingPolicySpec } from "../types";
import { usePricingPolicy } from "../hooks/use-pricing-policy";
import { useCompanyFeeTable } from "../hooks/use-company-fee-table";
import { useOperationalDefaults } from "@/features/settings/hooks/use-operational-defaults";
import { useCategories } from "@/features/products/hooks/use-products";
import { PricingStatusBadge } from "./pricing-status-badge";
import { cn } from "@/lib/utils";

const num = (s: string | number | null | undefined) => {
  if (typeof s === "number") return s;
  const n = Number(String(s ?? "0").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const formatInput = (v: number | string) => {
  const n = typeof v === "number" ? v : num(v);
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
};

export interface ProductPricingSheetProduct {
  id: string;
  name: string;
  cost: number | null;
  freight?: number | null;
  packaging?: number | null;
  insurance?: number | null;
  other_costs?: number | null;
  price: number | null;
  category_id?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  product: ProductPricingSheetProduct;
  /** Callback opcional — recebe o preço final escolhido pelo usuário. */
  onApply?: (newPrice: number) => void;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`tabular-nums ${strong ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

export function ProductPricingSheet({ open, onOpenChange, companyId, product, onApply }: Props) {
  const { policy } = usePricingPolicy(companyId);
  const { feeTable } = useCompanyFeeTable(companyId);
  const { data: operationalDefaults } = useOperationalDefaults(companyId);
  const { data: categories = [] } = useCategories(companyId);

  const productCategory = useMemo(() => {
    return categories.find(c => c.id === product.category_id);
  }, [categories, product.category_id]);

  const baseCost = num(product.cost);

  // LÓGICA RÍGIDA: Carrega padrões da empresa se os do produto estiverem zerados (R$ 0,00)
  // mas se o produto já tem valores salvos (mesmo que baixos), respeita o que está no banco.
  const getInitialValue = (productVal: number | null | undefined, defaultVal: number) => {
    const val = num(productVal);
    // Se for exatamente 0 ou null, usa o padrão. Se for > 0, usa o valor do produto.
    return val > 0 ? val : defaultVal;
  };

  const initialFreight = getInitialValue(product.freight, operationalDefaults?.freight ?? 0);
  const initialPackaging = getInitialValue(product.packaging, operationalDefaults?.packaging ?? 2.30);
  const initialOther = getInitialValue(num(product.other_costs) + num(product.insurance), operationalDefaults?.other_costs ?? 0.10);

  // Puxa margem da categoria ou usa a da política como fallback
  const initialTarget = productCategory?.target_margin_pct ?? policy.idealMargin;

  const [freight, setFreight] = useState(formatInput(initialFreight));
  const [packaging, setPackaging] = useState(formatInput(initialPackaging));
  const [otherCosts, setOtherCosts] = useState(formatInput(initialOther));
  const [target, setTarget] = useState(formatInput(initialTarget));
  const [simulatedChannel, setSimulatedChannel] = useState<"standard" | "ml">("standard");
  const [selectedTier, setSelectedTier] = useState<"min" | "target" | "premium">("target");

  useEffect(() => {
    if (open) {
      setFreight(formatInput(initialFreight));
      setPackaging(formatInput(initialPackaging));
      setOtherCosts(formatInput(initialOther));
      setTarget(formatInput(initialTarget));
      setSelectedTier("target");
    }
  }, [open, product.id, initialFreight, initialPackaging, initialOther, initialTarget]);

  // LÓGICA RÍGIDA: Taxa considerada deve ser 0% para padrão, a menos que simule Marketplace
  const feePct = useMemo(() => {
    if (simulatedChannel === "standard") return 0;
    const reference = num(product.price) || baseCost * 2 || 100;
    return effectiveFeePct(worstCaseFee(feeTable, reference), reference);
  }, [feeTable, product.price, baseCost, simulatedChannel]);

  const input = useMemo(
    () => ({
      companyId,
      productId: product.id,
      costs: {
        acquisition: baseCost,
        freight: num(freight),
        packaging: num(packaging),
        otherCosts: num(otherCosts),
      },
      margins: {
        minPct: policy.minMargin,
        targetPct: num(target),
        premiumPct: policy.premiumMargin,
      },
      fee: { pct: feePct, label: "de recebimento" },
      rounding: toRoundingPolicySpec(policy.rounding),
      module: "pricing.product-sheet",
    }),
    [companyId, product.id, baseCost, freight, packaging, otherCosts, target, feePct, policy],
  );

  const result = useMemo(() => computeOfficialPricing(input), [input]);
  // LÓGICA RÍGIDA: Mínimo < Recomendado < Premium
  const thresholds = useMemo(() => {
    const t = num(target);
    return {
      minMarginPct: policy.minMargin,
      idealMarginPct: t,
      premiumMarginPct: Math.max(t + 0.01, policy.premiumMargin),
    };
  }, [policy.minMargin, policy.premiumMargin, target]);
  const currentEval = useMemo(() => {
    const evaluated = evaluateOfficialPrice(num(product.price), input);
    return { ...evaluated, ...resolvePricingStatus(evaluated.marginPct, thresholds) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.price, input]);
  const suggestedEval = useMemo(() => {
    const evaluated = evaluateOfficialPrice(result.targetPrice, input);
    return { ...evaluated, ...resolvePricingStatus(evaluated.marginPct, thresholds) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.targetPrice, input]);

  const finalAppliedPrice = useMemo(() => {
    if (selectedTier === "min") return result.minPrice;
    if (selectedTier === "premium") return result.premiumPrice;
    return result.targetPrice;
  }, [selectedTier, result.minPrice, result.targetPrice, result.premiumPrice]);

  function apply() {
    if (!onApply) {
      toast.info("Preço sugerido aplicado ao formulário. Revise os dados e clique em Salvar Produto para confirmar.");
      return;
    }
    onApply(finalAppliedPrice);
    toast.success(`Preço sugerido aplicado ao formulário: ${formatCurrency(finalAppliedPrice)}. Clique em Salvar Produto para confirmar.`);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            Calcular preço
          </SheetTitle>
          <SheetDescription>{product.name}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                Preço atual
              </span>
              <PricingStatusBadge status={currentEval.status} label={currentEval.label} />
            </div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="text-2xl font-semibold tabular-nums">
                {formatCurrency(num(product.price))}
              </span>
              <span className="text-xs text-muted-foreground">
                margem {formatNumber(currentEval.marginPct)}% · markup{" "}
                {formatNumber(currentEval.markupPct)}%
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Custo atual (R$)">
              <Input value={formatNumber(baseCost)} disabled />
            </Field>
            <Field label="Frete (R$)">
              <Input
                inputMode="decimal"
                value={freight}
                onChange={(e) => setFreight(e.target.value)}
              />
            </Field>
            <Field label="Embalagem (R$)">
              <Input
                inputMode="decimal"
                value={packaging}
                onChange={(e) => setPackaging(e.target.value)}
              />
            </Field>
            <Field label="Outros custos (R$)">
              <Input
                inputMode="decimal"
                value={otherCosts}
                onChange={(e) => setOtherCosts(e.target.value)}
              />
            </Field>
            <Field label="Margem desejada (%)">
              <Input
                inputMode="decimal"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              />
            </Field>
            <Field label="Taxa considerada (%)">
              <div className="flex gap-2">
                <Input value={formatNumber(feePct)} disabled className="flex-1" />
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setSimulatedChannel(s => s === "standard" ? "ml" : "standard")}
                >
                  {simulatedChannel === "standard" ? "Simular ML" : "Padrão (0%)"}
                </Button>
              </div>
            </Field>
          </div>

          <Separator />

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-primary">Preço sugerido</span>
              <PricingStatusBadge status={suggestedEval.status} label={suggestedEval.label} />
            </div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">
              {formatCurrency(finalAppliedPrice)}
            </div>
            <div className="mt-3 divide-y divide-border/50">
              <Line 
                label="Custo total" 
                value={formatCurrency(num(baseCost) + num(freight) + num(packaging) + num(otherCosts))} 
              />
              <Line label="Lucro por unidade" value={formatCurrency(result.profit)} strong />
              <Line label="Margem líquida" value={`${formatNumber(result.marginPct)}%`} />
              <Line label="Markup" value={`${formatNumber(result.markupPct)}%`} />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <button 
              type="button"
              onClick={() => setSelectedTier("min")}
              className={cn(
                "rounded-lg border p-3 text-center transition-all",
                selectedTier === "min" 
                  ? "border-primary bg-primary/10 ring-1 ring-primary" 
                  : "border-border/60 hover:border-primary/50"
              )}
            >
              <div className="text-[11px] uppercase text-muted-foreground">Mínimo</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {formatCurrency(result.minPrice)}
              </div>
            </button>
            <button 
              type="button"
              onClick={() => setSelectedTier("target")}
              className={cn(
                "rounded-lg border p-3 text-center transition-all",
                selectedTier === "target" 
                  ? "border-primary bg-primary/10 ring-1 ring-primary" 
                  : "border-primary/30 bg-primary/5"
              )}
            >
              <div className="text-[11px] uppercase text-primary">Recomendado</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {formatCurrency(result.recommendedPrice)}
              </div>
            </button>
            <button 
              type="button"
              onClick={() => setSelectedTier("premium")}
              className={cn(
                "rounded-lg border p-3 text-center transition-all",
                selectedTier === "premium" 
                  ? "border-primary bg-primary/10 ring-1 ring-primary" 
                  : "border-border/60 hover:border-primary/50"
              )}
            >
              <div className="flex items-center justify-center gap-1">
                <div className="text-[11px] uppercase text-muted-foreground">Premium</div>
                {suggestedEval.status === "premium" && selectedTier === "premium" && (
                   <span className="inline-flex items-center rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                     Margem premium
                   </span>
                )}
              </div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {formatCurrency(result.premiumPrice)}
              </div>
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Nada é salvo automaticamente. Clique em <strong>Aplicar</strong> para usar o preço
            sugerido
            {onApply ? " no formulário" : " (copie e cole no cadastro)"}.
          </p>
        </div>

        <SheetFooter className="mt-6 gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={apply}>
            <Check className="mr-1.5 h-4 w-4" /> Aplicar preço sugerido
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
