import { describe, expect, it } from "vitest";
import { makeSnapshot } from "./fixtures";
import { computeExecutiveKpis, kpiValue } from "../lib/kpis";
import { detectExecutiveInsights } from "../lib/insights";
import { buildExecutiveForecast, HORIZONS, trendFactor } from "../lib/forecast";
import { assessExecutiveRisk } from "../lib/risk";
import { buildExecutiveRecommendations } from "../lib/recommendations";
import { buildExecutiveAlerts } from "../lib/alerts";
import { rankCustomers, rankProducts, rankSuppliers } from "../lib/rankings";
import { toExecutiveSnapshot, pctChange, safeDiv, num } from "../lib/normalize";
import { buildExecutiveReport } from "../services/executive.service";
import { executiveSkills } from "../skills/executive-skills";
import { executiveProvider } from "../providers/executive.provider";

describe("normalize", () => {
  it("converte números e evita divisões inválidas", () => {
    expect(num("12.5")).toBe(12.5);
    expect(num("abc")).toBe(0);
    expect(num(undefined, 3)).toBe(3);
    expect(safeDiv(10, 0)).toBe(0);
    expect(safeDiv(10, 2)).toBe(5);
    expect(pctChange(110, 100)).toBeCloseTo(10);
    expect(pctChange(0, 0)).toBe(0);
    expect(pctChange(10, 0)).toBe(100);
  });

  it("normaliza payload cru da RPC com chaves snake_case", () => {
    const s = toExecutiveSnapshot({
      companyId: "c",
      period: { start: "2026-07-01", end: "2026-07-31", today: "2026-07-31" },
      previousPeriod: { start: "2026-06-01", end: "2026-06-30" },
      dre: { grossRevenue: 100, netProfit: 10 },
      previousDre: { grossRevenue: 80 },
      balanceSheet: { assets: 500, liabilities: 200, equity: 300 },
      cash: { available: 50, receivable: 20, payable: 10, overdueReceivable: 5, overduePayable: 1 },
      inventory: { value: 70, items: 3, staleItems: 1 },
      tax: { regime: "simples_nacional", annex: "I", rbt12: 1000, monthRevenue: 100, computation: { tax_amount: 8, effective_rate: 8, limit_usage_pct: 20, bracket: 2 } },
      salesCount: 4,
      rankings: {
        products: [{ id: "p", name: "P", sku: null, stock: 2, quantity_sold: 4, revenue: 100, profit: 25 }],
        customers: [{ id: "c", name: "C", sales_count: 2, revenue: 100, overdue_amount: 0, last_sale_at: null }],
        suppliers: [{ id: "s", name: "S", purchases_count: 1, total_amount: 50, average_amount: 50, delivery_days: 3 }],
      },
    });
    expect(s.tax.estimatedTax).toBe(8);
    expect(s.rankings.products[0].margin).toBe(25);
    expect(s.rankings.products[0].turnover).toBe(2);
    expect(s.rankings.customers[0].averageTicket).toBe(50);
    expect(s.rankings.suppliers[0].deliveryDays).toBe(3);
  });

  it("tolera payload vazio", () => {
    const s = toExecutiveSnapshot(null);
    expect(s.dre.grossRevenue).toBe(0);
    expect(s.rankings.products).toEqual([]);
  });
});

describe("KPIs", () => {
  const kpis = computeExecutiveKpis(makeSnapshot());

  it("gera pelo menos 50 indicadores únicos", () => {
    expect(kpis.length).toBeGreaterThanOrEqual(50);
    expect(new Set(kpis.map((k) => k.key)).size).toBe(kpis.length);
  });

  it("reflete os números dos motores sem recalcular resultado", () => {
    expect(kpiValue(kpis, "revenue")).toBe(100000);
    expect(kpiValue(kpis, "ebitda")).toBe(21000);
    expect(kpiValue(kpis, "net_profit")).toBe(19000);
    expect(kpiValue(kpis, "net_margin")).toBe(20);
  });

  it("calcula derivações de liquidez, giro e ticket", () => {
    expect(kpiValue(kpis, "working_capital")).toBe(60000 + 40000 + 80000 - 30000);
    expect(kpiValue(kpis, "average_ticket")).toBe(500);
    expect(kpiValue(kpis, "inventory_turnover")).toBeCloseTo(0.625);
    expect(kpiValue(kpis, "current_liquidity")).toBeCloseTo(6);
  });

  it("marca CAC como indisponível quando não há investimento registrado", () => {
    expect(kpiValue(kpis, "cac")).toBeNull();
  });

  it("não quebra com snapshot zerado", () => {
    const zero = computeExecutiveKpis(
      makeSnapshot({
        salesCount: 0,
        cash: { available: 0, receivable: 0, overdueReceivable: 0, payable: 0, overduePayable: 0 },
        inventory: { value: 0, items: 0, staleItems: 0 },
      }),
    );
    expect(zero.every((k) => k.value === null || Number.isFinite(k.value))).toBe(true);
  });
});

describe("Insights", () => {
  it("não acusa problemas em uma empresa saudável", () => {
    const insights = detectExecutiveInsights(makeSnapshot());
    const ids = insights.map((i) => i.id);
    expect(ids).not.toContain("revenue_drop");
    expect(ids).not.toContain("cash_below_minimum");
  });

  it("detecta queda de receita, lucro e margem", () => {
    const s = makeSnapshot();
    s.dre.grossRevenue = 60000;
    s.dre.netProfit = 1000;
    s.dre.netMargin = 1.6;
    const ids = detectExecutiveInsights(s).map((i) => i.id);
    expect(ids).toContain("revenue_drop");
    expect(ids).toContain("profit_drop");
    expect(ids).toContain("margin_drop");
  });

  it("detecta aumento de CMV e de despesa", () => {
    const s = makeSnapshot();
    s.dre.cogs = 70000;
    s.dre.operatingExpenses = 40000;
    const ids = detectExecutiveInsights(s).map((i) => i.id);
    expect(ids).toContain("cogs_rise");
    expect(ids).toContain("expense_rise");
  });

  it("detecta caixa abaixo do mínimo", () => {
    const s = makeSnapshot();
    s.cash.available = 1000;
    const insight = detectExecutiveInsights(s).find((i) => i.id === "cash_below_minimum");
    expect(insight?.severity).toBe("critical");
  });

  it("detecta estoque parado, sem giro e margem negativa", () => {
    const s = makeSnapshot();
    s.inventory.staleItems = 25;
    const ids = detectExecutiveInsights(s).map((i) => i.id);
    expect(ids).toContain("stale_inventory");
    expect(ids).toContain("no_turnover_products");
    expect(ids).toContain("negative_margin_products");
  });

  it("detecta inadimplência e compras acima da média", () => {
    const s = makeSnapshot();
    s.cash.overdueReceivable = 5000;
    const ids = detectExecutiveInsights(s).map((i) => i.id);
    expect(ids).toContain("delinquent_customers");
    expect(ids).toContain("purchases_above_average");
  });
});

describe("Projeções", () => {
  it("projeta os quatro horizontes", () => {
    const f = buildExecutiveForecast(makeSnapshot());
    expect(f.map((x) => x.horizonDays)).toEqual(HORIZONS);
    expect(f[0].revenue).toBeLessThan(f[3].revenue);
    expect(f.every((x) => Number.isFinite(x.cash))).toBe(true);
  });

  it("limita o fator de tendência entre 0,5x e 1,5x", () => {
    expect(trendFactor(1000, 100)).toBe(1.5);
    expect(trendFactor(10, 1000)).toBe(0.5);
    expect(trendFactor(100, 0)).toBe(1);
  });

  it("projeta impostos pela alíquota efetiva do motor tributário", () => {
    const s = makeSnapshot();
    const f = buildExecutiveForecast(s);
    const thirty = f.find((x) => x.horizonDays === 30)!;
    expect(thirty.taxes).toBeCloseTo(thirty.revenue * 0.08, 5);
  });
});

describe("Risco", () => {
  it("empresa saudável tem score alto", () => {
    const r = assessExecutiveRisk(makeSnapshot());
    expect(r.overallScore).toBeGreaterThan(60);
    expect(r.risks).toHaveLength(5);
  });

  it("penaliza prejuízo, caixa curto e limite tributário", () => {
    const s = makeSnapshot();
    s.dre.netProfit = -5000;
    s.dre.netMargin = -5;
    s.cash.available = 0;
    s.cash.overduePayable = 1000;
    s.tax.limitUsagePct = 96;
    const r = assessExecutiveRisk(s);
    expect(r.overallScore).toBeLessThan(60);
    expect(r.risks.find((x) => x.key === "caixa")!.score).toBeLessThan(40);
    expect(r.risks.find((x) => x.key === "tributario")!.reasons.length).toBeGreaterThan(0);
    expect(r.severity === "critical" || r.severity === "warning").toBe(true);
  });

  it("mantém score entre 0 e 100", () => {
    const s = makeSnapshot();
    s.dre.netProfit = -999999;
    s.dre.netMargin = -100;
    s.salesCount = 0;
    s.inventory.staleItems = 500;
    const r = assessExecutiveRisk(s);
    for (const risk of r.risks) {
      expect(risk.score).toBeGreaterThanOrEqual(0);
      expect(risk.score).toBeLessThanOrEqual(100);
    }
  });
});

describe("Recomendações", () => {
  it("recomenda compra quando caixa e giro estão saudáveis", () => {
    const s = makeSnapshot();
    s.dre.cogs = 120000;
    s.cash.available = 200000;
    const rec = buildExecutiveRecommendations(s, assessExecutiveRisk(s));
    expect(rec.map((r) => r.action)).toContain("comprar_estoque");
  });

  it("recomenda cobrança, reserva e corte quando há stress", () => {
    const s = makeSnapshot();
    s.cash.overdueReceivable = 20000;
    s.cash.available = 500;
    s.dre.operatingExpenses = 40000;
    const actions = buildExecutiveRecommendations(s, assessExecutiveRisk(s)).map((r) => r.action);
    expect(actions).toContain("cobrar_clientes");
    expect(actions).toContain("reservar_caixa");
    expect(actions).toContain("evitar_compras");
    expect(actions).toContain("reduzir_despesas");
    expect(actions).toContain("nao_comprar");
  });

  it("recomenda preço e promoção para estoque encalhado e prejuízo", () => {
    const s = makeSnapshot();
    s.inventory.staleItems = 30;
    const actions = buildExecutiveRecommendations(s, assessExecutiveRisk(s)).map((r) => r.action);
    expect(actions).toContain("aumentar_preco");
    expect(actions).toContain("fazer_promocao");
    expect(actions).toContain("reduzir_preco");
    expect(actions).toContain("reservar_impostos");
  });
});

describe("Alertas", () => {
  it("gera alerta de faixa tributária e fluxo negativo", () => {
    const s = makeSnapshot();
    s.tax.limitUsagePct = 90;
    s.cash.payable = 90000;
    const risk = assessExecutiveRisk(s);
    const ids = buildExecutiveAlerts(s, detectExecutiveInsights(s), risk).map((a) => a.id);
    expect(ids).toContain("tax_bracket_change");
    expect(ids).toContain("negative_cash_flow");
  });

  it("gera alerta de capital de giro e caixa crítico", () => {
    const s = makeSnapshot();
    s.cash.available = 0;
    s.cash.payable = 500000;
    const risk = assessExecutiveRisk(s);
    const ids = buildExecutiveAlerts(s, detectExecutiveInsights(s), risk).map((a) => a.id);
    expect(ids).toContain("working_capital");
    expect(ids).toContain("cash_drop");
  });

  it("gera alerta de risco global quando o score despenca", () => {
    const s = makeSnapshot();
    s.dre.netProfit = -50000;
    s.dre.netMargin = -50;
    s.dre.grossRevenue = 10000;
    s.cash.available = 0;
    s.cash.payable = 500000;
    s.cash.overduePayable = 100000;
    s.cash.overdueReceivable = 50000;
    s.tax.limitUsagePct = 99;
    s.inventory.staleItems = 40;
    s.salesCount = 0;
    const risk = assessExecutiveRisk(s);
    expect(risk.overallScore).toBeLessThan(40);
    const ids = buildExecutiveAlerts(s, detectExecutiveInsights(s), risk).map((a) => a.id);
    expect(ids).toContain("overall_risk");
  });

  it("não gera alertas informativos", () => {
    const s = makeSnapshot();
    const alerts = buildExecutiveAlerts(s, detectExecutiveInsights(s), assessExecutiveRisk(s));
    expect(alerts.every((a) => a.severity !== "info")).toBe(true);
  });
});

describe("Rankings", () => {
  const s = makeSnapshot();

  it("ordena produtos por lucro, margem e giro", () => {
    const r = rankProducts(s.rankings.products);
    expect(r.topProfit[0].id).toBe("p1");
    expect(r.lowestMargin[0].id).toBe("p2");
    expect(r.negative.map((p) => p.id)).toEqual(["p2"]);
    expect(r.staleStock.map((p) => p.id)).toEqual(["p3"]);
    expect(r.topTurnover[0].id).toBe("p1");
  });

  it("ordena clientes por faturamento, recorrência e inadimplência", () => {
    const r = rankCustomers(s.rankings.customers, 0.2);
    expect(r.topRevenue[0].id).toBe("c1");
    expect(r.topRecurring[0].id).toBe("c1");
    expect(r.topOverdue[0].id).toBe("c2");
    expect(r.topTicket[0].id).toBe("c2");
    expect(r.topProfitable[0].id).toBe("c1");
  });

  it("ordena fornecedores por volume, custo e prazo", () => {
    const r = rankSuppliers(s.rankings.suppliers);
    expect(r.topVolume[0].id).toBe("s1");
    expect(r.topCost[0].id).toBe("s1");
    expect(r.longestLeadTime[0].id).toBe("s1");
    expect(r.bestSavings[0].id).toBe("s2");
    expect(r.topAverageIncrease[0].id).toBe("s1");
  });

  it("suporta listas vazias", () => {
    expect(rankProducts([]).topProfit).toEqual([]);
    expect(rankCustomers([]).topRevenue).toEqual([]);
    expect(rankSuppliers([]).topVolume).toEqual([]);
  });
});

describe("Relatório executivo", () => {
  const report = buildExecutiveReport(makeSnapshot());

  it("consolida KPIs, insights, alertas, projeções, risco e recomendações", () => {
    expect(report.kpis.length).toBeGreaterThanOrEqual(50);
    expect(report.forecast).toHaveLength(4);
    expect(report.risk.risks).toHaveLength(5);
    expect(Array.isArray(report.insights)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
  });
});

describe("Skills Bella CEO", () => {
  const ctx = { companyId: "company-1" };

  it("expõe as skills executivas com ids únicos", () => {
    expect(executiveSkills.length).toBeGreaterThanOrEqual(12);
    expect(new Set(executiveSkills.map((s) => s.id)).size).toBe(executiveSkills.length);
    expect(executiveSkills.every((s) => s.module === "executive")).toBe(true);
  });

  it("bloqueia execução sem empresa no contexto", () => {
    expect(executiveSkills.every((s) => s.canExecute({ companyId: "" }) === false)).toBe(true);
    expect(executiveSkills.every((s) => s.canExecute(ctx) === true)).toBe(true);
  });
});

describe("Provider executivo", () => {
  it("declara o módulo executive", () => {
    expect(executiveProvider.module).toBe("executive");
    expect(executiveProvider.displayName).toBe("Bella Executive");
  });
});
