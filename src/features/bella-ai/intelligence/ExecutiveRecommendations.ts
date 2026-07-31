/**
 * Recomendações derivadas de métricas + rows base.
 * Regras puras. Cada recomendação traz prioridade, motivo e ação sugerida.
 */
import type {
  ExecutiveMetrics,
  ExecutiveRecommendation,
  RawCustomerRow,
  RawProductRow,
  RawSaleRow,
} from "./types";

const num = (v: number | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

const DAY_MS = 24 * 60 * 60 * 1000;

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / DAY_MS);
}

export interface BuildRecommendationsInput {
  now: Date;
  metrics: ExecutiveMetrics;
  products: readonly RawProductRow[];
  sales: readonly RawSaleRow[];
  customers: readonly RawCustomerRow[];
}

export function buildRecommendations(
  input: BuildRecommendationsInput,
): ExecutiveRecommendation[] {
  const { now, metrics, products, sales, customers } = input;
  const out: ExecutiveRecommendation[] = [];

  // ---- 1. Reposição de produtos em estoque crítico com giro ------------
  // Contamos vendas dos últimos 30 dias por produto (necessita sale_items,
  // mas usamos apenas produtos com estoque crítico como sinal principal).
  const critical = products
    .filter((p) => num(p.min_stock) > 0 && num(p.stock) <= num(p.min_stock))
    .slice(0, 5);

  for (const p of critical) {
    out.push({
      id: `restock_${p.id}`,
      priority: num(p.stock) <= 0 ? "high" : "medium",
      title: `Repor ${p.name}`,
      reason:
        num(p.stock) <= 0
          ? "Produto zerado no estoque."
          : `Estoque em ${num(p.stock)} unidade(s), abaixo do mínimo (${num(p.min_stock)}).`,
      suggestedAction: "Registrar uma nova compra ou entrada de estoque.",
      targetRoute: `/produtos/${p.id}`,
    });
  }

  // ---- 2. Contas vencidas ----------------------------------------------
  if (metrics.overdue_bills_count > 0) {
    out.push({
      id: "overdue_bills",
      priority: metrics.overdue_bills_count >= 3 ? "high" : "medium",
      title: "Revisar contas vencidas",
      reason: `${metrics.overdue_bills_count} conta(s) vencida(s) somando R$ ${metrics.overdue_bills_amount.toFixed(2)}.`,
      suggestedAction: "Negociar prazos ou registrar o pagamento no financeiro.",
      targetRoute: "/financeiro",
    });
  }

  // ---- 3. Clientes inativos (>60 dias sem compra) ----------------------
  const lastPurchase = new Map<string, Date>();
  for (const s of sales) {
    const status = (s.status ?? "").toLowerCase();
    if (status === "cancelled" || status === "canceled" || status === "returned") continue;
    if (!s.customer_id) continue;
    const d = new Date(s.sale_date ?? s.created_at);
    const prev = lastPurchase.get(s.customer_id);
    if (!prev || d > prev) lastPurchase.set(s.customer_id, d);
  }

  let inactive = 0;
  for (const c of customers) {
    const last = lastPurchase.get(c.id);
    if (!last) continue; // nunca comprou — outro fluxo
    if (daysBetween(now, last) >= 60) inactive++;
  }
  if (inactive > 0) {
    out.push({
      id: "inactive_customers",
      priority: inactive >= 10 ? "high" : "medium",
      title: "Reativar clientes inativos",
      reason: `${inactive} cliente(s) sem compras há mais de 60 dias.`,
      suggestedAction: "Enviar campanha de reativação via WhatsApp Marketing.",
      targetRoute: "/marketing",
    });
  }

  // ---- 4. Margem baixa -------------------------------------------------
  if (metrics.margin_month_pct > 0 && metrics.margin_month_pct < 15) {
    out.push({
      id: "review_pricing",
      priority: "medium",
      title: "Revisar preços do catálogo",
      reason: `Margem do mês em ${metrics.margin_month_pct.toFixed(1)}% — abaixo do saudável (15%+).`,
      suggestedAction: "Rodar o Simulador de Precificação para reajustar categorias.",
      targetRoute: "/produtos",
    });
  }

  // ---- 5. Ticket médio muito baixo -------------------------------------
  if (metrics.avg_ticket_month > 0 && metrics.avg_ticket_month < 80) {
    out.push({
      id: "raise_ticket",
      priority: "low",
      title: "Aumentar o ticket médio",
      reason: `Ticket médio do mês: R$ ${metrics.avg_ticket_month.toFixed(2)}.`,
      suggestedAction: "Criar combos ou sugestões de venda cruzada no PDV.",
      targetRoute: "/vendas",
    });
  }

  return out;
}
