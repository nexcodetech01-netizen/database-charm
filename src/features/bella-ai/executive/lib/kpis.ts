/**
 * KPIs executivos.
 *
 * Todos os indicadores derivam do snapshot consolidado — nenhum número
 * financeiro/contábil/tributário é recalculado aqui: são razões e
 * derivações puras sobre valores já auditados pelos motores.
 */

import type { ExecutiveKpi, ExecutiveSnapshot } from "../types";
import { pctChange, safeDiv } from "./normalize";

const PERIOD_DAYS = 30;

export function computeExecutiveKpis(s: ExecutiveSnapshot): ExecutiveKpi[] {
  const { dre, previousDre, balance, cash, inventory, tax } = s;

  const revenue = dre.grossRevenue;
  const netRevenue = dre.netRevenue;
  const currentAssets = cash.available + cash.receivable + inventory.value;
  const currentLiabilities = cash.payable;
  const workingCapital = currentAssets - currentLiabilities;
  const dailyRevenue = safeDiv(revenue, PERIOD_DAYS);
  const dailyExpenses = safeDiv(dre.operatingExpenses + dre.cogs, PERIOD_DAYS);
  const netDebt = Math.max(cash.payable - cash.available, 0);
  const contributionMargin = netRevenue - dre.cogs;
  const contributionMarginPct = safeDiv(contributionMargin, netRevenue) * 100;
  const breakEven =
    contributionMarginPct > 0 ? (dre.operatingExpenses / contributionMarginPct) * 100 : 0;

  const kpi = (
    key: string,
    label: string,
    value: number | null,
    format: ExecutiveKpi["format"],
    group: ExecutiveKpi["group"],
    hint?: string,
  ): ExecutiveKpi => ({ key, label, value, format, group, hint });

  return [
    // Resultado
    kpi("revenue", "Receita bruta do período", revenue, "currency", "resultado"),
    kpi("net_revenue", "Receita líquida", netRevenue, "currency", "resultado"),
    kpi("deductions", "Deduções sobre vendas", dre.deductions, "currency", "resultado"),
    kpi("cogs", "CMV", dre.cogs, "currency", "resultado"),
    kpi("gross_profit", "Lucro bruto", dre.grossProfit, "currency", "resultado"),
    kpi("operating_expenses", "Despesas operacionais", dre.operatingExpenses, "currency", "resultado"),
    kpi("operating_result", "Resultado operacional", dre.operatingResult, "currency", "resultado"),
    kpi("financial_expenses", "Despesas financeiras", dre.financialExpenses, "currency", "resultado"),
    kpi("net_profit", "Lucro líquido", dre.netProfit, "currency", "resultado"),
    kpi("ebitda", "EBITDA", dre.ebitda, "currency", "resultado"),
    kpi("depreciation", "Depreciação", dre.depreciation, "currency", "resultado"),
    kpi("previous_revenue", "Receita do período anterior", previousDre.grossRevenue, "currency", "resultado"),
    kpi("previous_net_profit", "Lucro do período anterior", previousDre.netProfit, "currency", "resultado"),
    kpi("revenue_growth", "Crescimento da receita", pctChange(revenue, previousDre.grossRevenue), "percent", "resultado"),
    kpi("profit_growth", "Crescimento do lucro", pctChange(dre.netProfit, previousDre.netProfit), "percent", "resultado"),
    kpi("accumulated_revenue", "Receita acumulada (RBT12)", tax.rbt12, "currency", "resultado"),

    // Margens
    kpi("gross_margin", "Margem bruta", dre.grossMargin, "percent", "margem"),
    kpi("operating_margin", "Margem operacional", dre.operatingMargin, "percent", "margem"),
    kpi("net_margin", "Margem líquida", dre.netMargin, "percent", "margem"),
    kpi("ebitda_margin", "Margem EBITDA", dre.ebitdaMargin, "percent", "margem"),
    kpi("contribution_margin", "Margem de contribuição", contributionMarginPct, "percent", "margem"),
    kpi("margin_delta", "Variação da margem líquida", dre.netMargin - previousDre.netMargin, "percent", "margem"),
    kpi("cogs_ratio", "CMV sobre receita", safeDiv(dre.cogs, netRevenue) * 100, "percent", "margem"),
    kpi("expense_ratio", "Despesas sobre receita", safeDiv(dre.operatingExpenses, netRevenue) * 100, "percent", "margem"),

    // Liquidez e estrutura
    kpi("current_liquidity", "Liquidez corrente", safeDiv(currentAssets, currentLiabilities), "ratio", "liquidez"),
    kpi("dry_liquidity", "Liquidez seca", safeDiv(currentAssets - inventory.value, currentLiabilities), "ratio", "liquidez"),
    kpi("immediate_liquidity", "Liquidez imediata", safeDiv(cash.available, currentLiabilities), "ratio", "liquidez"),
    kpi("working_capital", "Capital de giro", workingCapital, "currency", "liquidez"),
    kpi("net_debt", "Dívida líquida", netDebt, "currency", "liquidez"),
    kpi("debt_ratio", "Endividamento", safeDiv(balance.liabilities, balance.assets) * 100, "percent", "liquidez"),
    kpi("equity", "Patrimônio líquido", balance.equity, "currency", "liquidez"),
    kpi("assets", "Ativo total", balance.assets, "currency", "liquidez"),
    kpi("roi", "ROI", safeDiv(dre.netProfit, balance.assets) * 100, "percent", "liquidez"),
    kpi("roe", "ROE", safeDiv(dre.netProfit, balance.equity) * 100, "percent", "liquidez"),

    // Caixa
    kpi("cash_available", "Caixa disponível", cash.available, "currency", "caixa"),
    kpi("cash_flow", "Fluxo de caixa do período", cash.receivable - cash.payable, "currency", "caixa"),
    kpi("receivable", "Contas a receber", cash.receivable, "currency", "caixa"),
    kpi("payable", "Contas a pagar", cash.payable, "currency", "caixa"),
    kpi("overdue_receivable", "Recebíveis vencidos", cash.overdueReceivable, "currency", "caixa"),
    kpi("overdue_payable", "Contas vencidas a pagar", cash.overduePayable, "currency", "caixa"),
    kpi("cash_coverage_days", "Cobertura de caixa", safeDiv(cash.available, dailyExpenses), "days", "caixa"),
    kpi("cash_conversion_cycle", "Ciclo de conversão de caixa",
      safeDiv(cash.receivable, dailyRevenue) + safeDiv(inventory.value, safeDiv(dre.cogs, PERIOD_DAYS)) - safeDiv(cash.payable, dailyExpenses),
      "days", "caixa"),
    kpi("receivable_days", "Prazo médio de recebimento", safeDiv(cash.receivable, dailyRevenue), "days", "caixa"),
    kpi("payable_days", "Prazo médio de pagamento", safeDiv(cash.payable, dailyExpenses), "days", "caixa"),
    kpi("break_even", "Ponto de equilíbrio", breakEven, "currency", "caixa"),

    // Estoque
    kpi("inventory_value", "Estoque valorizado", inventory.value, "currency", "estoque"),
    kpi("inventory_items", "Itens com saldo", inventory.items, "number", "estoque"),
    kpi("inventory_turnover", "Giro de estoque", safeDiv(dre.cogs, inventory.value), "ratio", "estoque"),
    kpi("inventory_days", "Dias de estoque", safeDiv(inventory.value, safeDiv(dre.cogs, PERIOD_DAYS)), "days", "estoque"),
    kpi("stale_items", "Produtos sem giro (90d)", inventory.staleItems, "number", "estoque"),

    // Clientes / eficiência
    kpi("sales_count", "Vendas no período", s.salesCount, "number", "clientes"),
    kpi("average_ticket", "Ticket médio", safeDiv(revenue, s.salesCount), "currency", "clientes"),
    kpi("active_customers", "Clientes que compraram", s.rankings.customers.filter((c) => c.salesCount > 0).length, "number", "clientes"),
    kpi("recurring_customers", "Clientes recorrentes", s.rankings.customers.filter((c) => c.salesCount > 1).length, "number", "clientes"),
    kpi("delinquent_customers", "Clientes inadimplentes", s.rankings.customers.filter((c) => c.overdueAmount > 0).length, "number", "clientes"),
    kpi("ltv", "LTV estimado", safeDiv(revenue, Math.max(s.rankings.customers.filter((c) => c.salesCount > 0).length, 1)), "currency", "clientes", "Receita média por cliente ativo no período."),
    kpi("cac", "CAC", null, "currency", "clientes", "Requer registro de investimento em marketing."),
    kpi("revenue_per_sale", "Receita por venda", safeDiv(revenue, s.salesCount), "currency", "eficiencia"),
    kpi("profit_per_sale", "Lucro por venda", safeDiv(dre.netProfit, s.salesCount), "currency", "eficiencia"),
    kpi("productive_products", "Produtos com venda", s.rankings.products.filter((p) => p.quantitySold > 0).length, "number", "eficiencia"),

    // Tributos
    kpi("estimated_tax", "Tributos estimados do mês", tax.estimatedTax, "currency", "tributos"),
    kpi("effective_tax_rate", "Alíquota efetiva", tax.effectiveRate, "percent", "tributos"),
    kpi("tax_burden", "Carga tributária sobre receita", safeDiv(tax.estimatedTax, tax.monthRevenue) * 100, "percent", "tributos"),
    kpi("simples_limit_usage", "Uso do limite do Simples", tax.limitUsagePct, "percent", "tributos"),
    kpi("tax_reserve", "Reserva recomendada de impostos", tax.estimatedTax, "currency", "tributos"),
  ];
}

export function kpiValue(kpis: ExecutiveKpi[], key: string): number | null {
  return kpis.find((k) => k.key === key)?.value ?? null;
}
