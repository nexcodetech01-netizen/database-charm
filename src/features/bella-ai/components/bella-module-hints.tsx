import { useMemo } from "react";
import { BellaInlineSuggestion } from "./bella-inline-suggestion";
import { useInventoryMetrics } from "@/features/inventory/hooks/use-inventory";
import { useFinanceOverview } from "@/features/finance/hooks/use-finance";
import { useSalesList, useSaleMetrics } from "@/features/sales/hooks/use-sales";
import { usePurchaseMetrics } from "@/features/purchases/hooks/use-purchases";
import { useMarketingMetrics } from "@/features/marketing/hooks/use-marketing";
import { ROUTES } from "@/config/routes";
import { formatCurrency } from "@/lib/format";

/**
 * Hints da Bella IA — strips discretos que aparecem no topo dos módulos.
 *
 * Regras:
 *  - Não busca dados novos: reutiliza hooks já usados na página.
 *  - Cada sugestão termina em UMA ação real (rota do NexOS ou callback local).
 *  - Nunca renderiza mais de 2 sugestões simultâneas — evita ruído.
 *  - Silencioso quando não há nada relevante a dizer.
 */

function Stack({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>;
}

/* -------------------------------- PRODUTOS -------------------------------- */

export function ProductsBellaHints({ companyId }: { companyId: string }) {
  const { data } = useInventoryMetrics(companyId);
  const belowMin = data?.belowMin ?? [];
  const stagnant = data?.stagnant ?? [];

  const hints = useMemo(() => {
    const out: React.ReactNode[] = [];
    if (belowMin.length > 0) {
      const first = belowMin[0];
      const missing =
        first && typeof first.min_stock === "number" && typeof first.stock === "number"
          ? Math.max(0, first.min_stock - first.stock)
          : null;
      const singleTitle =
        belowMin.length === 1 && missing !== null
          ? `Faltam apenas ${missing} unidade${missing === 1 ? "" : "s"} de ${first?.name ?? "um produto"}`
          : `${belowMin.length} produto${belowMin.length > 1 ? "s" : ""} sem estoque suficiente`;
      out.push(
        <BellaInlineSuggestion
          key="low"
          tone="warning"
          title={singleTitle}
          message="Reabasteça agora para não perder venda."
          action={{ label: "Gerar pedido de compra", to: "/compras/novo" }}
        />,
      );
    }
    if (stagnant.length > 0) {
      out.push(
        <BellaInlineSuggestion
          key="stag"
          tone="info"
          title={`${stagnant.length} produto${stagnant.length > 1 ? "s" : ""} parado${stagnant.length > 1 ? "s" : ""} há 90 dias`}
          message="Este produto está parado. Posso ajudar."
          action={{ label: "Criar campanha", to: ROUTES.marketing }}
        />,
      );
    }
    return out.slice(0, 2);
  }, [belowMin, stagnant.length]);

  if (hints.length === 0) return null;
  return <Stack>{hints}</Stack>;
}

/* --------------------------------- VENDAS --------------------------------- */

export function SalesBellaHints({ companyId }: { companyId: string }) {
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
  const metrics = useSaleMetrics(companyId);

  const hints = useMemo(() => {
    const out: React.ReactNode[] = [];
    const draftCount = drafts.data?.total ?? 0;
    const draftRows = drafts.data?.rows ?? [];
    const firstDraftId = draftRows[0]?.id ?? null;
    if (draftCount > 0) {
      out.push(
        <BellaInlineSuggestion
          key="drafts"
          tone="warning"
          title={`${draftCount} venda${draftCount > 1 ? "s" : ""} em rascunho`}
          message="Finalize para faturar o dia."
          action={
            firstDraftId
              ? { label: "Finalizar", to: `/vendas/${firstDraftId}/editar` }
              : { label: "Finalizar", to: ROUTES.sales }
          }
        />,
      );
    }
    if (draftCount === 0 && (metrics.data?.dayCount ?? 0) === 0) {
      out.push(
        <BellaInlineSuggestion
          key="empty"
          tone="info"
          title="Nenhuma venda registrada hoje"
          message="Abra o PDV e faça a primeira venda em segundos."
          action={{ label: "Nova venda", to: "/vendas/novo" }}
        />,
      );
    }
    return out.slice(0, 2);
  }, [drafts.data?.total, drafts.data?.rows, metrics.data?.dayCount]);

  if (hints.length === 0) return null;
  return <Stack>{hints}</Stack>;
}

/* --------------------------------- COMPRAS -------------------------------- */

export function PurchasesBellaHints({ companyId }: { companyId: string }) {
  const inv = useInventoryMetrics(companyId);
  const pm = usePurchaseMetrics(companyId);
  const belowMin = inv.data?.belowMin ?? [];
  const pending = pm.data?.pending ?? 0;

  const hints = useMemo(() => {
    const out: React.ReactNode[] = [];
    if (belowMin.length > 0) {
      out.push(
        <BellaInlineSuggestion
          key="restock"
          tone="warning"
          title={`${belowMin.length} produto${belowMin.length > 1 ? "s" : ""} precisando repor`}
          message="Registre a compra e o estoque + custo médio se atualizam sozinhos."
          action={{ label: "Comprar", to: "/compras/novo" }}
        />,
      );
    }
    if (pending > 0) {
      out.push(
        <BellaInlineSuggestion
          key="pending"
          tone="info"
          title={`${pending} compra${pending > 1 ? "s" : ""} pendente${pending > 1 ? "s" : ""}`}
          message="Marque como recebida quando a mercadoria chegar."
          action={{ label: "Resolver", to: ROUTES.purchases }}
        />,
      );
    }
    return out.slice(0, 2);
  }, [belowMin.length, pending]);

  if (hints.length === 0) return null;
  return <Stack>{hints}</Stack>;
}

/* ------------------------------- FINANCEIRO ------------------------------- */

export function FinanceBellaHints({ companyId }: { companyId: string }) {
  const { data } = useFinanceOverview(companyId);

  const hints = useMemo(() => {
    const out: React.ReactNode[] = [];
    const today = new Date().toISOString().slice(0, 10);
    const overdueIn = (data?.upcomingIncome ?? []).filter((t) => t.date && t.date < today);
    const overdueOut = (data?.upcomingExpense ?? []).filter((t) => t.date && t.date < today);
    const overdueInTotal = overdueIn.reduce((s, t) => s + t.amount, 0);
    const overdueOutTotal = overdueOut.reduce((s, t) => s + t.amount, 0);

    if (overdueIn.length > 0) {
      out.push(
        <BellaInlineSuggestion
          key="in"
          tone="danger"
          title={`${overdueIn.length} cobrança${overdueIn.length > 1 ? "s" : ""} vencida${overdueIn.length > 1 ? "s" : ""}`}
          message={`${formatCurrency(overdueInTotal)} a receber em atraso.`}
          action={{ label: "Cobrar", to: ROUTES.finance }}
        />,
      );
    }
    if (overdueOut.length > 0) {
      out.push(
        <BellaInlineSuggestion
          key="out"
          tone="warning"
          title={`${overdueOut.length} conta${overdueOut.length > 1 ? "s" : ""} vencida${overdueOut.length > 1 ? "s" : ""} a pagar`}
          message={`${formatCurrency(overdueOutTotal)} em atraso.`}
          action={{ label: "Resolver", to: ROUTES.finance }}
        />,
      );
    }
    if (out.length === 0 && data && data.currentBalance < 0) {
      out.push(
        <BellaInlineSuggestion
          key="neg"
          tone="danger"
          title="Saldo consolidado negativo"
          message="Priorize cobranças em aberto para reequilibrar o caixa."
          action={{ label: "Cobrar", to: ROUTES.finance }}
        />,
      );
    }
    return out.slice(0, 2);
  }, [data]);

  if (hints.length === 0) return null;
  return <Stack>{hints}</Stack>;
}

/* ------------------------------- MARKETING -------------------------------- */

export function MarketingBellaHints({
  companyId,
  onNewCampaign,
}: {
  companyId: string;
  onNewCampaign?: () => void;
}) {
  const inv = useInventoryMetrics(companyId);
  const mk = useMarketingMetrics(companyId);
  const stagnant = inv.data?.stagnant ?? [];
  const active = mk.data?.activeCampaigns ?? 0;

  const hints = useMemo(() => {
    const out: React.ReactNode[] = [];
    if (stagnant.length > 0) {
      out.push(
        <BellaInlineSuggestion
          key="stag"
          tone="info"
          title={`${stagnant.length} produto${stagnant.length > 1 ? "s" : ""} sem giro há 90 dias`}
          message="Crie uma campanha de desencalhe com um clique."
          action={
            onNewCampaign
              ? { label: "Criar campanha", onClick: onNewCampaign }
              : { label: "Criar campanha", to: ROUTES.marketing }
          }
        />,
      );
    }
    if (active === 0) {
      out.push(
        <BellaInlineSuggestion
          key="none"
          tone="warning"
          title="Nenhuma campanha ativa"
          message="Comece por um público simples: clientes que compraram nos últimos 30 dias."
          action={
            onNewCampaign
              ? { label: "Criar campanha", onClick: onNewCampaign }
              : { label: "Criar campanha", to: ROUTES.marketing }
          }
        />,
      );
    }
    return out.slice(0, 2);
  }, [stagnant.length, active, onNewCampaign]);

  if (hints.length === 0) return null;
  return <Stack>{hints}</Stack>;
}
