/**
 * Bella Contadora — CRM: seletores puros.
 *
 * Somente transformam dados JÁ apurados em um view model. NADA é
 * recalculado: contagens de base, novos e inativos vêm de
 * `customersService.metrics`; recorrência, inatividade no período e ranking
 * vêm de `reportsService.customers`; ticket, faturamento, tendências e saúde
 * vêm do `AccountingSummary`; alertas proativos vêm do `Proactive`;
 * recomendações vêm dos `Insights`.
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
  crmCustomerHistoryLink,
  crmCustomerLink,
  crmLink,
  crmLinkForAction,
  crmSaleLink,
} from "./links";
import type {
  BellaCrmAlert,
  BellaCrmCustomerLike,
  BellaCrmDetail,
  BellaCrmHealth,
  BellaCrmInput,
  BellaCrmMetric,
  BellaCrmOptions,
  BellaCrmRecommendation,
  BellaCrmSaleLike,
  BellaCrmView,
} from "./types";

/** Categorias consideradas de relacionamento nos filtros do painel. */
export const CRM_CATEGORIES: NotificationCategory[] = ["clientes", "receita"];

const CRM_CATEGORY_SET = new Set<string>(CRM_CATEGORIES);

export function isCrmCategory(category: string): boolean {
  return CRM_CATEGORY_SET.has(category);
}

export function filterCrmNotifications(
  notifications: readonly BellaNotification[],
): BellaNotification[] {
  return sortNotifications(notifications.filter((n) => isCrmCategory(n.category)));
}

export function filterCrmInsights(
  insights: readonly AccountingInsight[],
): AccountingInsight[] {
  return sortInsights(insights.filter((i) => isCrmCategory(i.category)));
}

const num = (value: number | null | undefined): number => Number(value ?? 0);

const CANCELLED_STATUS = new Set(["cancelled", "canceled", "cancelada", "cancelado"]);

/** Dia (YYYY-MM-DD) de uma data já registrada — sem fuso derivado. */
export function crmDay(value: string | null | undefined): string | null {
  if (!value) return null;
  const day = String(value).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function money(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });
}

/** Formata um indicador de CRM para exibição. */
export function formatCrmMetric(metric: BellaCrmMetric): string {
  if (!metric.available || metric.value === null) return "—";
  if (metric.format === "currency") return money(metric.value);
  if (metric.format === "percent") {
    return `${(metric.value * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  }
  return metric.value.toLocaleString("pt-BR");
}

export interface CrmCounts {
  total: number;
  active: number;
  newCustomers: number;
  recurring: number;
  inactive: number;
  inactive90: number;
  withoutPurchases: number;
  recoverable: number;
  recurringRatio: number | null;
  topRevenue: number;
  hasBase: boolean;
}

/**
 * Contagens de relacionamento — leitura direta dos números já apurados por
 * `customersService.metrics` e `reportsService.customers`.
 */
export function countCrm(input: BellaCrmInput): CrmCounts {
  const metrics = input.metrics ?? null;
  const report = input.report ?? null;
  const snapshot = input.summary?.customers.available ? input.summary.customers.data : null;

  const total = report ? num(report.metrics.total) : metrics ? num(metrics.total) : num(snapshot?.total);
  const active = report
    ? num(report.metrics.active)
    : metrics
      ? num(metrics.active)
      : num(snapshot?.active);
  const newCustomers = report
    ? num(report.metrics.newInRange)
    : metrics
      ? num(metrics.newThisMonth)
      : num(snapshot?.newInRange);
  const recurring = report ? num(report.metrics.recurring) : num(snapshot?.recurring);
  const inactive = report ? num(report.metrics.inactive) : num(metrics?.inactive90);
  const inactive90 = num(metrics?.inactive90);
  const topRevenue = (report?.topCustomers ?? snapshot?.topCustomers ?? []).reduce(
    (acc, c) => acc + num(c.revenue),
    0,
  );

  return {
    total,
    active,
    newCustomers,
    recurring,
    inactive,
    inactive90,
    withoutPurchases: Math.max(0, total - active),
    recoverable: inactive,
    recurringRatio: active > 0 ? recurring / active : null,
    topRevenue,
    hasBase: Boolean(report || metrics || snapshot),
  };
}

/** Cliente com mais compras no ranking já apurado. */
export function topBuyer(input: BellaCrmInput) {
  const rows = input.report?.topCustomers ?? input.summary?.customers.data?.topCustomers ?? [];
  let best: { id: string; name: string; purchases: number; revenue: number } | null = null;
  for (const row of rows) {
    if (!best || num(row.purchases) > num(best.purchases)) best = { ...row };
  }
  return best;
}

/** Cliente com maior faturamento no ranking já apurado. */
export function topRevenueCustomer(input: BellaCrmInput) {
  const rows = input.report?.topCustomers ?? input.summary?.customers.data?.topCustomers ?? [];
  let best: { id: string; name: string; purchases: number; revenue: number } | null = null;
  for (const row of rows) {
    if (!best || num(row.revenue) > num(best.revenue)) best = { ...row };
  }
  return best;
}

/** Cliente com maior ticket (faturamento ÷ compras, ambos já apurados). */
export function topTicketCustomer(input: BellaCrmInput) {
  const rows = input.report?.topCustomers ?? input.summary?.customers.data?.topCustomers ?? [];
  let best: { id: string; name: string; ticket: number } | null = null;
  for (const row of rows) {
    const purchases = num(row.purchases);
    if (purchases <= 0) continue;
    const ticket = num(row.revenue) / purchases;
    if (!best || ticket > best.ticket) best = { id: row.id, name: row.name, ticket };
  }
  return best;
}

/** Último cliente cadastrado dentro da lista já lida. */
export function latestCustomer(
  customers: readonly BellaCrmCustomerLike[] | null | undefined,
): BellaCrmCustomerLike | null {
  let latest: BellaCrmCustomerLike | null = null;
  for (const customer of customers ?? []) {
    const day = crmDay(customer.created_at);
    if (!day) continue;
    const current = crmDay(latest?.created_at);
    if (!latest || !current || day > current) latest = customer;
  }
  return latest;
}

/** Última venda associada a um cliente dentro da lista já lida. */
export function latestCustomerSale(
  sales: readonly BellaCrmSaleLike[] | null | undefined,
): BellaCrmSaleLike | null {
  let latest: BellaCrmSaleLike | null = null;
  for (const sale of sales ?? []) {
    if (CANCELLED_STATUS.has(String(sale.status ?? "").trim().toLowerCase())) continue;
    if (!sale.customer_id && !sale.customer_name) continue;
    const day = crmDay(sale.sale_date);
    if (!day) continue;
    const current = crmDay(latest?.sale_date);
    if (!latest || !current || day > current) latest = sale;
  }
  return latest;
}

/** Clientes sem contato há mais do que o limite configurado. */
export function customersWithoutContact(
  customers: readonly BellaCrmCustomerLike[] | null | undefined,
  options: BellaCrmOptions = {},
): BellaCrmCustomerLike[] {
  const rows = customers ?? [];
  const days = options.noContactDays ?? 60;
  const nowMs = Date.parse(options.now ?? new Date().toISOString());
  if (!Number.isFinite(nowMs)) return [];
  const limit = nowMs - days * 24 * 60 * 60 * 1000;

  return rows.filter((customer) => {
    const ref = customer.last_interaction_at ?? customer.created_at;
    const ms = ref ? Date.parse(ref) : NaN;
    return Number.isFinite(ms) && ms < limit;
  });
}

/** Indicadores de CRM — leitura direta de dados já apurados. */
export function buildCrmMetrics(
  input: BellaCrmInput,
  _options: BellaCrmOptions = {},
): BellaCrmMetric[] {
  const c = countCrm(input);
  const has = c.hasBase;
  const summary = input.summary ?? null;
  const ticket = summary?.ticket.available ? summary.ticket.data : null;
  const hasReport = Boolean(input.report);
  const hasRanking = Boolean(
    input.report?.topCustomers ?? summary?.customers.data?.topCustomers,
  );

  return [
    {
      id: "clientes_ativos",
      label: "Clientes ativos",
      value: has ? c.active : null,
      available: has,
      format: "count",
      hint: "Compraram no período",
      link: crmLink("abrir_clientes"),
    },
    {
      id: "clientes_novos",
      label: "Clientes novos",
      value: has ? c.newCustomers : null,
      available: has,
      format: "count",
      hint: "Cadastrados no período",
      link: crmLink("abrir_clientes"),
    },
    {
      id: "clientes_inativos",
      label: "Clientes inativos",
      value: has ? c.inactive : null,
      available: has,
      format: "count",
      hint: "Sem compra no período",
      link: crmLink("abrir_crm"),
    },
    {
      id: "clientes_recorrentes",
      label: "Clientes recorrentes",
      value: hasReport || summary?.customers.available ? c.recurring : null,
      available: hasReport || Boolean(summary?.customers.available),
      format: "count",
      hint: "Mais de uma compra",
      link: crmLink("abrir_relatorios"),
    },
    {
      id: "clientes_sem_compras",
      label: "Clientes sem compras",
      value: has ? c.withoutPurchases : null,
      available: has,
      format: "count",
      hint: "Base cadastrada que ainda não comprou",
      link: crmLink("abrir_clientes"),
    },
    {
      id: "clientes_recuperaveis",
      label: "Clientes recuperáveis",
      value: has ? c.recoverable : null,
      available: has,
      format: "count",
      hint: "Já compraram e estão parados",
      link: crmLink("abrir_crm"),
    },
    {
      id: "ticket_medio",
      label: "Ticket médio",
      value: ticket ? ticket.averageTicket : null,
      available: Boolean(ticket),
      format: "currency",
      hint: "Apurado pelo módulo contábil",
      link: crmLink("abrir_relatorios"),
    },
    {
      id: "faturamento_clientes",
      label: "Faturamento dos clientes",
      value: hasRanking ? c.topRevenue : null,
      available: hasRanking,
      format: "currency",
      hint: "Soma do ranking de clientes",
      link: crmLink("abrir_ranking"),
    },
  ];
}

/** Detalhes de CRM (maior comprador, faturamento, ticket, últimos registros). */
export function buildCrmDetails(input: BellaCrmInput): BellaCrmDetail[] {
  const buyer = topBuyer(input);
  const revenue = topRevenueCustomer(input);
  const ticket = topTicketCustomer(input);
  const customer = latestCustomer(input.customers);
  const sale = latestCustomerSale(input.sales);

  return [
    {
      id: "maior_comprador",
      label: "Maior comprador",
      value: buyer ? buyer.name : null,
      available: Boolean(buyer),
      hint: buyer ? `${num(buyer.purchases).toLocaleString("pt-BR")} compra(s)` : undefined,
      link: buyer ? crmCustomerLink(buyer.id) : crmLink("abrir_clientes"),
    },
    {
      id: "maior_faturamento",
      label: "Maior faturamento",
      value: revenue ? revenue.name : null,
      available: Boolean(revenue),
      hint: revenue ? money(num(revenue.revenue)) : undefined,
      link: revenue ? crmCustomerLink(revenue.id) : crmLink("abrir_ranking"),
    },
    {
      id: "maior_ticket",
      label: "Maior ticket",
      value: ticket ? ticket.name : null,
      available: Boolean(ticket),
      hint: ticket ? money(ticket.ticket) : undefined,
      link: ticket ? crmCustomerHistoryLink(ticket.id) : crmLink("abrir_relatorios"),
    },
    {
      id: "ultimo_cliente",
      label: "Último cliente cadastrado",
      value: customer ? customer.name : null,
      available: Boolean(customer),
      hint: customer ? (crmDay(customer.created_at) ?? undefined) : undefined,
      link: customer ? crmCustomerLink(customer.id) : crmLink("abrir_clientes"),
    },
    {
      id: "ultima_venda",
      label: "Última venda para cliente",
      value: sale ? money(num(sale.grand_total)) : null,
      available: Boolean(sale),
      hint: sale ? (sale.customer_name ?? crmDay(sale.sale_date) ?? undefined) : undefined,
      link: sale ? crmSaleLink(sale.id) : crmLink("abrir_vendas"),
    },
  ];
}

/**
 * Alertas de CRM — derivados de estados que Clientes/Relatórios/Contábil já
 * registraram, somados às notificações proativas de categoria compatível.
 */
export function buildCrmAlerts(
  input: BellaCrmInput,
  options: BellaCrmOptions = {},
): BellaCrmAlert[] {
  const alerts: BellaCrmAlert[] = [];
  const c = countCrm(input);
  const summary = input.summary ?? null;
  const trends = summary?.trends.available ? summary.trends.data : null;
  const vipShare = options.vipRevenueShare ?? 0.3;
  const recurringLimit = options.recurringRatioLimit ?? 0.2;
  const vip = topRevenueCustomer(input);

  if (c.hasBase && c.withoutPurchases > 0) {
    alerts.push({
      id: "clientes_sem_compras",
      severity: "warning",
      title: "Clientes sem compras",
      message: `${c.withoutPurchases} cliente(s) cadastrados sem compra no período.`,
      recommendation: "Faça uma abordagem ativa antes de investir em novos cadastros.",
      source: "crm",
      link: crmLink("abrir_clientes"),
    });
  }

  if (c.hasBase && c.inactive > 0) {
    alerts.push({
      id: "clientes_inativos",
      severity: "warning",
      title: "Clientes inativos",
      message: `${c.inactive} cliente(s) já compraram e estão parados.`,
      recommendation: "Priorize a reativação — o custo é menor que conquistar novos clientes.",
      source: "crm",
      link: crmLink("abrir_crm"),
    });
  }

  if (input.metrics && c.inactive90 > 0) {
    alerts.push({
      id: "clientes_perdidos",
      severity: "critical",
      title: "Clientes perdidos",
      message: `${c.inactive90} cliente(s) sem qualquer interação há mais de 90 dias.`,
      recommendation: "Monte uma ação de recuperação com oferta específica para esse grupo.",
      source: "crm",
      link: crmLink("abrir_crm"),
    });
  }

  if (c.hasBase && c.recurringRatio !== null && c.recurringRatio < recurringLimit) {
    alerts.push({
      id: "queda_recorrencia",
      severity: "warning",
      title: "Recorrência baixa",
      message: `Apenas ${c.recurring} de ${c.active} cliente(s) ativos voltaram a comprar.`,
      recommendation: "Crie um motivo de retorno: recompra programada, clube ou pós-venda.",
      source: "crm",
      link: crmLink("abrir_crm"),
    });
  }

  if (trends?.monthVsPreviousRevenue.direction === "down") {
    alerts.push({
      id: "reducao_ticket",
      severity: "warning",
      title: "Consumo por cliente em queda",
      message: `Receita do mês abaixo do mês anterior (${trends.monthVsPreviousRevenue.label}).`,
      recommendation: "Trabalhe combos e recompra para elevar o valor médio por cliente.",
      source: "crm",
      link: crmLink("abrir_relatorios"),
    });
  }

  if (vip && c.topRevenue > 0 && num(vip.revenue) / c.topRevenue > vipShare) {
    alerts.push({
      id: "clientes_vip",
      severity: "info",
      title: "Cliente VIP concentrando receita",
      message: `${vip.name} responde por boa parte do faturamento do ranking.`,
      recommendation: "Cuide desse relacionamento e reduza a dependência ampliando a base.",
      source: "crm",
      link: crmCustomerLink(vip.id),
    });
  }

  if (c.hasBase && c.newCustomers > 0) {
    alerts.push({
      id: "clientes_em_crescimento",
      severity: "info",
      title: "Clientes em crescimento",
      message: `${c.newCustomers} novo(s) cliente(s) no período.`,
      recommendation: "Faça o primeiro pós-venda para transformar novo cliente em recorrente.",
      source: "crm",
      link: crmLink("abrir_clientes"),
    });
  }

  const noContact = customersWithoutContact(input.customers, options);
  if (input.customers && noContact.length > 0) {
    alerts.push({
      id: "clientes_sem_contato",
      severity: "info",
      title: "Clientes sem contato",
      message: `${noContact.length} cliente(s) sem interação registrada recentemente.`,
      recommendation: "Registre um contato no CRM para manter o relacionamento ativo.",
      source: "crm",
      link: crmLink("abrir_crm"),
    });
  }

  const proactive = filterCrmNotifications(input.notifications ?? []).map<BellaCrmAlert>((n) => ({
    id: n.id,
    severity:
      n.severity === "critical" ? "critical" : n.severity === "warning" ? "warning" : "info",
    title: n.title,
    message: n.message,
    recommendation: n.recommendation,
    source: "proactive",
    link: crmLinkForAction(n.action),
  }));

  const order = { critical: 0, warning: 1, info: 2 } as const;
  return [...alerts, ...proactive]
    .sort((a, b) => order[a.severity] - order[b.severity])
    .slice(0, Math.max(0, options.alertLimit ?? 6));
}

export function buildCrmRecommendations(
  insights: readonly AccountingInsight[],
  limit = 5,
): BellaCrmRecommendation[] {
  return filterCrmInsights(insights)
    .slice(0, Math.max(0, limit))
    .map((insight) => ({
      id: insight.id,
      title: insight.title,
      description: insight.description,
      recommendation: insight.recommendation,
      severity: insight.severity,
      category: insight.category,
      priority: insight.priority,
      link: crmLinkForAction(insight.action),
    }));
}

export function buildCrmHealth(
  summary: AccountingSummary | null | undefined,
): BellaCrmHealth | null {
  const health = summary?.health.available ? summary.health.data : null;
  if (!health) return null;
  return {
    level: health.level,
    score: health.score,
    label: healthLabel(health),
    reasons: health.warnings ?? [],
  };
}

/** View model completo do painel "Bella CRM". */
export function buildBellaCrmView(
  input: BellaCrmInput,
  options: BellaCrmOptions = {},
): BellaCrmView {
  const now = options.now ?? new Date().toISOString();
  const summary = input.summary ?? null;
  const generatedAt = options.now ?? summary?.generatedAt ?? now;

  const insights = input.insights ?? (summary ? buildAccountingInsights(summary) : []);
  const notifications =
    input.notifications ?? (summary ? buildBellaNotifications({ summary, insights }) : []);

  const missing: string[] = [];
  if (!input.metrics) missing.push("métricas de clientes");
  if (!input.report) missing.push("relatório de clientes");
  if (!input.customers) missing.push("lista de clientes");
  if (!input.sales) missing.push("vendas recentes");
  if (!summary) missing.push("resumo contábil");

  return {
    available: Boolean(
      input.metrics || input.report || input.customers || input.sales || summary,
    ),
    generatedAt,
    metrics: buildCrmMetrics(input, { ...options, now }),
    details: buildCrmDetails(input),
    health: buildCrmHealth(summary),
    alerts: buildCrmAlerts({ ...input, insights, notifications }, { ...options, now }),
    recommendations: buildCrmRecommendations(insights, options.recommendationLimit ?? 5),
    missing,
  };
}
