/**
 * Bella Contadora — Compras: seletores puros.
 *
 * Somente transformam dados JÁ apurados em um view model. NADA é
 * recalculado: totais, status e datas vêm de `purchasesService`
 * (`metrics` / `list`); produtos aguardando reposição e capital em estoque
 * vêm de `inventoryService.metrics`; saúde, insights e notificações vêm do
 * `AccountingSummary` / `Insights` / `Proactive` já existentes.
 */
import { buildAccountingInsights, sortInsights, type AccountingInsight } from "../insights";
import {
  buildBellaNotifications,
  sortNotifications,
  type BellaNotification,
  type NotificationCategory,
} from "../proactive";
import { healthLabel } from "../lib/health";
import type { AccountingSummary } from "../types";
import {
  purchaseOrderLink,
  purchaseProductLink,
  purchaseSupplierLink,
  purchasesLink,
  purchasesLinkForAction,
} from "./links";
import type {
  BellaPurchaseOrderLike,
  BellaPurchasesAlert,
  BellaPurchasesDetail,
  BellaPurchasesHealth,
  BellaPurchasesInput,
  BellaPurchasesMetric,
  BellaPurchasesOptions,
  BellaPurchasesRecommendation,
  BellaPurchasesView,
} from "./types";

/** Categorias consideradas de compras nos filtros do painel. */
export const PURCHASES_CATEGORIES: NotificationCategory[] = ["estoque", "produtos"];

const PURCHASES_CATEGORY_SET = new Set<string>(PURCHASES_CATEGORIES);

export function isPurchasesCategory(category: string): boolean {
  return PURCHASES_CATEGORY_SET.has(category);
}

export function filterPurchasesNotifications(
  notifications: readonly BellaNotification[],
): BellaNotification[] {
  return sortNotifications(notifications.filter((n) => isPurchasesCategory(n.category)));
}

export function filterPurchasesInsights(
  insights: readonly AccountingInsight[],
): AccountingInsight[] {
  return sortInsights(insights.filter((i) => isPurchasesCategory(i.category)));
}

const num = (value: number | null | undefined): number => Number(value ?? 0);

const PENDING_STATUS = new Set(["pending", "draft", "pendente", "rascunho"]);
const RECEIVED_STATUS = new Set(["received", "recebida", "recebido"]);
const CANCELLED_STATUS = new Set(["cancelled", "canceled", "cancelada", "cancelado"]);

const status = (order: BellaPurchaseOrderLike): string =>
  String(order.status ?? "").trim().toLowerCase();

/** Dia (YYYY-MM-DD) de uma data ISO já registrada — sem fuso derivado. */
export function purchaseDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

export interface PurchasesCounts {
  todayCount: number;
  todayTotal: number;
  pendingCount: number;
  pendingTotal: number;
  receivedCount: number;
  receivedTotal: number;
  lateCount: number;
  lateTotal: number;
  cancelledCount: number;
  totalCount: number;
  totalValue: number;
  averageOrder: number | null;
  supplierIds: string[];
}

/** Contagens simples sobre pedidos já persistidos pelo PurchaseService. */
export function countPurchases(
  orders: readonly BellaPurchaseOrderLike[] | null | undefined,
  options: BellaPurchasesOptions = {},
): PurchasesCounts {
  const rows = orders ?? [];
  const today = purchaseDay(options.now ?? new Date().toISOString());

  let todayCount = 0;
  let todayTotal = 0;
  let pendingCount = 0;
  let pendingTotal = 0;
  let receivedCount = 0;
  let receivedTotal = 0;
  let lateCount = 0;
  let lateTotal = 0;
  let cancelledCount = 0;
  let totalValue = 0;
  const supplierIds = new Set<string>();

  for (const order of rows) {
    const st = status(order);
    const total = num(order.grand_total);
    const day = purchaseDay(order.purchase_date);

    if (CANCELLED_STATUS.has(st)) {
      cancelledCount += 1;
      continue;
    }

    totalValue += total;
    if (order.supplier_id) supplierIds.add(order.supplier_id);
    if (today && day === today) {
      todayCount += 1;
      todayTotal += total;
    }
    if (PENDING_STATUS.has(st)) {
      pendingCount += 1;
      pendingTotal += total;
      const expected = purchaseDay(order.expected_delivery_date);
      if (today && expected && expected < today) {
        lateCount += 1;
        lateTotal += total;
      }
    }
    if (RECEIVED_STATUS.has(st)) {
      receivedCount += 1;
      receivedTotal += total;
    }
  }

  const totalCount = rows.length - cancelledCount;

  return {
    todayCount,
    todayTotal,
    pendingCount,
    pendingTotal,
    receivedCount,
    receivedTotal,
    lateCount,
    lateTotal,
    cancelledCount,
    totalCount,
    totalValue,
    averageOrder: totalCount > 0 ? totalValue / totalCount : null,
    supplierIds: Array.from(supplierIds),
  };
}

function money(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

/** Formata um indicador de compras para exibição. */
export function formatPurchasesMetric(metric: BellaPurchasesMetric): string {
  if (!metric.available || metric.value === null) return "—";
  if (metric.format === "currency") return money(metric.value);
  return metric.value.toLocaleString("pt-BR");
}

/** Maior pedido já registrado no conjunto lido (sem recálculo de valores). */
export function biggestPurchase(
  orders: readonly BellaPurchaseOrderLike[] | null | undefined,
): BellaPurchaseOrderLike | null {
  let best: BellaPurchaseOrderLike | null = null;
  for (const order of orders ?? []) {
    if (CANCELLED_STATUS.has(status(order))) continue;
    if (!best || num(order.grand_total) > num(best.grand_total)) best = order;
  }
  return best;
}

/** Pedido mais recente por data de compra (dados já persistidos). */
export function latestPurchase(
  orders: readonly BellaPurchaseOrderLike[] | null | undefined,
): BellaPurchaseOrderLike | null {
  let latest: BellaPurchaseOrderLike | null = null;
  for (const order of orders ?? []) {
    if (CANCELLED_STATUS.has(status(order))) continue;
    const day = purchaseDay(order.purchase_date);
    if (!day) continue;
    const current = purchaseDay(latest?.purchase_date);
    if (!latest || !current || day > current) latest = order;
  }
  return latest;
}

/** Fornecedor com maior valor comprado no conjunto lido. */
export function topSupplier(
  orders: readonly BellaPurchaseOrderLike[] | null | undefined,
): { id: string | null; name: string; total: number; count: number } | null {
  const map = new Map<string, { id: string | null; name: string; total: number; count: number }>();
  for (const order of orders ?? []) {
    if (CANCELLED_STATUS.has(status(order))) continue;
    const key = order.supplier_id ?? order.supplier_name ?? "";
    if (!key) continue;
    const entry = map.get(key) ?? {
      id: order.supplier_id ?? null,
      name: order.supplier_name ?? "Fornecedor",
      total: 0,
      count: 0,
    };
    entry.total += num(order.grand_total);
    entry.count += 1;
    map.set(key, entry);
  }
  let best: { id: string | null; name: string; total: number; count: number } | null = null;
  for (const entry of map.values()) {
    if (!best || entry.total > best.total) best = entry;
  }
  return best;
}

/** Fornecedores cadastrados que não aparecem em nenhum pedido lido. */
export function suppliersWithoutOrders(
  input: BellaPurchasesInput,
): { id: string; name: string }[] {
  const suppliers = input.suppliers ?? [];
  const used = new Set(countPurchases(input.orders).supplierIds);
  return suppliers.filter((s) => !used.has(s.id)).map((s) => ({ id: s.id, name: s.name }));
}

/** Indicadores de compras — leitura direta de dados já apurados. */
export function buildPurchasesMetrics(
  input: BellaPurchasesInput,
  options: BellaPurchasesOptions = {},
): BellaPurchasesMetric[] {
  const orders = input.orders ?? null;
  const hasOrders = Boolean(orders);
  const c = countPurchases(orders, options);
  const metrics = input.metrics ?? null;
  const inventory = input.inventory ?? null;
  const suppliers = input.suppliers ?? null;
  const inactive = suppliers ? suppliersWithoutOrders(input).length : null;

  return [
    {
      id: "compras_hoje",
      label: "Compras hoje",
      value: hasOrders ? c.todayTotal : null,
      available: hasOrders,
      format: "currency",
      hint: hasOrders ? `${c.todayCount} pedido(s) no dia` : undefined,
      link: purchasesLink("abrir_compras"),
    },
    {
      id: "compras_mes",
      label: "Compras do mês",
      value: metrics ? num(metrics.monthTotal) : null,
      available: Boolean(metrics),
      format: "currency",
      hint: metrics ? `${num(metrics.monthCount)} pedido(s) no mês` : undefined,
      link: purchasesLink("abrir_relatorios"),
    },
    {
      id: "pedidos_pendentes",
      label: "Pedidos pendentes",
      value: metrics ? num(metrics.pending) : hasOrders ? c.pendingCount : null,
      available: Boolean(metrics) || hasOrders,
      format: "count",
      hint: "Aguardando recebimento",
      link: purchasesLink("abrir_compras"),
    },
    {
      id: "pedidos_recebidos",
      label: "Pedidos recebidos",
      value: hasOrders ? c.receivedCount : null,
      available: hasOrders,
      format: "count",
      hint: "Entradas já aplicadas ao estoque",
      link: purchasesLink("ver_movimentacoes"),
    },
    {
      id: "pedidos_atrasados",
      label: "Pedidos atrasados",
      value: hasOrders ? c.lateCount : null,
      available: hasOrders,
      format: "count",
      hint: "Previsão de entrega vencida",
      link: purchasesLink("abrir_compras"),
    },
    {
      id: "fornecedores_ativos",
      label: "Fornecedores ativos",
      value: metrics ? num(metrics.activeSuppliers) : hasOrders ? c.supplierIds.length : null,
      available: Boolean(metrics) || hasOrders,
      format: "count",
      hint: "Com pedido registrado",
      link: purchasesLink("abrir_fornecedores"),
    },
    {
      id: "fornecedores_inativos",
      label: "Fornecedores inativos",
      value: inactive,
      available: inactive !== null,
      format: "count",
      hint: "Cadastrados sem pedido no período",
      link: purchasesLink("abrir_fornecedores"),
    },
    {
      id: "aguardando_reposicao",
      label: "Aguardando reposição",
      value: inventory ? inventory.belowMin.length : null,
      available: Boolean(inventory),
      format: "count",
      hint: "Produtos abaixo do mínimo",
      link: purchasesLink("abrir_estoque"),
    },
  ];
}

/** Detalhes de compras (maior pedido, último pedido, fornecedor, reposição). */
export function buildPurchasesDetails(
  input: BellaPurchasesInput,
): BellaPurchasesDetail[] {
  const orders = input.orders ?? null;
  const biggest = biggestPurchase(orders);
  const latest = latestPurchase(orders);
  const supplier = topSupplier(orders);
  const urgent = (input.inventory?.belowMin ?? [])[0] ?? null;

  return [
    {
      id: "maior_compra",
      label: "Maior compra",
      value: biggest ? money(num(biggest.grand_total)) : null,
      available: Boolean(biggest),
      hint: biggest?.number ? `Pedido ${biggest.number}` : undefined,
      link: biggest ? purchaseOrderLink(biggest.id) : purchasesLink("abrir_compras"),
    },
    {
      id: "ultima_compra",
      label: "Última compra",
      value: latest ? money(num(latest.grand_total)) : null,
      available: Boolean(latest),
      hint: latest ? (purchaseDay(latest.purchase_date) ?? undefined) : undefined,
      link: latest ? purchaseOrderLink(latest.id) : purchasesLink("abrir_compras"),
    },
    {
      id: "fornecedor_principal",
      label: "Fornecedor principal",
      value: supplier ? supplier.name : null,
      available: Boolean(supplier),
      hint: supplier ? `${money(supplier.total)} · ${supplier.count} pedido(s)` : undefined,
      link: supplier?.id
        ? purchaseSupplierLink(supplier.id)
        : purchasesLink("abrir_fornecedores"),
    },
    {
      id: "reposicao_urgente",
      label: "Reposição urgente",
      value: urgent ? urgent.name : null,
      available: Boolean(urgent),
      hint: urgent
        ? `Saldo ${num(urgent.stock).toLocaleString("pt-BR")} · mínimo ${num(
            urgent.min_stock,
          ).toLocaleString("pt-BR")}`
        : undefined,
      link: urgent ? purchaseProductLink(urgent.id) : purchasesLink("abrir_estoque"),
    },
  ];
}

/**
 * Alertas de compras — derivados de estados que Compras/Estoque já
 * registraram, somados às notificações proativas de categoria compatível.
 */
export function buildPurchasesAlerts(
  input: BellaPurchasesInput,
  options: BellaPurchasesOptions = {},
): BellaPurchasesAlert[] {
  const alerts: BellaPurchasesAlert[] = [];
  const orders = input.orders ?? null;
  const c = countPurchases(orders, options);
  const inventory = input.inventory ?? null;
  const suppliers = input.suppliers ?? null;
  const biggest = biggestPurchase(orders);
  const aboveFactor = options.aboveAverageFactor ?? 2;
  const capitalLimit = options.capitalRatioLimit ?? 0.5;

  if (orders && c.lateCount > 0) {
    alerts.push({
      id: "pedidos_atrasados",
      severity: "critical",
      title: "Pedidos atrasados",
      message: `${c.lateCount} pedido(s) com previsão de entrega vencida (${money(c.lateTotal)}).`,
      recommendation: "Cobre o fornecedor ou atualize a previsão de entrega do pedido.",
      source: "purchases",
      link: purchasesLink("abrir_compras"),
    });
  }

  if (inventory && inventory.belowMin.length > 0) {
    alerts.push({
      id: "produtos_sem_reposicao",
      severity: "warning",
      title: "Produtos aguardando reposição",
      message: `${inventory.belowMin.length} produto(s) abaixo do estoque mínimo.`,
      recommendation: "Abra um pedido de compra para os itens críticos antes da ruptura.",
      source: "purchases",
      link: purchasesLink("abrir_estoque"),
    });
  }

  const first = inventory?.belowMin[0] ?? null;
  if (first && num(first.stock) <= 0) {
    alerts.push({
      id: "reposicao_urgente",
      severity: "critical",
      title: "Reposição urgente",
      message: `"${first.name}" está sem saldo em estoque.`,
      recommendation: "Priorize a compra desse item — a venda já pode estar bloqueada.",
      source: "purchases",
      link: purchaseProductLink(first.id),
    });
  }

  if (suppliers && suppliers.length === 0) {
    alerts.push({
      id: "fornecedor_inativo",
      severity: "warning",
      title: "Nenhum fornecedor ativo",
      message: "Não há fornecedor ativo cadastrado para registrar compras.",
      recommendation: "Cadastre ou reative um fornecedor antes de lançar pedidos.",
      source: "purchases",
      link: purchasesLink("abrir_fornecedores"),
    });
  }

  const idle = suppliers ? suppliersWithoutOrders(input) : [];
  if (idle.length > 0) {
    alerts.push({
      id: "fornecedor_sem_pedidos",
      severity: "info",
      title: "Fornecedores sem pedidos",
      message: `${idle.length} fornecedor(es) cadastrados sem pedido no período.`,
      recommendation: "Renegocie prazos e preços com quem está parado antes de comprar mais caro.",
      source: "purchases",
      link: purchasesLink("abrir_fornecedores"),
    });
  }

  if (biggest && c.averageOrder !== null && c.averageOrder > 0) {
    const total = num(biggest.grand_total);
    if (total > c.averageOrder * aboveFactor) {
      alerts.push({
        id: "compra_acima_da_media",
        severity: "info",
        title: "Compra acima da média",
        message: `Pedido ${biggest.number ?? ""} de ${money(total)} contra média de ${money(
          c.averageOrder,
        )}.`.replace(/\s+/g, " "),
        recommendation: "Confira condições, prazo e rateio de custos desse pedido.",
        source: "purchases",
        link: purchaseOrderLink(biggest.id),
      });
    }
  }

  const inventoryValue = num(inventory?.inventoryValue);
  if (orders && inventoryValue > 0 && c.pendingTotal > inventoryValue * capitalLimit) {
    alerts.push({
      id: "capital_elevado_compras",
      severity: "warning",
      title: "Capital elevado em compras",
      message: `${money(c.pendingTotal)} comprometidos em pedidos ainda não recebidos.`,
      recommendation: "Escalone os pedidos para não travar o caixa em estoque parado.",
      source: "purchases",
      link: purchasesLink("abrir_compras"),
    });
  }

  if (orders && c.pendingCount > 0) {
    alerts.push({
      id: "aguardando_recebimento",
      severity: "info",
      title: "Pedidos aguardando recebimento",
      message: `${c.pendingCount} pedido(s) pendentes (${money(c.pendingTotal)}).`,
      recommendation: "Dê baixa no recebimento para o estoque e o custo médio ficarem corretos.",
      source: "purchases",
      link: purchasesLink("abrir_compras"),
    });
  }

  const proactive = filterPurchasesNotifications(input.notifications ?? []).map<
    BellaPurchasesAlert
  >((n) => ({
    id: n.id,
    severity:
      n.severity === "critical" ? "critical" : n.severity === "warning" ? "warning" : "info",
    title: n.title,
    message: n.message,
    recommendation: n.recommendation,
    source: "proactive",
    link: purchasesLinkForAction(n.action),
  }));

  const order = { critical: 0, warning: 1, info: 2 } as const;
  return [...alerts, ...proactive]
    .sort((a, b) => order[a.severity] - order[b.severity])
    .slice(0, Math.max(0, options.alertLimit ?? 6));
}

export function buildPurchasesRecommendations(
  insights: readonly AccountingInsight[],
  limit = 5,
): BellaPurchasesRecommendation[] {
  return filterPurchasesInsights(insights)
    .slice(0, Math.max(0, limit))
    .map((insight) => ({
      id: insight.id,
      title: insight.title,
      description: insight.description,
      recommendation: insight.recommendation,
      severity: insight.severity,
      category: insight.category,
      priority: insight.priority,
      link: purchasesLinkForAction(insight.action),
    }));
}

export function buildPurchasesHealth(
  summary: AccountingSummary | null | undefined,
): BellaPurchasesHealth | null {
  const health = summary?.health.available ? summary.health.data : null;
  if (!health) return null;
  return {
    level: health.level,
    score: health.score,
    label: healthLabel(health),
    reasons: health.warnings ?? [],
  };
}

/** View model completo do painel "Bella Compras". */
export function buildBellaPurchasesView(
  input: BellaPurchasesInput,
  options: BellaPurchasesOptions = {},
): BellaPurchasesView {
  const now = options.now ?? new Date().toISOString();
  const summary = input.summary ?? null;
  const generatedAt = options.now ?? summary?.generatedAt ?? now;

  const insights = input.insights ?? (summary ? buildAccountingInsights(summary) : []);
  const notifications =
    input.notifications ?? (summary ? buildBellaNotifications({ summary, insights }) : []);

  const missing: string[] = [];
  if (!input.orders) missing.push("pedidos de compra");
  if (!input.metrics) missing.push("métricas de compras");
  if (!input.inventory) missing.push("métricas de estoque");
  if (!summary) missing.push("resumo contábil");

  return {
    available: Boolean(input.orders || input.metrics || input.inventory || summary),
    generatedAt,
    metrics: buildPurchasesMetrics(input, { ...options, now }),
    details: buildPurchasesDetails(input),
    health: buildPurchasesHealth(summary),
    alerts: buildPurchasesAlerts({ ...input, insights, notifications }, { ...options, now }),
    recommendations: buildPurchasesRecommendations(insights, options.recommendationLimit ?? 5),
    missing,
  };
}
