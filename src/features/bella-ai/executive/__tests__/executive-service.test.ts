import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSnapshot } from "./fixtures";

const rpcMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));

const { executiveService } = await import("../services/executive.service");
const { executiveProvider, executiveQuery } = await import("../providers/executive.provider");
const skillsModule = await import("../skills/executive-skills");

const snapshot = makeSnapshot();
const ctx = { companyId: "company-1" };

function ok() {
  rpcMock.mockResolvedValue({ data: snapshot, error: null });
}
function fail() {
  rpcMock.mockResolvedValue({ data: null, error: { message: "sem acesso" } });
}

beforeEach(() => {
  rpcMock.mockReset();
  executiveService.invalidate();
});

describe("executiveService", () => {
  it("busca o snapshot pela RPC única", async () => {
    ok();
    const s = await executiveService.snapshot("company-1", "2026-07-01", "2026-07-30");
    expect(rpcMock).toHaveBeenCalledWith("generate_executive_summary", {
      _company_id: "company-1",
      _start: "2026-07-01",
      _end: "2026-07-30",
    });
    expect(s.dre.grossRevenue).toBe(100000);
  });

  it("usa null quando o período não é informado", async () => {
    ok();
    await executiveService.snapshot("company-1");
    expect(rpcMock).toHaveBeenCalledWith("generate_executive_summary", {
      _company_id: "company-1",
      _start: null,
      _end: null,
    });
  });

  it("propaga erro da RPC", async () => {
    fail();
    await expect(executiveService.snapshot("company-1")).rejects.toMatchObject({
      message: "sem acesso",
    });
  });

  it("faz cache por empresa e período", async () => {
    ok();
    await executiveService.report("company-1");
    await executiveService.report("company-1");
    expect(rpcMock).toHaveBeenCalledTimes(1);
    await executiveService.report("company-1", "2026-07-01");
    expect(rpcMock).toHaveBeenCalledTimes(2);
  });

  it("invalida cache por empresa e globalmente", async () => {
    ok();
    await executiveService.report("company-1");
    executiveService.invalidate("outra-empresa");
    await executiveService.report("company-1");
    expect(rpcMock).toHaveBeenCalledTimes(1);
    executiveService.invalidate("company-1");
    await executiveService.report("company-1");
    expect(rpcMock).toHaveBeenCalledTimes(2);
    executiveService.invalidate();
    await executiveService.report("company-1");
    expect(rpcMock).toHaveBeenCalledTimes(3);
  });

  it("expõe rankings derivados do relatório", async () => {
    ok();
    const report = await executiveService.report("company-1");
    const rankings = executiveService.rankings(report);
    expect(rankings.products.topProfit[0].id).toBe("p1");
    expect(rankings.customers.topRevenue[0].id).toBe("c1");
    expect(rankings.suppliers.topVolume[0].id).toBe("s1");
  });

  it("calcula rankings mesmo sem receita", async () => {
    rpcMock.mockResolvedValue({
      data: makeSnapshot({ dre: { ...snapshot.dre, grossRevenue: 0 } }),
      error: null,
    });
    const report = await executiveService.report("company-zero");
    expect(executiveService.rankings(report).customers.topProfitable.length).toBeGreaterThan(0);
  });
});

describe("executiveProvider", () => {
  it("entrega insights, resumo, alertas, métricas e sugestões", async () => {
    ok();
    const [insights, summary, alerts, metrics, suggestions] = await Promise.all([
      executiveProvider.getInsights(ctx),
      executiveProvider.getSummary(ctx),
      executiveProvider.getAlerts(ctx),
      executiveProvider.getMetrics(ctx),
      executiveProvider.getSuggestions(ctx),
    ]);
    expect(summary.headline).toContain("Receita");
    expect(summary.highlights.length).toBe(4);
    expect(metrics.length).toBeGreaterThan(0);
    expect(metrics.every((m) => typeof m.value === "string")).toBe(true);
    expect(insights.every((i) => i.id.startsWith("executive-"))).toBe(true);
    expect(Array.isArray(alerts)).toBe(true);
    expect(Array.isArray(suggestions)).toBe(true);
  });

  it("formata métricas em moeda, percentual e razão", async () => {
    ok();
    const metrics = await executiveProvider.getMetrics(ctx);
    const revenue = metrics.find((m) => m.key === "revenue")!;
    const margin = metrics.find((m) => m.key === "net_margin")!;
    const turnover = metrics.find((m) => m.key === "inventory_turnover")!;
    expect(revenue.value).toContain("R$");
    expect(margin.value).toContain("%");
    expect(turnover.value).toContain("x");
  });

  it("degrada com elegância quando a RPC falha", async () => {
    fail();
    expect(await executiveProvider.getInsights(ctx)).toEqual([]);
    expect(await executiveProvider.getAlerts(ctx)).toEqual([]);
    expect(await executiveProvider.getMetrics(ctx)).toEqual([]);
    expect(await executiveProvider.getSuggestions(ctx)).toEqual([]);
    const summary = await executiveProvider.getSummary(ctx);
    expect(summary.highlights).toEqual([]);
    expect(await executiveQuery.report("company-1")).toBeNull();
    expect(await executiveQuery.rankings("company-1")).toBeNull();
  });

  it("expõe rankings pelo query helper", async () => {
    ok();
    const rankings = await executiveQuery.rankings("company-1");
    expect(rankings?.products.topProfit[0].id).toBe("p1");
  });
});

describe("skills Bella CEO", () => {
  it("executa todas as skills com resposta textual", async () => {
    ok();
    for (const s of skillsModule.executiveSkills) {
      executiveService.invalidate();
      const res = await s.execute({}, ctx);
      expect(res.code).toBe("success");
      expect(String(res.message).length).toBeGreaterThan(0);
    }
  });

  it("retorna indisponível quando não há dados", async () => {
    fail();
    for (const s of skillsModule.executiveSkills) {
      const res = await s.execute({}, ctx);
      expect(res.code).toBe("module_unavailable");
    }
  });

  it("responde a cenários de stress sem quebrar", async () => {
    rpcMock.mockResolvedValue({
      data: makeSnapshot({
        dre: { ...snapshot.dre, netProfit: -20000, netMargin: -20, ebitda: -15000 },
        cash: { available: 0, receivable: 0, overdueReceivable: 9000, payable: 90000, overduePayable: 5000 },
        inventory: { value: 0, items: 0, staleItems: 50 },
        salesCount: 0,
      }),
      error: null,
    });
    for (const s of skillsModule.executiveSkills) {
      executiveService.invalidate();
      const res = await s.execute({}, ctx);
      expect(res.code).toBe("success");
    }
  });
});
