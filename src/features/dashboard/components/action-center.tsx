import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  FileClock,
  PackageMinus,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Section, StatusBadge } from "@/components/design";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  RADIUS_TOKENS,
  SPACING_TOKENS,
  TEXT_TOKENS,
  statusToken,
  type StatusToken,
} from "@/design";
import { ROUTES } from "@/config/routes";
import { useSaleMetrics, useSalesList } from "@/features/sales/hooks/use-sales";
import { useInventoryMetrics } from "@/features/inventory/hooks/use-inventory";
import { useFinanceOverview } from "@/features/finance/hooks/use-finance";
import { formatCurrency } from "@/lib/format";

type ActionTone = "danger" | "warning" | "info";

interface ActionItem {
  id: string;
  tone: ActionTone;
  icon: LucideIcon;
  title: string;
  detail: string;
  to: string;
  search?: Record<string, string>;
  cta?: string;
}


const TONE_STATUS: Record<ActionTone, StatusToken> = {
  danger: "danger",
  warning: "warning",
  info: "info",
};

const TONE_LABEL: Record<ActionTone, string> = {
  danger: "Urgente",
  warning: "Atenção",
  info: "Sugestão",
};

/**
 * Action Center — Fase 1 do NexOS 3.0.
 * Transforma o Dashboard em "O que preciso resolver hoje?".
 * Consome apenas dados já expostos pelos hooks/serviços existentes.
 */
export function ActionCenter({ companyId }: { companyId: string }) {
  const finance = useFinanceOverview(companyId);
  const inventory = useInventoryMetrics(companyId);
  const salesMetrics = useSaleMetrics(companyId);
  const drafts = useSalesList(companyId, {
    search: "",
    status: "draft",
    customerId: "",
    paymentStatus: "",
    paymentMethod: "",
    sortBy: "created_at",
    sortDir: "desc",
    page: 1,
    pageSize: 5,
  });

  const isLoading =
    finance.isLoading || inventory.isLoading || salesMetrics.isLoading || drafts.isLoading;

  const items: ActionItem[] = [];

  // Vendas em rascunho — abandonadas no checkout
  const draftCount = drafts.data?.total ?? 0;
  const draftRows = drafts.data?.rows ?? [];
  const singleDraftId = draftCount === 1 ? draftRows[0]?.id ?? null : null;
  if (draftCount > 0) {
    items.push({
      id: "drafts",
      tone: "warning",
      icon: FileClock,
      title: `${draftCount} venda${draftCount > 1 ? "s" : ""} em rascunho`,
      detail:
        singleDraftId
          ? "Finalize para não perder o faturamento do dia."
          : "Escolha um rascunho para finalizar.",
      to: singleDraftId ? `/vendas/${singleDraftId}/editar` : ROUTES.sales,
      cta: singleDraftId ? "Finalizar" : "Ver rascunhos",
    });
  }

  // Contas vencidas — apenas quando a data de vencimento for estritamente
  // anterior a HOJE (data local). Itens com vencimento HOJE são considerados
  // "a receber/pagar hoje", nunca vencidos.
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const isBeforeToday = (dateStr: string | null | undefined) =>
    !!dateStr && dateStr.slice(0, 10) < today;
  const overdueIncome = (finance.data?.upcomingIncome ?? []).filter((t) =>
    isBeforeToday(t.date),
  );
  const overdueExpense = (finance.data?.upcomingExpense ?? []).filter((t) =>
    isBeforeToday(t.date),
  );
  const overdueIncomeTotal = overdueIncome.reduce((s, t) => s + t.amount, 0);
  const overdueExpenseTotal = overdueExpense.reduce((s, t) => s + t.amount, 0);

  if (overdueIncome.length > 0) {
    items.push({
      id: "overdue-in",
      tone: "danger",
      icon: Wallet,
      title: `${overdueIncome.length} cobrança${
        overdueIncome.length > 1 ? "s" : ""
      } vencida${overdueIncome.length > 1 ? "s" : ""}`,
      detail: `${formatCurrency(overdueIncomeTotal)} a receber em atraso.`,
      to: ROUTES.finance,
      search: { tab: "receivables" },
      cta: "Cobrar agora",
    });
  }

  if (overdueExpense.length > 0) {
    items.push({
      id: "overdue-out",
      tone: "danger",
      icon: Wallet,
      title: `${overdueExpense.length} conta${
        overdueExpense.length > 1 ? "s" : ""
      } vencida${overdueExpense.length > 1 ? "s" : ""} a pagar`,
      detail: `${formatCurrency(overdueExpenseTotal)} em atraso.`,
      to: ROUTES.finance,
      search: { tab: "payables" },
      cta: "Ver contas",
    });
  }


  // Estoque abaixo do mínimo
  const belowMin = inventory.data?.belowMin ?? [];
  if (belowMin.length > 0) {
    items.push({
      id: "low-stock",
      tone: "warning",
      icon: PackageMinus,
      title: `${belowMin.length} produto${belowMin.length > 1 ? "s" : ""} abaixo do mínimo`,
      detail: "Reabasteça para não perder venda.",
      to: ROUTES.inventory,
      cta: "Repor estoque",
    });
  }

  // Produtos parados (Bella sugere campanha)
  const stagnant = inventory.data?.stagnant ?? [];
  if (stagnant.length > 0) {
    items.push({
      id: "stagnant",
      tone: "info",
      icon: Sparkles,
      title: `${stagnant.length} produto${stagnant.length > 1 ? "s" : ""} parado${
        stagnant.length > 1 ? "s" : ""
      } há 90 dias`,
      detail: "A Bella pode montar uma campanha para movimentar.",
      to: ROUTES.marketing,
      cta: "Criar campanha",
    });
  }

  // Nenhuma venda hoje
  if (!isLoading && (salesMetrics.data?.dayCount ?? 0) === 0 && draftCount === 0) {
    items.push({
      id: "no-sales",
      tone: "info",
      icon: Sparkles,
      title: "Nenhuma venda registrada hoje",
      detail: "Abra o PDV e faça sua primeira venda do dia.",
      to: ROUTES.sales,
      cta: "Abrir PDV",
    });
  }

  return (
    <Section
      title="Prioridades"
      description="Pendências, alertas e recomendações — com ação direta."
      density="comfortable"
      actions={
        <StatusBadge status={items.length > 0 ? "warning" : "success"} withDot>
          {items.length} {items.length === 1 ? "item" : "itens"}
        </StatusBadge>
      }
    >
      {isLoading ? (
        <div className={SPACING_TOKENS.compact.stack}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <span
            aria-hidden="true"
            className={cn(
              "grid h-10 w-10 place-items-center",
              RADIUS_TOKENS.lg,
              statusToken("success").soft,
            )}
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <p className={cn("mt-3 font-semibold", TEXT_TOKENS.base)}>Tudo em dia</p>
          <p className={cn("mt-1 text-muted-foreground", TEXT_TOKENS.sm)}>
            Nenhuma pendência exige sua atenção agora.
          </p>
          <Button size="sm" variant="outline" asChild className="mt-4">
            <Link to={ROUTES.marketing}>
              <Sparkles className="mr-1.5 h-4 w-4" /> Criar campanha
            </Link>
          </Button>
        </div>
      ) : (
        <ul className={SPACING_TOKENS.compact.stack}>
          {items.map((it) => {
            const Icon = it.icon;
            const token = statusToken(TONE_STATUS[it.tone]);
            return (
              <li
                key={it.id}
                data-testid="action-center-item"
                className={cn(
                  "flex flex-col gap-3 border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center",
                  RADIUS_TOKENS.lg,
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center",
                    RADIUS_TOKENS.lg,
                    token.soft,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className={cn("font-medium leading-tight", TEXT_TOKENS.sm)}>{it.title}</p>
                    <StatusBadge status={TONE_STATUS[it.tone]}>
                      {TONE_LABEL[it.tone]}
                    </StatusBadge>
                  </div>
                  <p className={cn("mt-0.5 truncate text-muted-foreground", TEXT_TOKENS.xs)}>
                    {it.detail}
                  </p>
                </div>
                <Button size="sm" asChild className="shrink-0">
                  <Link to={it.to} search={it.search as never}>
                    {it.cta ?? "Resolver"}
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
