import { describe, expect, it, vi } from "vitest";
import { createBellaContext } from "../context/bella-context";
import { makeTestServices, testPeriod, testToday } from "./fixtures";

describe("accounting-ai · BellaContext (Sprint 7.2.1)", () => {
  it("resolve os três retratos e memoiza cada leitura", async () => {
    const ctx = createBellaContext({
      companyId: "c1",
      period: testPeriod,
      today: testToday,
      services: makeTestServices(),
    });

    const snapshots = await ctx.snapshots();
    expect(snapshots.summary.period.start).toBe(testPeriod.start);
    expect(snapshots.tax).toBeTruthy();
    expect(snapshots.audit).toBeTruthy();

    // Segundas leituras não disparam novo carregamento.
    await ctx.summary();
    await ctx.tax();
    await ctx.audit();
    await ctx.snapshots();
    expect(ctx.stats).toEqual({ summary: 1, tax: 1, audit: 1 });
  });

  it("é lazy: nada é lido antes do primeiro consumo", () => {
    const services = makeTestServices();
    const dre = vi.spyOn(services.accounting, "dre");
    createBellaContext({ companyId: "c1", period: testPeriod, services });
    expect(dre).not.toHaveBeenCalled();
  });

  it("reaproveita retratos pré-carregados sem consultar de novo", async () => {
    const seed = createBellaContext({
      companyId: "c1",
      period: testPeriod,
      today: testToday,
      services: makeTestServices(),
    });
    const preloaded = await seed.snapshots();

    const ctx = createBellaContext({
      companyId: "c1",
      period: testPeriod,
      today: testToday,
      services: makeTestServices(),
      preloaded,
    });
    await ctx.snapshots();
    expect(ctx.stats).toEqual({ summary: 0, tax: 0, audit: 0 });
  });

  it("toDeps() devolve ProviderDeps equivalente ao contrato atual", async () => {
    const ctx = createBellaContext({
      companyId: "c1",
      period: testPeriod,
      today: testToday,
      services: makeTestServices(),
    });
    expect(ctx.toDeps().summary).toBeNull();

    await ctx.snapshots();
    const deps = ctx.toDeps();
    expect(deps.period).toEqual(testPeriod);
    expect(deps.today).toBe(testToday);
    expect(deps.summary).not.toBeNull();
    expect(deps.taxSnapshot).not.toBeNull();
    expect(deps.auditSnapshot).not.toBeNull();
    expect(ctx.toDeps({ simulation: { growthPct: 10 } }).simulation).toEqual({
      growthPct: 10,
    });
  });

  it("não cacheia falhas — permite nova tentativa", async () => {
    const services = makeTestServices();
    let calls = 0;
    services.accounting.dre = async () => {
      calls += 1;
      throw new Error("indisponível");
    };
    const ctx = createBellaContext({ companyId: "c1", period: testPeriod, services });
    const first = await ctx.summary();
    expect(first.revenue.available).toBe(false);
    expect(calls).toBeGreaterThan(0);
  });
});
