import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
const builder: Record<string, unknown> = {};
const result: { data: unknown; error: unknown } = { data: null, error: null };

function makeBuilder() {
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => Promise.resolve(result)),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
    single: vi.fn(() => Promise.resolve(result)),
    then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
  };
  Object.assign(builder, chain);
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (name: string, params: unknown) => rpc(name, params),
    from: () => makeBuilder(),
  },
}));

const { taxService, toCompetence } = await import("../tax.service");

const profileRow = {
  id: "p1",
  company_id: "c1",
  tax_regime: "simples_nacional",
  simples_annex: "I",
  rbt12: "300000",
  effective_rate: "5.32",
  nominal_rate: "7.30",
  icms_regime: "simples",
  pis_regime: "simples",
  cofins_regime: "simples",
  iss_regime: "nao_aplicavel",
  ipi_regime: "nao_aplicavel",
  due_day: 20,
  start_date: "2026-01-01",
  active: true,
};

beforeEach(() => {
  rpc.mockReset();
  result.data = null;
  result.error = null;
});

describe("toCompetence", () => {
  it("normaliza para o primeiro dia do mês", () => {
    expect(toCompetence("2026-07-18")).toBe("2026-07-01");
    expect(toCompetence(new Date("2026-03-31T00:00:00"))).toBe("2026-03-01");
  });
});

describe("perfil tributário", () => {
  it("mapeia o perfil ativo", async () => {
    result.data = profileRow;
    const profile = await taxService.getProfile("c1");
    expect(profile).toMatchObject({
      id: "p1",
      companyId: "c1",
      taxRegime: "simples_nacional",
      simplesAnnex: "I",
      rbt12: 300000,
      effectiveRate: 5.32,
      dueDay: 20,
      active: true,
    });
  });

  it("devolve null quando não há perfil", async () => {
    result.data = null;
    expect(await taxService.getProfile("c1")).toBeNull();
  });

  it("propaga erro do banco", async () => {
    result.error = { message: "boom" };
    await expect(taxService.getProfile("c1")).rejects.toBeTruthy();
  });

  it("atualiza quando já existe e insere quando não existe", async () => {
    result.data = profileRow;
    const updated = await taxService.upsertProfile("c1", {
      taxRegime: "simples_nacional",
      simplesAnnex: "I",
      startDate: "2026-01-01",
      effectiveRate: 5.32,
      nominalRate: 7.3,
    });
    expect(updated.companyId).toBe("c1");
    expect(builder.update).toHaveBeenCalled();

    result.data = { ...profileRow, tax_regime: "lucro_presumido", simples_annex: null };
    const created = await taxService.upsertProfile("c2", { taxRegime: "lucro_presumido" });
    expect(created.taxRegime).toBe("lucro_presumido");
    expect(created.simplesAnnex).toBeNull();
  });
});

describe("bases reais e motor do Simples", () => {
  it("lê RBT12 e receita do mês via RPC", async () => {
    rpc.mockResolvedValueOnce({ data: "300000", error: null });
    expect(await taxService.rbt12("c1", "2026-07-01")).toBe(300000);

    rpc.mockResolvedValueOnce({ data: 25000, error: null });
    expect(await taxService.monthlyRevenue("c1", "2026-07-01")).toBe(25000);
  });

  it("propaga erro do RPC de RBT12", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "denied" } });
    await expect(taxService.rbt12("c1")).rejects.toBeTruthy();
  });

  it("mapeia o cálculo do Simples", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        annex: "I",
        bracket: 2,
        rbt12: 300000,
        revenue: 25000,
        nominal_rate: 7.3,
        deduction: 5940,
        effective_rate: 5.32,
        tax_amount: 1330,
        limit_usage_pct: 6.25,
      },
      error: null,
    });
    const calc = await taxService.simulateSimples("I", 300000, 25000);
    expect(calc).toMatchObject({ annex: "I", bracket: 2, effectiveRate: 5.32, taxAmount: 1330 });
  });

  it("propaga erro do cálculo", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "anexo inválido" } });
    await expect(taxService.simulateSimples("I", 0, 0)).rejects.toBeTruthy();
  });
});

describe("apuração", () => {
  it("gera a apuração e mapeia o retorno", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        id: "ap1",
        competence: "2026-07-01",
        tax_regime: "simples_nacional",
        annex: "I",
        bracket: 2,
        revenue: 25000,
        rbt12: 300000,
        nominal_rate: 7.3,
        deduction: 5940,
        effective_rate: 5.32,
        tax_amount: 1330,
        due_date: "2026-08-20",
        status: "open",
        entry_id: "e1",
      },
      error: null,
    });
    const ap = await taxService.generateApportionment("c1", "2026-07-18");
    expect(rpc).toHaveBeenCalledWith("generate_tax_apportionment", {
      _company_id: "c1",
      _competence: "2026-07-01",
      _close: false,
    });
    expect(ap).toMatchObject({
      id: "ap1",
      companyId: "c1",
      simplesAnnex: "I",
      taxAmount: 1330,
      entryId: "e1",
      status: "open",
    });
  });

  it("propaga erro de apuração", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "sem perfil" } });
    await expect(taxService.generateApportionment("c1")).rejects.toBeTruthy();
  });

  it("lista o histórico", async () => {
    result.data = [
      { id: "a1", company_id: "c1", competence: "2026-07-01", tax_amount: "1330", status: "open" },
    ];
    const list = await taxService.listApportionments("c1");
    expect(list).toHaveLength(1);
    expect(list[0].taxAmount).toBe(1330);
    expect(list[0].bracket).toBeNull();
    expect(list[0].dueDate).toBeNull();
  });

  it("busca uma competência específica", async () => {
    result.data = { id: "a1", company_id: "c1", competence: "2026-07-01", status: "closed" };
    const ap = await taxService.getApportionment("c1", "2026-07-31");
    expect(ap?.status).toBe("closed");

    result.data = null;
    expect(await taxService.getApportionment("c1", "2026-07-01")).toBeNull();
  });

  it("marca como paga", async () => {
    result.data = null;
    await expect(taxService.markAsPaid("a1")).resolves.toBeUndefined();
    result.error = { message: "imutável" };
    await expect(taxService.markAsPaid("a1")).rejects.toBeTruthy();
  });

  it("propaga erro de listagem", async () => {
    result.error = { message: "denied" };
    await expect(taxService.listApportionments("c1")).rejects.toBeTruthy();
  });
});

describe("projeções", () => {
  it("mapeia cenários do RPC", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        competence: "2026-07-01",
        base_revenue: 25000,
        rbt12: 300000,
        scenarios: [
          {
            growth_pct: 10,
            revenue: 27500,
            tax_amount: 1500,
            effective_rate: 5.45,
            bracket: 2,
            cogs: 11000,
            operating_expenses: 5000,
            net_profit: 10000,
            net_margin: 36.36,
          },
        ],
      },
      error: null,
    });
    const projection = await taxService.projectScenarios("c1", "2026-07-01");
    expect(projection.baseRevenue).toBe(25000);
    expect(projection.scenarios[0]).toMatchObject({ growthPct: 10, netProfit: 10000, bracket: 2 });
  });

  it("tolera retorno sem cenários", async () => {
    rpc.mockResolvedValueOnce({ data: {}, error: null });
    const projection = await taxService.projectScenarios("c1");
    expect(projection.scenarios).toEqual([]);
  });

  it("propaga erro de projeção", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "sem perfil" } });
    await expect(taxService.projectScenarios("c1")).rejects.toBeTruthy();
  });
});
