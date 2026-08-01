/**
 * Bella Contadora — Estoque: seletores puros.
 *
 * Somente transformam dados JÁ apurados em um view model. NADA é
 * recalculado: saldo, mínimo, valor de estoque e produtos parados vêm da
 * RPC `products_inventory_metrics` (InventoryService); ranking de produtos e
 * saúde vêm do `AccountingSummary`; alertas proativos vêm do `Proactive`;
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
import { inventoryLink, inventoryLinkForAction, inventoryProductLink } from "./links";
import type {
  BellaInventoryAlert,
  BellaInventoryDetail,
  BellaInventoryHealth,
  BellaInventoryInput,
  BellaInventoryMetric,
  BellaInventoryMetricsLike,
  BellaInventoryMovementLike,
  BellaInventoryOptions,
  BellaInventoryProductLike,
  BellaInventoryRecommendation,
  BellaInventoryView,
} from "./types";

/** Categorias consideradas de estoque nos filtros do painel. */
export const INVENTORY_CATEGORIES: NotificationCategory[] = ["estoque", "produtos"];

const INVENTORY_CATEGORY_SET = new Set<string>(INVENTORY_CATEGORIES);

export function isInventoryCategory(category: string): boolean {
  return INVENTORY_CATEGORY_SET.has(category);
}

export function filterInventoryNotifications(
  notifications: readonly BellaNotification[],
): BellaNotification[] {
  return sortNotifications(notifications.filter((n) => isInventoryCategory(n.category)));
}

export function filterInventoryInsights(
  insights: readonly AccountingInsight[],
): AccountingInsight[] {
  return sortInsights(insights.filter((i) => isInventoryCategory(i.category)));
}

const num = (value: number | null | undefined): number => Number(value ?? 0);

export interface InventoryCounts {
  productCount: number;
  totalItems: number;
  inventoryValue: number;
  todayMovements: number;
  belowMinCount: number;
  outOfStockCount: number;
  negativeCount: number;
  nearMinCount: number;
  aboveMaxCount: number;
  aboveMaxKnown: boolean;
  stagnantCount: number;
  stagnantValue: number | null;
}

/** Contagens simples sobre as métricas já apuradas pelo InventoryService. */
export function countInventory(
  metrics: BellaInventoryMetricsLike | null | undefined,
  options: BellaInventoryOptions = {},
): InventoryCounts {
  const factor = options.nearMinFactor ?? 1.2;
  const belowMin = metrics?.belowMin ?? [];
  const stagnant = metrics?.stagnant ?? [];

  let outOfStockCount = 0;
  let negativeCount = 0;
  let nearMinCount = 0;
  let aboveMaxCount = 0;
  let aboveMaxKnown = false;

  for (const p of belowMin) {
    const stock = num(p.stock);
    const min = num(p.min_stock);
    if (stock < 0) negativeCount += 1;
    if (stock <= 0) outOfStockCount += 1;
    else if (min > 0 && stock > min && stock <= min * factor) nearMinCount += 1;
  }

  for (const p of [...belowMin, ...stagnant]) {
    const max = p.max_stock;
    if (max === null || max === undefined || !Number.isFinite(Number(max)) || Number(max) <= 0) {
      continue;
    }
    aboveMaxKnown = true;
    if (num(p.stock) > Number(max)) aboveMaxCount += 1;
  }

  let stagnantValue: number | null = 0;
  for (const p of stagnant) {
    if (p.cost === null || p.cost === undefined) {
      stagnantValue = null;
      break;
    }
    stagnantValue += num(p.cost) * num(p.stock);
  }
  if (stagnant.length === 0) stagnantValue = metrics ? 0 : null;

  return {
    productCount: num(metrics?.productCount),
    totalItems: num(metrics?.totalItems),
    inventoryValue: num(metrics?.inventoryValue),
    todayMovements: num(metrics?.todayMovements),
    belowMinCount: belowMin.length,
    outOfStockCount,
    negativeCount,
    nearMinCount,
    aboveMaxCount,
    aboveMaxKnown,
    stagnantCount: stagnant.length,
    stagnantValue,
  };
}

/** Data da movimentação mais recente já registrada. */
export function lastMovementAt(
  movements: readonly BellaInventoryMovementLike[] | null | undefined,
): string | null {
  let best: string | null = null;
  let bestAt = -Infinity;
  for (const m of movements ?? []) {
    const raw = m.movement_date ?? m.created_at ?? null;
    if (!raw) continue;
    const at = Date.parse(raw);
    if (!Number.isFinite(at) || at <= bestAt) continue;
    best = raw;
    bestAt = at;
  }
  return best;
}

/** Quantas movimentações de entrada existem na janela lida. */
export function countInbound(
  movements: readonly BellaInventoryMovementLike[] | null | undefined,
): number {
  return (movements ?? []).filter((m) => m.type === "in").length;
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return null;
  return at.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Formata um indicador de estoque para exibição. */
export function formatInventoryMetric(metric: BellaInventoryMetric): string {
  if (!metric.available || metric.value === null) return "—";
  if (metric.format === "currency") {
    return metric.value.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 2,
    });
  }
  return metric.value.toLocaleString("pt-BR");
}

/** Indicadores de estoque — leitura direta das métricas existentes. */
export function buildInventoryMetrics(
  metrics: BellaInventoryMetricsLike | null | undefined,
  options: BellaInventoryOptions = {},
): BellaInventoryMetric[] {
  const has = Boolean(metrics);
  const c = countInventory(metrics, options);

  return [
    {
      id: "produtos_ativos",
      label: "Produtos ativos",
      value: has ? c.productCount : null,
      available: has,
      format: "count",
      hint: "Cadastro ativo",
      link: inventoryLink("abrir_produtos"),
    },
    {
      id: "sem_estoque",
      label: "Sem estoque",
      value: has ? c.outOfStockCount : null,
      available: has,
      format: "count",
      hint: "Saldo zerado ou negativo",
      link: inventoryLink("abrir_estoque"),
    },
    {
      id: "abaixo_minimo",
      label: "Abaixo do mínimo",
      value: has ? c.belowMinCount : null,
      available: has,
      format: "count",
      hint: "Requer reposição",
      link: inventoryLink("abrir_compras"),
    },
    {
      id: "acima_maximo",
      label: "Acima do máximo",
      value: has && c.aboveMaxKnown ? c.aboveMaxCount : null,
      available: has && c.aboveMaxKnown,
      format: "count",
      hint: "Estoque máximo configurado",
      link: inventoryLink("abrir_produtos"),
    },
    {
      id: "sem_movimentacao",
      label: "Sem movimentação",
      value: has ? c.stagnantCount : null,
      available: has,
      format: "count",
      hint: "Sem giro no período monitorado",
      link: inventoryLink("ver_movimentacoes"),
    },
    {
      id: "parados",
      label: "Produtos parados",
      value: has ? c.stagnantCount : null,
      available: has,
      format: "count",
      hint: "Candidatos a promoção ou revisão de mix",
      link: inventoryLink("abrir_relatorios"),
    },
    {
      id: "capital_estoque",
      label: "Capital em estoque",
      value: has ? c.inventoryValue : null,
      available: has,
      format: "currency",
      hint: "Custo × quantidade",
      link: inventoryLink("abrir_estoque"),
    },
    {
      id: "valor_parado",
      label: "Valor parado",
      value: has ? c.stagnantValue : null,
      available: has && c.stagnantValue !== null,
      format: "currency",
      hint: "Custo dos itens sem giro",
      link: inventoryLink("abrir_relatorios"),
    },
    {
      id: "itens_estoque",
      label: "Itens em estoque",
      value: has ? c.totalItems : null,
      available: has,
      format: "count",
      hint: "Saldo somado de todos os produtos",
      link: inventoryLink("abrir_estoque"),
    },
    {
      id: "movimentacoes",
      label: "Movimentações do dia",
      value: has ? c.todayMovements : null,
      available: has,
      format: "count",
      hint: "Entradas, saídas e ajustes",
      link: inventoryLink("ver_movimentacoes"),
    },
  ];
}

/** Detalhes de estoque (última movimentação, campeão de venda, item crítico). */
export function buildInventoryDetails(
  input: BellaInventoryInput,
  options: BellaInventoryOptions = {},
): BellaInventoryDetail[] {
  const metrics = input.metrics ?? null;
  const movements = input.movements ?? null;
  const products = input.summary?.products.available ? input.summary.products.data : null;
  const lastAt = formatDate(lastMovementAt(movements));
  const best = products?.bestSellers[0] ?? null;
  const critical =
    (metrics?.belowMin ?? []).slice().sort((a, b) => num(a.stock) - num(b.stock))[0] ?? null;
  const c = countInventory(metrics, options);

  return [
    {
      id: "ultima_movimentacao",
      label: "Última movimentação",
      value: lastAt,
      available: Boolean(lastAt),
      link: inventoryLink("ver_movimentacoes"),
    },
    {
      id: "movimentacoes_hoje",
      label: "Movimentações hoje",
      value: metrics ? c.todayMovements.toLocaleString("pt-BR") : null,
      available: Boolean(metrics),
      link: inventoryLink("ver_movimentacoes"),
    },
    {
      id: "produto_mais_vendido",
      label: "Mais vendido",
      value: best ? best.name : null,
      available: Boolean(best),
      hint: best ? `${best.quantity.toLocaleString("pt-BR")} un.` : undefined,
      link: best ? inventoryProductLink(best.id) : inventoryLink("abrir_produtos"),
    },
    {
      id: "produto_mais_critico",
      label: "Mais crítico",
      value: critical ? critical.name : null,
      available: Boolean(critical),
      hint: critical
        ? `Saldo ${num(critical.stock).toLocaleString("pt-BR")} · mín. ${num(
            critical.min_stock,
          ).toLocaleString("pt-BR")}`
        : undefined,
      link: critical ? inventoryProductLink(critical.id) : inventoryLink("abrir_estoque"),
    },
  ];
}

/**
 * Alertas de estoque — derivados de estados que o Estoque já registrou,
 * somados às notificações proativas de categoria estoque/produtos.
 */
export function buildInventoryAlerts(
  input: BellaInventoryInput,
  options: BellaInventoryOptions = {},
): BellaInventoryAlert[] {
  const alerts: BellaInventoryAlert[] = [];
  const metrics = input.metrics ?? null;
  const c = countInventory(metrics, options);
  const products = input.summary?.products.available ? input.summary.products.data : null;

  if (metrics && c.negativeCount > 0) {
    alerts.push({
      id: "produto_negativo",
      severity: "critical",
      title: "Saldo negativo",
      message: `${c.negativeCount} produto(s) com saldo negativo em estoque.`,
      recommendation: "Faça o inventário para corrigir divergências de saldo.",
      source: "inventory",
      link: inventoryLink("abrir_inventario"),
    });
  }

  if (metrics && c.outOfStockCount > 0) {
    alerts.push({
      id: "produto_ruptura",
      severity: "critical",
      title: "Produtos em ruptura",
      message: `${c.outOfStockCount} produto(s) sem estoque disponível.`,
      recommendation: "Abra uma compra para repor os itens em ruptura.",
      source: "inventory",
      link: inventoryLink("abrir_compras"),
    });
  }

  if (metrics && c.belowMinCount > 0) {
    alerts.push({
      id: "estoque_critico",
      severity: "warning",
      title: "Estoque abaixo do mínimo",
      message: `${c.belowMinCount} produto(s) abaixo do estoque mínimo.`,
      recommendation: "Revise a reposição desses itens antes da ruptura.",
      source: "inventory",
      link: inventoryLink("abrir_estoque"),
    });
  }

  if (metrics && c.nearMinCount > 0) {
    alerts.push({
      id: "proximo_minimo",
      severity: "warning",
      title: "Produtos próximos do mínimo",
      message: `${c.nearMinCount} produto(s) perto de atingir o estoque mínimo.`,
      recommendation: "Antecipe a compra para não interromper a venda.",
      source: "inventory",
      link: inventoryLink("abrir_compras"),
    });
  }

  if (metrics && c.stagnantCount > 0) {
    alerts.push({
      id: "produto_parado",
      severity: "warning",
      title: "Produtos parados",
      message: `${c.stagnantCount} produto(s) sem movimentação no período monitorado.`,
      recommendation: "Avalie promoção, reposicionamento ou saída do mix.",
      source: "inventory",
      link: inventoryLink("abrir_relatorios"),
    });
  }

  const noSales = (products?.worstSellers ?? []).filter((p) => p.quantity <= 0);
  if (noSales.length > 0) {
    alerts.push({
      id: "produto_sem_venda",
      severity: "info",
      title: "Produtos sem venda",
      message: `${noSales.length} produto(s) sem venda no período.`,
      recommendation: "Verifique preço, exposição e curva ABC desses itens.",
      source: "inventory",
      link: inventoryLink("abrir_curva_abc"),
    });
  }

  if (input.movements && countInbound(input.movements) === 0 && c.belowMinCount > 0) {
    alerts.push({
      id: "produto_sem_compra",
      severity: "info",
      title: "Sem entradas recentes",
      message: "Nenhuma entrada de estoque nas movimentações recentes.",
      recommendation: "Confira pedidos de compra em aberto com o fornecedor.",
      source: "inventory",
      link: inventoryLink("abrir_fornecedores"),
    });
  }

  if (metrics && c.stagnantCount > 0 && c.inventoryValue > 0) {
    alerts.push({
      id: "capital_parado",
      severity: "info",
      title: "Capital parado em estoque",
      message:
        c.stagnantValue !== null
          ? `Há capital parado em ${c.stagnantCount} item(ns) sem giro.`
          : `${c.stagnantCount} item(ns) sem giro imobilizando capital.`,
      recommendation: "Priorize a venda dos itens parados antes de novas compras.",
      source: "inventory",
      link: inventoryLink("abrir_relatorios"),
    });
  }

  if (metrics && c.todayMovements === 0) {
    alerts.push({
      id: "sem_movimentacao",
      severity: "info",
      title: "Sem movimentação hoje",
      message: "Nenhuma entrada, saída ou ajuste registrado hoje.",
      recommendation: "Confirme se as vendas e compras do dia foram lançadas.",
      source: "inventory",
      link: inventoryLink("ver_movimentacoes"),
    });
  }

  const proactive = filterInventoryNotifications(input.notifications ?? []).map<BellaInventoryAlert>(
    (n) => ({
      id: n.id,
      severity:
        n.severity === "critical" ? "critical" : n.severity === "warning" ? "warning" : "info",
      title: n.title,
      message: n.message,
      recommendation: n.recommendation,
      source: "proactive",
      link: inventoryLinkForAction(n.action),
    }),
  );

  const order = { critical: 0, warning: 1, info: 2 } as const;
  return [...alerts, ...proactive]
    .sort((a, b) => order[a.severity] - order[b.severity])
    .slice(0, Math.max(0, options.alertLimit ?? 6));
}

export function buildInventoryRecommendations(
  insights: readonly AccountingInsight[],
  limit = 5,
): BellaInventoryRecommendation[] {
  return filterInventoryInsights(insights)
    .slice(0, Math.max(0, limit))
    .map((insight) => ({
      id: insight.id,
      title: insight.title,
      description: insight.description,
      recommendation: insight.recommendation,
      severity: insight.severity,
      category: insight.category,
      priority: insight.priority,
      link: inventoryLinkForAction(insight.action),
    }));
}

export function buildInventoryHealth(
  summary: AccountingSummary | null | undefined,
): BellaInventoryHealth | null {
  const health = summary?.health.available ? summary.health.data : null;
  if (!health) return null;
  return {
    level: health.level,
    score: health.score,
    label: healthLabel(health),
    reasons: health.warnings ?? [],
  };
}

/** View model completo do painel "Bella Estoque". */
export function buildBellaInventoryView(
  input: BellaInventoryInput,
  options: BellaInventoryOptions = {},
): BellaInventoryView {
  const now = options.now ?? new Date().toISOString();
  const summary = input.summary ?? null;
  const generatedAt = options.now ?? summary?.generatedAt ?? now;
  const hasMetrics = Boolean(input.metrics);

  const insights = input.insights ?? (summary ? buildAccountingInsights(summary) : []);
  const notifications =
    input.notifications ?? (summary ? buildBellaNotifications({ summary, insights }) : []);

  const missing: string[] = [];
  if (!hasMetrics) missing.push("métricas de estoque");
  if (!summary) missing.push("resumo contábil");
  if (!input.movements) missing.push("movimentações recentes");

  return {
    available: hasMetrics || Boolean(summary),
    generatedAt,
    metrics: buildInventoryMetrics(input.metrics, options),
    details: buildInventoryDetails({ ...input, insights, notifications }, options),
    health: buildInventoryHealth(summary),
    alerts: buildInventoryAlerts({ ...input, insights, notifications }, { ...options, now }),
    recommendations: buildInventoryRecommendations(
      insights,
      options.recommendationLimit ?? 5,
    ),
    missing,
  };
}
