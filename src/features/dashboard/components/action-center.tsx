import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  FileClock,
  PackageMinus,
  Sparkles,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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


const TONE_BADGE: Record<ActionTone, string> = {
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
  info: "border-primary/30 bg-primary/10 text-primary",
};

const TONE_ICON: Record<ActionTone, string> = {
  danger: "bg-destructive/15 text-destructive",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  info: "bg-primary/15 text-primary",
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
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">O que preciso resolver hoje</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Pendências, alertas e recomendações — tudo com ação direta.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {items.length} {items.length === 1 ? "item" : "itens"}
        </Badge>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-muted/30" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="text-3xl" aria-hidden>🎉</div>
            <p className="mt-3 text-base font-semibold">Parabéns!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sua empresa está organizada.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">
              Bella encontrou apenas uma oportunidade:
            </p>
            <Link
              to={ROUTES.marketing}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              <Sparkles className="h-3 w-3" /> Criar campanha
            </Link>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <li
                  key={it.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center"
                >
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${TONE_ICON[it.tone]}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium leading-tight">{it.title}</p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] uppercase tracking-wider ${TONE_BADGE[it.tone]}`}
                      >
                        {TONE_LABEL[it.tone]}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{it.detail}</p>
                  </div>
                  <Link
                    to={it.to}
                    search={it.search as never}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition hover:bg-primary/90"
                  >
                    {it.cta ?? "Resolver agora"}
                    <ArrowRight className="h-3 w-3" />
                  </Link>

                </li>
              );
            })}
          </ul>
        )}

        {!isLoading && items.length > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-dashed border-border bg-muted/20 p-2.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <p className="text-[11px] text-muted-foreground">
              A Bella IA atualiza esta lista automaticamente conforme seu negócio movimenta.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
