/**
 * PricingSimulatorWorkspace — UX-004 (Commercial Experience)
 * ==========================================================
 * Simulador de precificação — duas colunas (entradas / resultado).
 *
 * REGRAS:
 *  - Zero cálculo aqui. Zero regra de negócio.
 *  - Toda simulação chama `simulatePricing` (server function).
 *  - `simulatePricing` usa exclusivamente:
 *        defaultResolver.build() + defaultEngine.compute() + defaultEngine.explain()
 *    através da Application Layer.
 *  - Nenhum dado é salvo — a tela é 100% "what-if".
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Calculator,
  ArrowDownRight,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Info,
  Layers,
  Sparkles,
  TrendingUp,
  Package,
} from "lucide-react";
import { PageLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getPricingSimulatorBootstrap,
  simulatePricing,
  type SimulatePricingDTO,
  type SimulatorBootstrapDTO,
  type SimulatorMarginKind,
} from "@/features/pricing/lib/pricing-simulator.functions";

// ─────────────────────────────────────────────────────────────────────────────
// Utils UI
// ─────────────────────────────────────────────────────────────────────────────

const numStr = (s: string): number => {
  if (typeof s !== "string" || s.length === 0) return 0;
  // Aceita "R$ 1.234,56", "1234.56", "10,", "10,5", "  ", etc.
  const cleaned = s
    .replace(/[^\d,.-]/g, "") // remove símbolos, letras, espaços
    .replace(/\.(?=\d{3}(\D|$))/g, "") // remove separador de milhar pt-BR
    .replace(",", ".");
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
};
const cents = (v: number) => formatCurrency(Number.isFinite(v) ? v / 100 : 0);

const ORIGIN_ICON = {
  Produto: Package,
  Categoria: Layers,
  Empresa: Building2,
  Sistema: Sparkles,
  Contexto: Sparkles,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Workspace
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  companyId: string;
}

export function PricingSimulatorWorkspace({ companyId }: Props) {
  const bootstrap = useQuery({
    queryKey: ["pricing", "simulator", "bootstrap", companyId] as const,
    queryFn: () => getPricingSimulatorBootstrap({ data: { companyId } }),
  });

  const [form, setForm] = useState({
    categoryId: "none",
    channelId: "none",
    cost: "",
    freight: "",
    packaging: "",
    insurance: "",
    otherCosts: "",
    quantity: "1",
    currentPrice: "",
    marginTarget: "ideal" as SimulatorMarginKind,
    customMargin: "",
  });

  const [result, setResult] = useState<SimulatePricingDTO | null>(null);
  const [explainOpen, setExplainOpen] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (numStr(form.cost) <= 0) missing.push("Custo do produto");
    if (numStr(form.quantity) <= 0) missing.push("Quantidade");
    if (form.marginTarget === "custom" && numStr(form.customMargin) <= 0) {
      missing.push("Margem personalizada");
    }
    return missing;
  }, [form.cost, form.quantity, form.marginTarget, form.customMargin]);

  const canSimulate = missingFields.length === 0;

  const mutation = useMutation({
    mutationFn: () =>
      simulatePricing({
        data: {
          companyId,
          categoryId: form.categoryId === "none" ? null : form.categoryId,
          channelId: form.channelId,
          costCents: Math.round(numStr(form.cost) * 100),
          freightCents: Math.round(numStr(form.freight) * 100),
          packagingCents: Math.round(numStr(form.packaging) * 100),
          insuranceCents: Math.round(numStr(form.insurance) * 100),
          otherCostsCents: Math.round(numStr(form.otherCosts) * 100),
          quantity: Math.max(1, Math.round(numStr(form.quantity))),

          marginTarget: form.marginTarget,
          customMarginPct: form.marginTarget === "custom" ? numStr(form.customMargin) : undefined,
          currentPriceCents:
            numStr(form.currentPrice) > 0 ? Math.round(numStr(form.currentPrice) * 100) : null,
        },
      }),
    onSuccess: (dto) => setResult(dto),
  });

  const handleSimulate = () => {
    if (!canSimulate) return;
    mutation.mutate();
  };

  const actions = (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleSimulate} disabled={!canSimulate || mutation.isPending} size="sm">
        <Calculator className="mr-1.5 h-4 w-4" />
        {mutation.isPending ? "Calculando…" : "Simular preço"}
      </Button>
      {!canSimulate ? (
        <p className="text-[10px] text-muted-foreground">
          Preencha: <span className="text-destructive">{missingFields.join(", ")}</span>
        </p>
      ) : null}
    </div>
  );

  return (
    <PageLayout
      title="Simulador de Precificação"
      description="Teste custos, canais e estratégias antes de cadastrar ou alterar um produto. Nada é salvo automaticamente."
      icon={Calculator}
      meta={
        bootstrap.data?.companyPolicy ? (
          <Badge variant="outline" className="gap-1">
            <BadgeCheck className="h-3 w-3" />
            Política vigente v{bootstrap.data.companyPolicy.version}
          </Badge>
        ) : null
      }
      actions={actions}
    >
      <div className="grid gap-6 lg:grid-cols-5">
        <InputsPanel
          form={form}
          set={set}
          bootstrap={bootstrap.data}
          loading={bootstrap.isLoading}
        />
        <ResultsPanel
          result={result}
          pending={mutation.isPending}
          error={mutation.error}
          onExplain={() => setExplainOpen(true)}
        />
      </div>

      <ExplainDialog open={explainOpen} onOpenChange={setExplainOpen} data={result} />
    </PageLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Coluna esquerda — Entradas
// ─────────────────────────────────────────────────────────────────────────────

interface FormShape {
  categoryId: string;
  channelId: string;
  cost: string;
  freight: string;
  packaging: string;
  insurance: string;
  otherCosts: string;
  quantity: string;
  currentPrice: string;
  marginTarget: SimulatorMarginKind;
  customMargin: string;
}

function InputsPanel({
  form,
  set,
  bootstrap,
  loading,
}: {
  form: FormShape;
  set: <K extends keyof FormShape>(k: K, v: FormShape[K]) => void;
  bootstrap: SimulatorBootstrapDTO | undefined;
  loading: boolean;
}) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Entradas</CardTitle>
        <CardDescription>
          Preencha os dados da simulação. Campos obrigatórios marcados com *.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria">
            <Select
              value={form.categoryId}
              onValueChange={(v) => set("categoryId", v)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sem categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem categoria (herda Empresa)</SelectItem>
                {bootstrap?.categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    {c.hasOwnPolicy ? " • política própria" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Canal de venda">
            <Select
              value={form.channelId}
              onValueChange={(v) => set("channelId", v)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(bootstrap?.channels ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.label}
                    {c.variableFeePct > 0 ? ` • ${c.variableFeePct}%` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <MoneyField
            label="Custo do produto *"
            value={form.cost}
            onChange={(v) => set("cost", v)}
            required
          />
          <MoneyField
            label="Frete unitário"
            value={form.freight}
            onChange={(v) => set("freight", v)}
          />
          <MoneyField
            label="Embalagem"
            value={form.packaging}
            onChange={(v) => set("packaging", v)}
          />
          <MoneyField label="Seguro" value={form.insurance} onChange={(v) => set("insurance", v)} />
          <MoneyField
            label="Outras despesas"
            value={form.otherCosts}
            onChange={(v) => set("otherCosts", v)}
          />

          <Field label="Quantidade *">
            <Input
              inputMode="numeric"
              value={form.quantity}
              onChange={(e) => set("quantity", e.target.value)}
            />
          </Field>
          <MoneyField
            label="Preço atual (opcional)"
            value={form.currentPrice}
            onChange={(v) => set("currentPrice", v)}
            helper="Se informado, mostra a comparação com o preço recomendado."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Estratégia de margem">
            <Select
              value={form.marginTarget}
              onValueChange={(v) => set("marginTarget", v as SimulatorMarginKind)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="min">
                  Mínima{" "}
                  {bootstrap?.companyPolicy
                    ? `(${formatNumber(bootstrap.companyPolicy.minMarginPct)}%)`
                    : ""}
                </SelectItem>
                <SelectItem value="ideal">
                  Ideal{" "}
                  {bootstrap?.companyPolicy
                    ? `(${formatNumber(bootstrap.companyPolicy.idealMarginPct)}%)`
                    : ""}
                </SelectItem>
                <SelectItem value="premium">
                  Premium{" "}
                  {bootstrap?.companyPolicy
                    ? `(${formatNumber(bootstrap.companyPolicy.premiumMarginPct)}%)`
                    : ""}
                </SelectItem>
                <SelectItem value="custom">Personalizada</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {form.marginTarget === "custom" ? (
            <Field label="Margem personalizada (%) *">
              <Input
                inputMode="decimal"
                value={form.customMargin}
                onChange={(e) => set("customMargin", e.target.value)}
                placeholder="Ex: 42"
                className={cn(numStr(form.customMargin) <= 0 && "border-destructive/60")}
              />
            </Field>
          ) : (
            <div />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  children,
  helper,
}: {
  label: string;
  children: React.ReactNode;
  helper?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {helper ? <p className="text-[10px] text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function MoneyField({
  label,
  value,
  onChange,
  helper,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  helper?: string;
  required?: boolean;
}) {
  const missing = required && numStr(value) <= 0;
  return (
    <Field label={label} helper={helper}>
      <Input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0,00"
        className={cn(missing && "border-destructive/60")}
      />
    </Field>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Coluna direita — Resultado
// ─────────────────────────────────────────────────────────────────────────────

function ResultsPanel({
  result,
  pending,
  error,
  onExplain,
}: {
  result: SimulatePricingDTO | null;
  pending: boolean;
  error: unknown;
  onExplain: () => void;
}) {
  return (
    <Card className="lg:col-span-3 border-primary/20">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
            Resultado
          </p>
          <CardTitle className="text-base">Simulação de preço</CardTitle>
        </div>
        {result ? (
          <div className="flex flex-wrap items-center gap-2">
            <OriginBadge label={result.originLabel} />
            <Badge variant="outline" className="gap-1 text-[10px]">
              <BadgeCheck className="h-3 w-3" /> {result.strategyLabel}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              Política {result.policyVersion}
            </Badge>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5">
        {pending ? (
          <SkeletonResult />
        ) : error ? (
          <p className="text-sm text-destructive">
            {error instanceof Error ? error.message : "Falha ao simular."}
          </p>
        ) : !result ? (
          <EmptyResult />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricTile label="Preço mínimo" value={cents(result.minPriceCents)} />
              <MetricTile
                label="Preço recomendado"
                value={cents(result.finalPriceCents)}
                highlight
              />
              <MetricTile label="Preço premium" value={cents(result.premiumPriceCents)} />
              <MetricTile label="Margem estimada" value={`${formatNumber(result.marginPct)}%`} />
              <MetricTile label="Markup" value={`${formatNumber(result.markupPct)}%`} />
              <MetricTile label="Custo total" value={cents(result.costTotalCents)} />
              <MetricTile
                label="Lucro bruto"
                value={cents(result.grossProfitCents)}
                tone={result.grossProfitCents < 0 ? "negative" : "positive"}
              />
              <MetricTile
                label="Lucro líquido"
                value={cents(result.netProfitCents)}
                tone={result.netProfitCents < 0 ? "negative" : "positive"}
              />
              <MetricTile label="Quantidade" value={formatNumber(result.quantity)} />
            </div>

            {result.comparison ? <ComparisonBlock data={result.comparison} /> : null}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                Origem da política:{" "}
                <span className="font-medium text-foreground">{result.originLabel}</span>
              </span>
              <Button variant="outline" size="sm" onClick={onExplain}>
                Como esse preço foi calculado?
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function OriginBadge({ label }: { label: string }) {
  const Icon = ORIGIN_ICON[label as keyof typeof ORIGIN_ICON] ?? Sparkles;
  return (
    <Badge variant="secondary" className="gap-1 text-[10px]">
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function MetricTile({
  label,
  value,
  highlight,
  tone = "neutral",
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: "positive" | "negative" | "neutral";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-foreground";
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card",
      )}
    >
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums", toneClass)}>{value}</p>
    </div>
  );
}

function ComparisonBlock({ data }: { data: NonNullable<SimulatePricingDTO["comparison"]> }) {
  const positive = data.differenceCents > 0;
  const zero = data.differenceCents === 0;
  const Icon = zero ? TrendingUp : positive ? ArrowUpRight : ArrowDownRight;
  const tone = zero
    ? "text-muted-foreground"
    : positive
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-primary">
        Comparação com preço atual
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricTile label="Preço atual" value={cents(data.currentPriceCents)} />
        <MetricTile label="Preço recomendado" value={cents(data.recommendedPriceCents)} highlight />
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Diferença</p>
          <p
            className={cn(
              "mt-1 inline-flex items-center gap-1 text-lg font-semibold tabular-nums",
              tone,
            )}
          >
            <Icon className="h-4 w-4" />
            {zero
              ? "—"
              : `${positive ? "+" : "−"}${formatCurrency(Math.abs(data.differenceCents) / 100)}`}
          </p>
          <p className={cn("text-[10px] tabular-nums", tone)}>
            {zero ? "" : `${positive ? "+" : ""}${formatNumber(data.differencePct)}%`}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Impacto no lucro
          </p>
          <p
            className={cn(
              "mt-1 text-lg font-semibold tabular-nums",
              data.profitImpactCents >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400",
            )}
          >
            {data.profitImpactCents >= 0 ? "+" : "−"}
            {formatCurrency(Math.abs(data.profitImpactCents) / 100)}
          </p>
        </div>
      </div>
    </div>
  );
}

function EmptyResult() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
      <Calculator className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium">Preencha os campos e clique em Simular preço</p>
      <p className="text-xs text-muted-foreground">
        Todos os valores usam a Application Layer da Inteligência Comercial.
      </p>
    </div>
  );
}

function SkeletonResult() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-muted/40" />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Explain
// ─────────────────────────────────────────────────────────────────────────────

function ExplainDialog({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: SimulatePricingDTO | null;
}) {
  const steps = useMemo(() => data?.steps ?? [], [data]);
  const warnings = useMemo(() => data?.warnings ?? [], [data]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Como esse preço foi calculado?</DialogTitle>
          <DialogDescription>
            {data?.summary ?? "Nenhuma simulação disponível ainda."}
          </DialogDescription>
        </DialogHeader>

        {data ? (
          <div className="space-y-4">
            <ol className="space-y-2 border-l border-border pl-4">
              {steps.map((s, idx) => (
                <li key={`${s.step}-${idx}`} className="relative">
                  <span className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <div>
                      <p className="font-medium capitalize">{s.step}</p>
                      <p className="text-xs text-muted-foreground">{s.rule}</p>
                    </div>
                    {s.outputCents != null ? (
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {formatCurrency(s.outputCents / 100)}
                      </span>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>

            {warnings.length > 0 ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                <p className="mb-1 font-semibold text-amber-700 dark:text-amber-400">Avisos</p>
                <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {warnings.map((w, i) => (
                    <li key={i}>
                      <span className="font-mono text-[10px]">{w.code}</span> — {w.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="rounded-md border border-border bg-muted/40 p-3 text-[10px] font-mono text-muted-foreground">
              explainId: {data.explainId}
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
