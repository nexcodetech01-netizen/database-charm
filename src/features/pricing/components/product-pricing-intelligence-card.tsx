/**
 * ProductPricingIntelligenceCard
 * ==============================
 * Widget da Inteligência Comercial embutido na tela de Produto.
 *
 * REGRAS (idênticas às demais UX de Pricing):
 *   - Zero cálculo aqui. Zero regra de negócio.
 *   - Toda leitura/gravação passa por Use Cases via server functions.
 *   - Nada de acesso direto a Pricing Engine ou Repositories.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { BadgeCheck, Building2, CheckCircle2, Info, Layers, Package, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  getProductPricingIntelligence,
  applyProductSuggestedPrice,
  type ProductPricingIntelligenceDTO,
} from "@/features/pricing/lib/product-pricing.functions";

const cents = (n: number | null | undefined) => formatCurrency(((n ?? 0) as number) / 100);

const ORIGIN_ICON = {
  Produto: Package,
  Categoria: Layers,
  Empresa: Building2,
  Sistema: Sparkles,
  Contexto: Sparkles,
} as const;

interface Props {
  companyId: string;
  productId: string;
  productQueryKey?: readonly unknown[];
}

export function ProductPricingIntelligenceCard({ companyId, productId, productQueryKey }: Props) {
  const qc = useQueryClient();
  const getProductPricingIntelligenceFn = useServerFn(getProductPricingIntelligence);
  const applyProductSuggestedPriceFn = useServerFn(applyProductSuggestedPrice);
  
  const queryKey = ["pricing", "product-intelligence", companyId, productId] as const;

  const query = useQuery({
    queryKey,
    queryFn: () => getProductPricingIntelligenceFn({ data: { companyId, productId } }),
  });

  const [explainOpen, setExplainOpen] = useState(false);

  const applyMutation = useMutation({
    mutationFn: () => applyProductSuggestedPriceFn({ data: { companyId, productId } }),
    onSuccess: async (res) => {
      toast.success(`Preço aplicado: ${formatCurrency(res.appliedPriceCents / 100)}`);
      await qc.invalidateQueries({ queryKey });
      if (productQueryKey) {
        await qc.invalidateQueries({ queryKey: productQueryKey });
      }
      await qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Falha ao aplicar preço");
    },
  });

  const data = query.data;

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
              Inteligência Comercial
            </p>
            <CardTitle className="text-base">Política aplicada</CardTitle>
          </div>
        </div>
        {data ? (
          <div className="flex flex-wrap items-center gap-2">
            <OriginBadge label={data.originLabel} scope={data.product.categoryName} />
            <Badge variant="outline" className="gap-1 text-[10px]">
              <BadgeCheck className="h-3 w-3" />
              Política comercial • {formatPercent(data.targetMarginPct)}%
            </Badge>
          </div>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-5">
        {query.isLoading ? (
          <p className="text-sm text-muted-foreground">Calculando preço sugerido…</p>
        ) : query.isError || !data ? (
          <PolicyEmptyState message={friendlyPricingMessage(query.error)} />
        ) : (
          <>
            {(() => {
              // Fonte única e unificada — mesma matemática do card de canais
              // (Loja Física). Zero cálculo derivado do motor: apenas leitura
              // do preço praticado e do custo total do produto.
              const priceReais = (data.product.currentPriceCents ?? 0) / 100;
              const costReais = (data.product.costTotalCents ?? 0) / 100;
              const profitReais = priceReais - costReais;
              const marginPct = priceReais > 0 ? (profitReais / priceReais) * 100 : 0;
              const profitTone: "positive" | "negative" | "neutral" =
                profitReais > 0 ? "positive" : profitReais < 0 ? "negative" : "neutral";
              return (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <MetricTile label="Preço atual" value={formatCurrency(priceReais)} />
                  <MetricTile
                    label="Custo total"
                    value={formatCurrency(costReais)}
                    tooltip="Custo unitário total do produto (custo + frete + seguro + outros custos)."
                  />
                  <MetricTile
                    label="Lucro real"
                    value={formatCurrency(profitReais)}
                    tone={profitTone}
                    tooltip="Lucro real por unidade vendida na Loja Física — preço atual menos custo total. Não considera taxas de marketplaces."
                  />
                  <MetricTile
                    label="Margem real"
                    value={`${formatPercent(marginPct)}%`}
                    highlight
                    tooltip="Margem efetiva praticada hoje na Loja Física — lucro real dividido pelo preço atual."
                  />
                </div>
              );
            })()}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" />
                Origem:{" "}
                <span className="font-medium text-foreground">
                  {data.originLabel}
                  {data.originLabel === "Categoria" && data.product.categoryName
                    ? ` • ${data.product.categoryName}`
                    : ""}
                </span>
              </span>
              <span>
                Meta da política:{" "}
                <span className="font-medium text-foreground">
                  {formatPercent(data.estimatedMarginPct)}%
                </span>{" "}
                • Preço sugerido pela política:{" "}
                <span className="font-medium text-foreground">{cents(data.finalPriceCents)}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setExplainOpen(true)}>
                Ver explicação
              </Button>
              <Button
                size="sm"
                onClick={() => applyMutation.mutate()}
                disabled={applyMutation.isPending || data.differenceCents === 0}
              >
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
                {applyMutation.isPending ? "Aplicando…" : "Aplicar preço sugerido pela política"}
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <ExplainDialog open={explainOpen} onOpenChange={setExplainOpen} data={data ?? null} />
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

function OriginBadge({ label, scope }: { label: string; scope?: string | null }) {
  const Icon = ORIGIN_ICON[label as keyof typeof ORIGIN_ICON] ?? Sparkles;
  return (
    <Badge variant="secondary" className="gap-1 text-[10px]">
      <Icon className="h-3 w-3" />
      {label}
      {label === "Categoria" && scope ? ` • ${scope}` : ""}
    </Badge>
  );
}

function MetricTile({
  label,
  value,
  highlight,
  tone = "neutral",
  icon: Icon,
  tooltip,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  tone?: "positive" | "negative" | "neutral";
  icon?: React.ComponentType<{ className?: string }>;
  tooltip?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-foreground";
  const labelNode = tooltip ? (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-help items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="truncate">{label}</span>
            <Info className="h-3.5 w-3.5 shrink-0" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-muted-foreground">
      <span className="truncate">{label}</span>
    </span>
  );
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-3",
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card",
      )}
    >
      <div className="flex items-center gap-1.5">
        {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
        {labelNode}
      </div>
      <p
        className={cn(
          "text-2xl font-semibold tabular-nums leading-tight whitespace-nowrap",
          toneClass,
        )}
      >
        {value}
      </p>
    </div>
  );
}

// UUID v4-ish regex — usado para higienizar mensagens técnicas antes de mostrar
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function friendlyPricingMessage(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  if (!raw) return "Nenhuma política comercial configurada.";
  if (/CompanyPolicy/i.test(raw) || /Company.*not found/i.test(raw)) {
    return "Nenhuma política comercial configurada para esta empresa.";
  }
  if (UUID_RE.test(raw)) {
    return "Nenhuma política comercial configurada.";
  }
  return raw;
}

function PolicyEmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{message}</p>
          <p className="text-xs text-muted-foreground">
            Configure margens, arredondamento e comportamento comercial para habilitar as sugestões
            automáticas.
          </p>
        </div>
      </div>
      <Button asChild size="sm" variant="outline">
        <Link to="/inteligencia-comercial/politica-empresa">Configurar política comercial</Link>
      </Button>
    </div>
  );
}

function ExplainDialog({
  open,
  onOpenChange,
  data,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ProductPricingIntelligenceDTO | null;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Explicação do cálculo</DialogTitle>
          <DialogDescription>{data?.summary ?? "Sem detalhes disponíveis."}</DialogDescription>
        </DialogHeader>

        {data ? (
          <div className="space-y-4">
            <ol className="space-y-2 border-l border-border pl-4">
              {data.steps.map((s, idx) => (
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

            {data.warnings.length > 0 ? (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
                <p className="mb-1 font-semibold text-amber-700 dark:text-amber-400">Avisos</p>
                <ul className="list-disc space-y-0.5 pl-4 text-muted-foreground">
                  {data.warnings.map((w, i) => (
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
