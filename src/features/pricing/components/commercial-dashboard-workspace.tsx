/**
 * CommercialDashboardWorkspace — UX-005
 * =====================================
 * Tela principal do módulo Comercial.
 *
 * REGRAS:
 *  - Zero cálculo aqui. Zero regra de negócio.
 *  - Toda informação vem exclusivamente de `getCommercialDashboard`
 *    (server function) que orquestra Use Cases + Application Layer ports.
 *  - Nenhum acesso a Repositories ou ao Pricing Engine.
 */
import { useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  BadgeCheck,
  Building2,
  Calculator,
  ClipboardList,
  ExternalLink,
  History,
  Info,
  Layers,
  Lightbulb,
  ListChecks,
  Package,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageLayout } from "@/components/layout";
import { formatCurrency, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/config/routes";
import {
  getCommercialDashboard,
  type CommercialDashboardDTO,
  type CommercialHealthDTO,
  type CommercialInsightDTO,
} from "@/features/pricing/lib/commercial-dashboard.functions";
import type { PolicyLayerName } from "@/features/pricing/resolver/types";

const cents = (v: number) => formatCurrency(v / 100);

const ORIGIN_ICON: Record<PolicyLayerName, typeof Package> = {
  product: Package,
  category: Layers,
  company: Building2,
  context: Target,
  system: Sparkles,
};

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  companyId: string;
}

export function CommercialDashboardWorkspace({ companyId }: Props) {
  const navigate = useNavigate();

  const query = useQuery<CommercialDashboardDTO>({
    queryKey: ["commercial-dashboard", companyId],
    enabled: Boolean(companyId),
    queryFn: () => getCommercialDashboard({ data: { companyId } }),
    staleTime: 60_000,
  });

  const dto = query.data;

  return (
    <PageLayout
      icon={TrendingUp}
      title="Dashboard Comercial"
      description="O que precisa da sua atenção hoje para elevar o lucro."
      meta={
        dto ? (
          <span className="text-xs text-muted-foreground">
            Atualizado {new Date(dto.kpis.lastUpdatedAt).toLocaleTimeString("pt-BR")}
          </span>
        ) : null
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to={ROUTES.commercialPolicy}>
              <BadgeCheck className="mr-1.5 h-4 w-4" /> Nova política
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link to={ROUTES.commercialSimulator}>
              <Calculator className="mr-1.5 h-4 w-4" /> Abrir simulador
            </Link>
          </Button>
        </div>
      }
    >
      {query.isLoading || !dto ? (
        <LoadingSkeleton />
      ) : query.isError ? (
        <ErrorPanel message={(query.error as Error)?.message ?? "Erro"} />
      ) : (
        <div className="space-y-6">
          <HealthAndKpis health={dto.health} kpis={dto.kpis} />
          <OpportunitiesSection items={dto.opportunities} />
          <div className="grid gap-6 lg:grid-cols-2">
            <PriorityProductsSection
              items={dto.priorityProducts}
              onOpen={(pid) => navigate({ to: "/produtos/$productId", params: { productId: pid } })}
            />
            <CategoriesSection items={dto.categories} />
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <RecentDecisionsSection items={dto.recentDecisions} />
            <InsightsSection items={dto.insights} />
          </div>
          <QuickActionsSection />
        </div>
      )}
    </PageLayout>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEÇÃO 1 + 2 — Saúde + KPIs (lado a lado em telas grandes)
// ─────────────────────────────────────────────────────────────────────────────

function HealthAndKpis({
  health,
  kpis,
}: {
  health: CommercialHealthDTO;
  kpis: CommercialDashboardDTO["kpis"];
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
      <HealthCard health={health} />
      <KpisGrid kpis={kpis} />
    </div>
  );
}

function HealthCard({ health }: { health: CommercialHealthDTO }) {
  const toneClass = {
    excellent: "text-success",
    very_good: "text-success",
    attention: "text-warning",
    critical: "text-destructive",
  }[health.level];

  return (
    <Card className="border-border/70">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Activity className={cn("h-4 w-4", toneClass)} />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Saúde Comercial
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-baseline gap-2">
          <span className={cn("text-2xl font-semibold tracking-tight", toneClass)}>
            {health.label}
          </span>
        </div>
        <div className="flex items-center gap-1" aria-label={`${health.stars} de 5 estrelas`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                "h-4 w-4",
                i < health.stars ? cn("fill-current", toneClass) : "text-muted-foreground/30",
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{health.summary}</p>
      </CardContent>
    </Card>
  );
}

function KpisGrid({ kpis }: { kpis: CommercialDashboardDTO["kpis"] }) {
  const items = [
    { label: "Produtos", value: kpis.productsTotal, icon: Package, tone: "text-primary" },
    {
      label: "Política própria",
      value: kpis.productsWithOwnPolicy,
      icon: BadgeCheck,
      tone: "text-success",
    },
    {
      label: "Herdando política",
      value: kpis.productsInheritingPolicy,
      icon: Layers,
      tone: "text-muted-foreground",
    },
    {
      label: "Abaixo da margem",
      value: kpis.productsBelowMargin,
      icon: AlertTriangle,
      tone: "text-destructive",
    },
    { label: "Sem custo", value: kpis.productsWithoutCost, icon: Info, tone: "text-warning" },
    { label: "Sem preço", value: kpis.productsWithoutPrice, icon: Info, tone: "text-warning" },
    {
      label: "Sugestão pendente",
      value: kpis.productsWithSuggestion,
      icon: TrendingUp,
      tone: "text-primary",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map(({ label, value, icon: Icon, tone }) => (
        <Card key={label} className="border-border/70">
          <CardContent className="flex items-start justify-between p-4">
            <div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
              <div className="mt-1 text-xl font-semibold tabular-nums">{formatNumber(value)}</div>
            </div>
            <Icon className={cn("h-4 w-4", tone)} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEÇÃO 3 — Oportunidades
// ─────────────────────────────────────────────────────────────────────────────

function OpportunitiesSection({ items }: { items: CommercialDashboardDTO["opportunities"] }) {
  return (
    <Card className="border-border/70">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
        <Lightbulb className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm font-medium">Oportunidades</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyLine>Nenhuma oportunidade identificada no momento.</EmptyLine>
        ) : (
          <ul className="divide-y divide-border/60">
            {items.map((op) => (
              <li
                key={op.kind}
                className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <Badge
                  variant="secondary"
                  className="h-6 min-w-[2.5rem] justify-center tabular-nums"
                >
                  {op.count}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{op.title}</div>
                  <div className="text-xs text-muted-foreground">{op.description}</div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={op.actionHref as never}>
                    {op.actionLabel}
                    <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEÇÃO 4 — Produtos Prioritários
// ─────────────────────────────────────────────────────────────────────────────

function PriorityProductsSection({
  items,
  onOpen,
}: {
  items: CommercialDashboardDTO["priorityProducts"];
  onOpen: (productId: string) => void;
}) {
  return (
    <Card className="border-border/70">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
        <Target className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm font-medium">Produtos prioritários</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {items.length === 0 ? (
          <div className="p-6">
            <EmptyLine>Nenhum produto requer ajuste no momento.</EmptyLine>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Atual</TableHead>
                  <TableHead className="text-right">Recomendado</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                  <TableHead className="text-right">Margem</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => {
                  const OriginIcon = ORIGIN_ICON[p.originLayer] ?? Sparkles;
                  const diffPositive = p.differenceCents >= 0;
                  return (
                    <TableRow key={p.productId}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.categoryName ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {cents(p.currentPriceCents)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {cents(p.recommendedPriceCents)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          diffPositive ? "text-success" : "text-destructive",
                        )}
                      >
                        <span className="inline-flex items-center gap-1">
                          {diffPositive ? (
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          ) : (
                            <ArrowDownRight className="h-3.5 w-3.5" />
                          )}
                          {cents(Math.abs(p.differenceCents))}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {p.marginPct.toFixed(1)}%
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1">
                          <OriginIcon className="h-3 w-3" />
                          {p.originLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => onOpen(p.productId)}>
                          Abrir
                          <ExternalLink className="ml-1 h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEÇÃO 5 — Categorias
// ─────────────────────────────────────────────────────────────────────────────

function CategoriesSection({ items }: { items: CommercialDashboardDTO["categories"] }) {
  const sorted = useMemo(
    () => [...items].sort((a, b) => b.productsCount - a.productsCount).slice(0, 8),
    [items],
  );
  return (
    <Card className="border-border/70">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
        <Layers className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm font-medium">Categorias</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {sorted.length === 0 ? (
          <div className="p-6">
            <EmptyLine>Sem categorias cadastradas.</EmptyLine>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Margem média</TableHead>
                  <TableHead className="text-right">Produtos</TableHead>
                  <TableHead>Estratégia</TableHead>
                  <TableHead className="text-right">Pendentes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c) => (
                  <TableRow key={c.categoryId}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {c.name}
                        {!c.hasOwnPolicy && (
                          <Badge variant="outline" className="text-[10px]">
                            herdada
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.productsCount > 0 ? `${c.averageMarginPct.toFixed(1)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(c.productsCount)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.strategyLabel}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.pendingProducts > 0 ? (
                        <span className="text-warning">{c.pendingProducts}</span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEÇÃO 6 — Últimas decisões
// ─────────────────────────────────────────────────────────────────────────────

function RecentDecisionsSection({ items }: { items: CommercialDashboardDTO["recentDecisions"] }) {
  return (
    <Card className="border-border/70">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
        <History className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm font-medium">Últimas decisões</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyLine>Nenhuma decisão registrada ainda.</EmptyLine>
        ) : (
          <ul className="space-y-3">
            {items.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border/60 p-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{d.productName ?? "Produto removido"}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {d.previousPriceCents != null && d.previousPriceCents > 0 ? (
                      <>
                        {cents(d.previousPriceCents)} →{" "}
                        <span className="font-medium text-foreground">
                          {cents(d.appliedPriceCents)}
                        </span>
                      </>
                    ) : (
                      <span className="font-medium text-foreground">
                        {cents(d.appliedPriceCents)}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                    <span>{new Date(d.createdAt).toLocaleString("pt-BR")}</span>
                    <span aria-hidden="true">•</span>
                    <span className="font-mono">{d.explainId.slice(0, 12)}…</span>
                  </div>
                </div>
                {d.productId && (
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/produtos/$productId" params={{ productId: d.productId }}>
                      Abrir
                      <ExternalLink className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEÇÃO 7 — Insights
// ─────────────────────────────────────────────────────────────────────────────

function InsightsSection({ items }: { items: readonly CommercialInsightDTO[] }) {
  return (
    <Card className="border-border/70">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm font-medium">Insights</CardTitle>
        <CardDescription className="ml-auto text-[11px]">derivados de dados atuais</CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyLine>Sem insights suficientes.</EmptyLine>
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li
                key={i.id}
                className={cn(
                  "flex items-start gap-2 rounded-md border p-3 text-sm",
                  i.tone === "positive" && "border-success/30 bg-success/5",
                  i.tone === "warning" && "border-warning/30 bg-warning/5",
                  i.tone === "neutral" && "border-border/60",
                )}
              >
                {i.tone === "positive" ? (
                  <BadgeCheck className="mt-0.5 h-4 w-4 text-success" />
                ) : i.tone === "warning" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 text-warning" />
                ) : (
                  <Info className="mt-0.5 h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-foreground/90">{i.text}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SEÇÃO 8 — Ações rápidas
// ─────────────────────────────────────────────────────────────────────────────

function QuickActionsSection() {
  const actions = [
    { label: "Nova Política", href: ROUTES.commercialPolicy, icon: BadgeCheck },
    { label: "Abrir Simulador", href: ROUTES.commercialSimulator, icon: Calculator },
    { label: "Produtos", href: ROUTES.products, icon: Package },
    { label: "Categorias", href: ROUTES.commercialCategories, icon: Layers },
  ] as const;
  return (
    <Card className="border-border/70">
      <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
        <ListChecks className="h-4 w-4 text-primary" />
        <CardTitle className="text-sm font-medium">Ações rápidas</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <Button key={a.label} asChild variant="outline" className="justify-start">
                <Link to={a.href as never}>
                  <Icon className="mr-2 h-4 w-4" />
                  {a.label}
                </Link>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Estados auxiliares
// ─────────────────────────────────────────────────────────────────────────────

function EmptyLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <ClipboardList className="h-4 w-4" />
      {children}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="h-40 animate-pulse rounded-md border border-border/70 bg-muted/40" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="h-20 animate-pulse rounded-md border border-border/70 bg-muted/40"
            />
          ))}
        </div>
      </div>
      <div className="h-48 animate-pulse rounded-md border border-border/70 bg-muted/40" />
    </div>
  );
}

function ErrorPanel({ message }: { message: string }) {
  return (
    <Card className="border-destructive/50">
      <CardContent className="flex items-start gap-3 p-4 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
        <div>
          <div className="font-medium">Não foi possível carregar o dashboard</div>
          <div className="text-muted-foreground">{message}</div>
        </div>
      </CardContent>
    </Card>
  );
}
