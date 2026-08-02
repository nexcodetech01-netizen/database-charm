import { useState } from "react";
import { toast } from "sonner";
import { Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePricingPolicy } from "../hooks/use-pricing-policy";
import { DEFAULT_POLICY, type PricingPolicy, type RoundingMode } from "../types";

type State = Record<keyof PricingPolicy, string>;

function toState(p: PricingPolicy): State {
  return {
    minMargin: String(p.minMargin),
    idealMargin: String(p.idealMargin),
    premiumMargin: String(p.premiumMargin),
    pixFeePct: String(p.pixFeePct),
    cardFeePct: String(p.cardFeePct),
    commissionPct: String(p.commissionPct),
    avgFreight: String(p.avgFreight),
    packaging: String(p.packaging),
    otherCosts: String(p.otherCosts),
    rounding: p.rounding,
    defaultChannel: p.defaultChannel,
  };
}

const num = (s: string) => {
  const n = Number(String(s).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground/80">{hint}</p> : null}
    </div>
  );
}

export function PricingPolicyForm({ companyId }: { companyId: string }) {
  const { policy, setPolicy, reset } = usePricingPolicy(companyId);
  const [form, setForm] = useState<State>(() => toState(policy));

  function set<K extends keyof State>(k: K, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  function save() {
    const next: PricingPolicy = {
      minMargin: num(form.minMargin),
      idealMargin: num(form.idealMargin),
      premiumMargin: num(form.premiumMargin),
      pixFeePct: num(form.pixFeePct),
      cardFeePct: num(form.cardFeePct),
      commissionPct: num(form.commissionPct),
      avgFreight: num(form.avgFreight),
      packaging: num(form.packaging),
      otherCosts: num(form.otherCosts),
      rounding: form.rounding as RoundingMode,
      defaultChannel: form.defaultChannel as PricingPolicy["defaultChannel"],
    };
    setPolicy(next);
    toast.success("Política de preços salva");
  }

  function handleReset() {
    reset();
    setForm(toState(DEFAULT_POLICY));
    toast.info("Política restaurada para o padrão");
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Margens de referência</CardTitle>
          <CardDescription>
            Definem os limites <strong>mínimo</strong>, <strong>ideal</strong> e{" "}
            <strong>premium</strong> (% sobre o preço de venda) usados para classificar a saúde do
            preço.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Margem mínima (%)" hint="Abaixo disso, o preço é bloqueado como inseguro.">
            <Input
              inputMode="decimal"
              value={form.minMargin}
              onChange={(e) => set("minMargin", e.target.value)}
            />
          </Field>
          <Field label="Margem ideal (%)" hint="Alvo padrão do simulador e do 'preço recomendado'.">
            <Input
              inputMode="decimal"
              value={form.idealMargin}
              onChange={(e) => set("idealMargin", e.target.value)}
            />
          </Field>
          <Field
            label="Margem premium (%)"
            hint="Preço aspiracional para produtos de alta demanda."
          >
            <Input
              inputMode="decimal"
              value={form.premiumMargin}
              onChange={(e) => set("premiumMargin", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Taxas e comissões</CardTitle>
          <CardDescription>
            Descontados automaticamente ao calcular a margem líquida.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Taxa PIX (%)">
            <Input
              inputMode="decimal"
              value={form.pixFeePct}
              onChange={(e) => set("pixFeePct", e.target.value)}
            />
          </Field>
          <Field label="Taxa cartão (%)">
            <Input
              inputMode="decimal"
              value={form.cardFeePct}
              onChange={(e) => set("cardFeePct", e.target.value)}
            />
          </Field>
          <Field label="Comissão (%)" hint="Vendedor, marketplace, indicação.">
            <Input
              inputMode="decimal"
              value={form.commissionPct}
              onChange={(e) => set("commissionPct", e.target.value)}
            />
          </Field>
          <Field label="Canal padrão do simulador">
            <Select value={form.defaultChannel} onValueChange={(v) => set("defaultChannel", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="card">Cartão</SelectItem>
                <SelectItem value="none">Sem taxa</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Custos operacionais padrão</CardTitle>
          <CardDescription>
            Valores em R$ por unidade — usados como sugestão inicial.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Frete médio (R$)">
            <Input
              inputMode="decimal"
              value={form.avgFreight}
              onChange={(e) => set("avgFreight", e.target.value)}
            />
          </Field>
          <Field label="Embalagem (R$)">
            <Input
              inputMode="decimal"
              value={form.packaging}
              onChange={(e) => set("packaging", e.target.value)}
            />
          </Field>
          <Field label="Outras despesas (R$)">
            <Input
              inputMode="decimal"
              value={form.otherCosts}
              onChange={(e) => set("otherCosts", e.target.value)}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Arredondamento comercial</CardTitle>
          <CardDescription>Aplicado sobre todos os preços sugeridos.</CardDescription>
        </CardHeader>
        <CardContent>
          <Field label="Estratégia">
            <Select value={form.rounding} onValueChange={(v) => set("rounding", v)}>
              <SelectTrigger className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem arredondamento (2 casas)</SelectItem>
                <SelectItem value="integer">Inteiro</SelectItem>
                <SelectItem value="end_90">Final ,90</SelectItem>
                <SelectItem value="end_99">Final ,99</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="mr-1.5 h-4 w-4" /> Restaurar padrão
        </Button>
        <Button onClick={save}>
          <Save className="mr-1.5 h-4 w-4" /> Salvar política
        </Button>
      </div>
    </div>
  );
}
