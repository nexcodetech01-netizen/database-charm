import { useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatNumber } from "@/lib/format";
import { usePricingPolicy } from "../hooks/use-pricing-policy";
import { useCompanyFeeTable } from "../hooks/use-company-fee-table";
import { computeOfficialPricing } from "../official";
import { worstCaseFee, effectiveFeePct } from "../official/fees";
import { toRoundingPolicySpec } from "../types";

const num = (s: string): number => {
  if (typeof s !== "string" || s.length === 0) return 0;
  const cleaned = s
    .replace(/[^\d,.\-]/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "")
    .replace(",", ".");
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};


function Row({ label, value, tone }: { label: string; value: string; tone?: "success" | "danger" }) {
  return (
    <div className="flex items-baseline justify-between rounded-lg border border-border/60 bg-card px-4 py-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`text-lg font-semibold tabular-nums ${
          tone === "danger" ? "text-destructive" : tone === "success" ? "text-emerald-600 dark:text-emerald-400" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function PricingSimulator({ companyId }: { companyId: string }) {
  const { policy } = usePricingPolicy(companyId);

  const [cost, setCost] = useState("100");
  const [freight, setFreight] = useState(String(policy.avgFreight));
  const [packaging, setPackaging] = useState(String(policy.packaging));
  const [commission, setCommission] = useState("0");
  const [feePct, setFeePct] = useState(
    String(policy.defaultChannel === "pix" ? policy.pixFeePct : policy.defaultChannel === "card" ? policy.cardFeePct : 0),
  );
  const [target, setTarget] = useState(String(policy.idealMargin));

  const result = useMemo(
    () =>
      computePricing(
        {
          cost: num(cost),
          freight: num(freight),
          packaging: num(packaging),
          commission: num(commission),
          feePct: num(feePct),
          targetMargin: num(target),
        },
        policy,
      ),
    [cost, freight, packaging, commission, feePct, target, policy],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-4 w-4 text-primary" /> Simulador de preço
        </CardTitle>
        <CardDescription>
          Preencha os custos e a margem desejada — o resultado é recalculado em tempo real.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Custo (R$)">
            <Input inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
          <Field label="Frete (R$)">
            <Input inputMode="decimal" value={freight} onChange={(e) => setFreight(e.target.value)} />
          </Field>
          <Field label="Embalagem (R$)">
            <Input inputMode="decimal" value={packaging} onChange={(e) => setPackaging(e.target.value)} />
          </Field>
          <Field label="Comissão (R$)">
            <Input inputMode="decimal" value={commission} onChange={(e) => setCommission(e.target.value)} />
          </Field>
          <Field label="Taxa aplicada (%)">
            <Input inputMode="decimal" value={feePct} onChange={(e) => setFeePct(e.target.value)} />
          </Field>
          <Field label="Margem desejada (%)">
            <Input inputMode="decimal" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
        </div>

        <div className="space-y-3">
          <Row label="Custo total" value={formatCurrency(result.costTotal)} />
          <Row label="Preço mínimo" value={formatCurrency(result.minPrice)} />
          <Row label="Preço recomendado" value={formatCurrency(result.recommendedPrice)} tone="success" />
          <Row label="Preço premium" value={formatCurrency(result.premiumPrice)} />
          <Separator />
          <Row
            label={`Preço-alvo (${formatNumber(num(target))}%)`}
            value={formatCurrency(result.targetPrice)}
            tone="success"
          />
          <div className="grid grid-cols-3 gap-2">
            <Row label="Lucro" value={formatCurrency(result.profit)} tone={result.profit < 0 ? "danger" : "success"} />
            <Row label="Margem" value={`${formatNumber(result.marginPct)}%`} />
            <Row label="Markup" value={`${formatNumber(result.markupPct)}%`} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
