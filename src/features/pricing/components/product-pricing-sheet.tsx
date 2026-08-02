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
import { PricingStatusBadge } from "./pricing-status-badge";

const num = (s: string | number | null | undefined) => {
  const n = Number(String(s ?? "0").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
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

  const baseCost = num(product.cost);
  const baseFreight = num(product.freight);
  const baseOther = num(product.other_costs) + num(product.insurance);
  const basePackaging =
    typeof product.packaging === "number" ? product.packaging : policy.packaging;

  const [freight, setFreight] = useState(String(baseFreight));
  const [packaging, setPackaging] = useState(String(basePackaging));
  const [otherCosts, setOtherCosts] = useState(String(baseOther));
  const [target, setTarget] = useState(String(policy.idealMargin));

  useEffect(() => {
    if (open) {
      setFreight(String(baseFreight));
      setPackaging(String(basePackaging));
      setOtherCosts(String(baseOther));
      setTarget(String(policy.idealMargin));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product.id]);

  // FASE 4 — taxa vem da tabela única da empresa (pior caso permitido).
  const feePct = useMemo(() => {
    const reference = num(product.price) || baseCost * 2 || 100;
    return effectiveFeePct(worstCaseFee(feeTable, reference), reference);
  }, [feeTable, product.price, baseCost]);

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
  const thresholds = {
    minMarginPct: policy.minMargin,
    idealMarginPct: num(target),
    premiumMarginPct: policy.premiumMargin,
  };
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

  function apply() {
    if (!onApply) {
      toast.info("Copie o preço sugerido e ajuste no formulário do produto.");
      return;
    }
    onApply(result.targetPrice);
    toast.success(`Preço aplicado: ${formatCurrency(result.targetPrice)}`);
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
              <Input value={formatNumber(result.feePct)} disabled />
            </Field>
          </div>

          <Separator />

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-primary">Preço sugerido</span>
              <PricingStatusBadge status={suggestedEval.status} label={suggestedEval.label} />
            </div>
            <div className="mt-1 text-3xl font-semibold tabular-nums">
              {formatCurrency(result.targetPrice)}
            </div>
            <div className="mt-3 divide-y divide-border/50">
              <Line label="Custo total" value={formatCurrency(result.costTotal)} />
              <Line label="Lucro por unidade" value={formatCurrency(result.profit)} strong />
              <Line label="Margem líquida" value={`${formatNumber(result.marginPct)}%`} />
              <Line label="Markup" value={`${formatNumber(result.markupPct)}%`} />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 p-3 text-center">
              <div className="text-[11px] uppercase text-muted-foreground">Mínimo</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {formatCurrency(result.minPrice)}
              </div>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-center">
              <div className="text-[11px] uppercase text-primary">Recomendado</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {formatCurrency(result.recommendedPrice)}
              </div>
            </div>
            <div className="rounded-lg border border-border/60 p-3 text-center">
              <div className="text-[11px] uppercase text-muted-foreground">Premium</div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {formatCurrency(result.premiumPrice)}
              </div>
            </div>
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
