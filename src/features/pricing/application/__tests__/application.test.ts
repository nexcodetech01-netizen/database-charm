/**
 * Application Layer — tests
 * =========================
 * Mocks completos das portas. Nenhum I/O real.
 * Cobre: sucesso, validação, not-found, conflito, concorrência, tradução de
 * erro, idempotência e wiring de dependências.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  APPLICATION_VERSION,
  ApplicationError,
  createActivatePriceListUseCase,
  createApplySuggestedPriceUseCase,
  createCalculateSuggestedPriceUseCase,
  createCreateCategoryPolicyUseCase,
  createCreateCompanyPolicyUseCase,
  createCreatePriceListUseCase,
  createCreateProductPolicyUseCase,
  createDeactivatePriceListUseCase,
  createIdGenerator,
  createRegisterPricingDecisionUseCase,
  createResolvePricingUseCase,
  createUpdateCategoryPolicyUseCase,
  createUpdateCompanyPolicyUseCase,
  createUpdatePriceListUseCase,
  createUpdateProductPolicyUseCase,
  defaultEngine,
  defaultHasher,
  defaultResolver,
  invalidArgument,
  notFound,
  systemClock,
  validationFailed,
  type PricingApplicationDeps,
} from "..";
import { createInMemoryRepositories } from "../../persistence/in-memory";
import { RepositoryError } from "../../persistence/errors";
import type {
  PricingContext,
  PricingResult,
  PricingExplanation,
} from "../../engine/types";
import type { PricingContextBundle } from "../../resolver/pricing-context-factory";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const COMPANY = "company-1";
const CAT = "cat-1";
const PROD = "prod-1";
const clock = { nowIso: () => "2026-07-14T12:00:00.000Z" };
const ids = createIdGenerator(1000);

const companyInput = {
  companyId: COMPANY,
  currency: "BRL" as const,
  defaults: { minMarginPct: 10, idealMarginPct: 25, premiumMarginPct: 40 },
};
const categoryInput = { categoryId: CAT, name: "Bolsas", minMarginPct: 12 };
const productInput = { productId: PROD, sku: "SKU-1", priceFloorCents: 5000 };
const priceListInput = {
  priceListId: "pl-1",
  name: "Wholesale",
  currency: "BRL" as const,
  priority: 10,
  entries: [
    { productId: PROD, priceCents: 9900, currency: "BRL" as const },
  ],
};

function makeDeps(overrides: Partial<PricingApplicationDeps> = {}): PricingApplicationDeps {
  return {
    repositories: createInMemoryRepositories(),
    engine: defaultEngine,
    resolver: defaultResolver,
    clock,
    ids,
    hasher: defaultHasher,
    ...overrides,
  };
}

function fakeResult(over: Partial<PricingResult> = {}): PricingResult {
  return {
    resultVersion: "pricing-result/1",
    mode: "derived",
    minPriceCents: 6000,
    recommendedPriceCents: 8000,
    premiumPriceCents: 10000,
    targetPriceCents: 8500,
    finalPriceCents: 8500,
    costTotalCents: 5000,
    grossProfitCents: 3500,
    netProfitCents: 3000,
    marginPct: 35,
    markupPct: 70,
    appliedRules: [],
    policySource: {},
    engineVersion: "pricing-engine/1.0.0",
    calculationVersion: "calc/2026-07-A",
    policyVersion: "pol-hash",
    contextVersion: "pricing-context/1",
    requestId: "req-1",
    explainId: "exp-1",
    computedAt: "2026-07-14T12:00:00.000Z",
    currency: "BRL",
    warnings: [],
    ...over,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Meta / infra
// ─────────────────────────────────────────────────────────────────────────────

describe("application layer — meta", () => {
  it("exporta versão", () => {
    expect(APPLICATION_VERSION).toBe("pricing-application/1.0.0");
  });

  it("adapters default estão presentes", () => {
    expect(typeof defaultEngine.compute).toBe("function");
    expect(typeof defaultEngine.explain).toBe("function");
    expect(typeof defaultResolver.build).toBe("function");
    expect(typeof systemClock.nowIso()).toBe("string");
    expect(defaultHasher.hash({ a: 1, b: 2 })).toBe(defaultHasher.hash({ b: 2, a: 1 }));
    const g = createIdGenerator();
    expect(g.next("p")).not.toBe(g.next("p"));
  });
});

describe("application layer — errors", () => {
  it("fábricas geram códigos corretos", () => {
    expect(invalidArgument("x").code).toBe("INVALID_ARGUMENT");
    expect(notFound("X", "id").code).toBe("NOT_FOUND");
    expect(validationFailed("v", []).code).toBe("VALIDATION_FAILED");
  });

  it("ApplicationError preserva detail/cause/issues/warnings", () => {
    const cause = new Error("boom");
    const err = new ApplicationError("STORAGE_FAILURE", "m", {
      detail: { k: 1 },
      cause,
      issues: [],
      warnings: [],
    });
    expect(err.name).toBe("ApplicationError");
    expect(err.detail).toEqual({ k: 1 });
    expect(err.cause).toBe(cause);
    expect(err.issues).toEqual([]);
    expect(err.warnings).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Company policy
// ─────────────────────────────────────────────────────────────────────────────

describe("CreateCompanyPolicy", () => {
  let deps: PricingApplicationDeps;
  beforeEach(() => { deps = makeDeps(); });

  it("cria política e devolve versão 1", async () => {
    const uc = createCreateCompanyPolicyUseCase(deps);
    const out = await uc.execute({ input: companyInput, actor: { userId: "u1" } });
    expect(out.meta.version).toBe(1);
    expect(out.entity.companyId).toBe(COMPANY);
  });

  it("rejeita input ausente", async () => {
    const uc = createCreateCompanyPolicyUseCase(deps);
    // @ts-expect-error test
    await expect(uc.execute({})).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  it("rejeita política inválida", async () => {
    const uc = createCreateCompanyPolicyUseCase(deps);
    await expect(
      uc.execute({
        input: { ...companyInput, defaults: { minMarginPct: 90, idealMarginPct: 50, premiumMarginPct: 30 } },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("rejeita duplicata com CONFLICT", async () => {
    const uc = createCreateCompanyPolicyUseCase(deps);
    await uc.execute({ input: companyInput });
    await expect(uc.execute({ input: companyInput })).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  it("traduz erros de repositório", async () => {
    const failing = makeDeps({
      repositories: {
        ...createInMemoryRepositories(),
        companyPolicies: {
          findByCompany: async () => null,
          save: async () => { throw new RepositoryError("STORAGE_FAILURE", "db down"); },
          softDelete: async () => {},
          restore: async () => { throw new Error(); },
        },
      },
    });
    const uc = createCreateCompanyPolicyUseCase(failing);
    await expect(uc.execute({ input: companyInput })).rejects.toMatchObject({
      code: "STORAGE_FAILURE",
    });
  });

  it("traduz erro não-Repository em STORAGE_FAILURE", async () => {
    const failing = makeDeps({
      repositories: {
        ...createInMemoryRepositories(),
        companyPolicies: {
          findByCompany: async () => null,
          save: async () => { throw new Error("wat"); },
          softDelete: async () => {},
          restore: async () => { throw new Error(); },
        },
      },
    });
    const uc = createCreateCompanyPolicyUseCase(failing);
    await expect(uc.execute({ input: companyInput })).rejects.toMatchObject({
      code: "STORAGE_FAILURE",
    });
  });
});

describe("UpdateCompanyPolicy", () => {
  it("atualiza incrementando versão", async () => {
    const deps = makeDeps();
    const created = await createCreateCompanyPolicyUseCase(deps).execute({ input: companyInput });
    const uc = createUpdateCompanyPolicyUseCase(deps);
    const updated = await uc.execute({
      input: { ...companyInput, defaults: { minMarginPct: 5, idealMarginPct: 20, premiumMarginPct: 35 } },
      expectedVersion: created.meta.version,
    });
    expect(updated.meta.version).toBe(2);
  });

  it("rejeita expectedVersion inválido", async () => {
    const deps = makeDeps();
    const uc = createUpdateCompanyPolicyUseCase(deps);
    await expect(
      uc.execute({ input: companyInput, expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  it("rejeita quando inexistente", async () => {
    const deps = makeDeps();
    const uc = createUpdateCompanyPolicyUseCase(deps);
    await expect(
      uc.execute({ input: companyInput, expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejeita input inválido", async () => {
    const deps = makeDeps();
    await createCreateCompanyPolicyUseCase(deps).execute({ input: companyInput });
    const uc = createUpdateCompanyPolicyUseCase(deps);
    await expect(
      uc.execute({
        input: { ...companyInput, defaults: { minMarginPct: 90, idealMarginPct: 50, premiumMarginPct: 30 } },
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Category / Product policies
// ─────────────────────────────────────────────────────────────────────────────

describe("Category & Product policies", () => {
  it("cria + atualiza categoria", async () => {
    const deps = makeDeps();
    const created = await createCreateCategoryPolicyUseCase(deps).execute({
      companyId: COMPANY, input: categoryInput,
    });
    expect(created.meta.version).toBe(1);
    const updated = await createUpdateCategoryPolicyUseCase(deps).execute({
      companyId: COMPANY,
      input: { ...categoryInput, minMarginPct: 15 },
      expectedVersion: 1,
    });
    expect(updated.entity.minMarginPct).toBe(15);
  });

  it("categoria: rejeita duplicata + not found no update", async () => {
    const deps = makeDeps();
    await createCreateCategoryPolicyUseCase(deps).execute({ companyId: COMPANY, input: categoryInput });
    await expect(
      createCreateCategoryPolicyUseCase(deps).execute({ companyId: COMPANY, input: categoryInput }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      createUpdateCategoryPolicyUseCase(deps).execute({
        companyId: COMPANY,
        input: { ...categoryInput, categoryId: "other" },
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("categoria: rejeita companyId ausente", async () => {
    const deps = makeDeps();
    await expect(
      createCreateCategoryPolicyUseCase(deps).execute({ companyId: "", input: categoryInput }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    await expect(
      createUpdateCategoryPolicyUseCase(deps).execute({ companyId: COMPANY, input: categoryInput, expectedVersion: 0 }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  it("produto: cria + atualiza + duplicata + not-found", async () => {
    const deps = makeDeps();
    await createCreateProductPolicyUseCase(deps).execute({ companyId: COMPANY, input: productInput });
    await expect(
      createCreateProductPolicyUseCase(deps).execute({ companyId: COMPANY, input: productInput }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const upd = await createUpdateProductPolicyUseCase(deps).execute({
      companyId: COMPANY,
      input: { ...productInput, priceFloorCents: 6000 },
      expectedVersion: 1,
    });
    expect(upd.entity.priceFloorCents).toBe(6000);
    await expect(
      createUpdateProductPolicyUseCase(deps).execute({
        companyId: COMPANY,
        input: { ...productInput, productId: "other" },
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("produto: rejeita inputs inválidos", async () => {
    const deps = makeDeps();
    await expect(
      createCreateProductPolicyUseCase(deps).execute({
        companyId: COMPANY,
        input: { ...productInput, priceFloorCents: -1 },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await createCreateProductPolicyUseCase(deps).execute({ companyId: COMPANY, input: productInput });
    await expect(
      createUpdateProductPolicyUseCase(deps).execute({
        companyId: COMPANY,
        input: { ...productInput, priceFloorCents: -1 },
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    await expect(
      createUpdateProductPolicyUseCase(deps).execute({
        companyId: COMPANY, input: productInput, expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    await expect(
      createCreateProductPolicyUseCase(deps).execute({ companyId: "", input: productInput }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PriceList
// ─────────────────────────────────────────────────────────────────────────────

describe("PriceList use cases", () => {
  it("cria + atualiza + activate/deactivate", async () => {
    const deps = makeDeps();
    const created = await createCreatePriceListUseCase(deps).execute({
      companyId: COMPANY, input: priceListInput,
    });
    expect(created.meta.version).toBe(1);

    const upd = await createUpdatePriceListUseCase(deps).execute({
      companyId: COMPANY,
      input: { ...priceListInput, name: "Renamed" },
      expectedVersion: 1,
    });
    expect(upd.entity.name).toBe("Renamed");

    await createDeactivatePriceListUseCase(deps).execute({
      companyId: COMPANY, priceListId: priceListInput.priceListId,
    });
    const restored = await createActivatePriceListUseCase(deps).execute({
      companyId: COMPANY, priceListId: priceListInput.priceListId,
    });
    expect(restored.entity.priceListId).toBe(priceListInput.priceListId);
  });

  it("rejeita duplicata + not-found + invalid args", async () => {
    const deps = makeDeps();
    await createCreatePriceListUseCase(deps).execute({ companyId: COMPANY, input: priceListInput });
    await expect(
      createCreatePriceListUseCase(deps).execute({ companyId: COMPANY, input: priceListInput }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      createUpdatePriceListUseCase(deps).execute({
        companyId: COMPANY,
        input: { ...priceListInput, priceListId: "other" },
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      createUpdatePriceListUseCase(deps).execute({
        companyId: COMPANY, input: priceListInput, expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    await expect(
      createCreatePriceListUseCase(deps).execute({ companyId: "", input: priceListInput }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    await expect(
      createActivatePriceListUseCase(deps).execute({ companyId: "", priceListId: "x" }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    await expect(
      createDeactivatePriceListUseCase(deps).execute({ companyId: "", priceListId: "x" }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  it("rejeita aggregate inválido (entries vazio)", async () => {
    const deps = makeDeps();
    await expect(
      createCreatePriceListUseCase(deps).execute({
        companyId: COMPANY,
        input: { ...priceListInput, entries: [] },
      }),
    ).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
  });

  it("traduz falha de infra em softDelete", async () => {
    const inmem = createInMemoryRepositories();
    const failing = makeDeps({
      repositories: {
        ...inmem,
        priceLists: {
          ...inmem.priceLists,
          softDelete: async () => { throw new RepositoryError("STORAGE_FAILURE", "db"); },
        },
      },
    });
    await expect(
      createDeactivatePriceListUseCase(failing).execute({
        companyId: COMPANY, priceListId: "pl-1",
      }),
    ).rejects.toMatchObject({ code: "STORAGE_FAILURE" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ResolvePricing / CalculateSuggestedPrice / ApplySuggestedPrice
// ─────────────────────────────────────────────────────────────────────────────

async function seedPolicies(deps: PricingApplicationDeps) {
  await createCreateCompanyPolicyUseCase(deps).execute({ input: companyInput });
  await createCreateCategoryPolicyUseCase(deps).execute({ companyId: COMPANY, input: categoryInput });
  await createCreateProductPolicyUseCase(deps).execute({ companyId: COMPANY, input: productInput });
}

function pricingContextInputBase() {
  return {
    companyId: COMPANY,
    productId: PROD,
    categoryId: CAT,
    quantity: 1,
    context: {
      costComposition: {
        version: "cost-composition/1" as const,
        perUnitCostCents: 5000,
        computedAt: "2026-07-14T12:00:00.000Z",
        origin: "manual" as const,
      },
      clock: { now: "2026-07-14T12:00:00.000Z" },
      requestedBy: { userId: "u1", module: "test" },
    },
  };
}

describe("ResolvePricing", () => {
  it("monta bundle a partir das políticas persistidas", async () => {
    const deps = makeDeps();
    await seedPolicies(deps);
    const uc = createResolvePricingUseCase(deps);
    const bundle = await uc.execute(pricingContextInputBase());
    expect(bundle.context.company.id).toBe(COMPANY);
    expect(bundle.context.product.id).toBe(PROD);
    expect(bundle.resolution.resolverVersion).toBeDefined();
  });

  it("gera requestId quando ausente", async () => {
    const deps = makeDeps();
    await seedPolicies(deps);
    const uc = createResolvePricingUseCase(deps);
    const bundle = await uc.execute(pricingContextInputBase());
    expect(bundle.context.requestId).toMatch(/^req_/);
  });

  it("propaga requestId explícito", async () => {
    const deps = makeDeps();
    await seedPolicies(deps);
    const uc = createResolvePricingUseCase(deps);
    const bundle = await uc.execute({ ...pricingContextInputBase(), requestId: "req-x" });
    expect(bundle.context.requestId).toBe("req-x");
  });

  it("rejeita quando company/product ausente", async () => {
    const deps = makeDeps();
    const uc = createResolvePricingUseCase(deps);
    await expect(uc.execute(pricingContextInputBase())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await createCreateCompanyPolicyUseCase(deps).execute({ input: companyInput });
    await expect(uc.execute(pricingContextInputBase())).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("rejeita quantidade/companyId/productId inválidos", async () => {
    const deps = makeDeps();
    const uc = createResolvePricingUseCase(deps);
    await expect(uc.execute({ ...pricingContextInputBase(), companyId: "" })).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(uc.execute({ ...pricingContextInputBase(), productId: "" })).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(uc.execute({ ...pricingContextInputBase(), quantity: 0 })).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    // @ts-expect-error test
    await expect(uc.execute({ ...pricingContextInputBase(), context: null })).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
  });

  it("agrega PriceLists ativas nas candidatas", async () => {
    const deps = makeDeps();
    await seedPolicies(deps);
    await createCreatePriceListUseCase(deps).execute({ companyId: COMPANY, input: priceListInput });
    const spy = vi.spyOn(deps.resolver, "build");
    await createResolvePricingUseCase(deps).execute(pricingContextInputBase());
    const arg = spy.mock.calls[0]![0];
    expect(arg.priceListCandidates?.length).toBe(1);
    spy.mockRestore();
  });
});

describe("CalculateSuggestedPrice", () => {
  it("delega para engine.compute com bundle resolvido", async () => {
    const stubResult = fakeResult();
    const stubBundle = {
      context: { requestId: "req-1" } as unknown as PricingContext,
      resolution: {} as PricingContextBundle["resolution"],
    };
    const deps = makeDeps({
      resolver: { build: () => stubBundle },
      engine: {
        compute: vi.fn().mockReturnValue(stubResult),
        explain: vi.fn(),
      },
    });
    await seedPolicies(deps);
    const out = await createCalculateSuggestedPriceUseCase(deps).execute(
      pricingContextInputBase(),
    );
    expect(out.result).toBe(stubResult);
    expect(deps.engine.compute).toHaveBeenCalledWith(stubBundle.context);
  });
});

describe("ApplySuggestedPrice", () => {
  it("devolve command + snapshot; não persiste", async () => {
    const result = fakeResult();
    const explanation: PricingExplanation = {
      explanationVersion: "pricing-explanation/1",
      explainId: result.explainId,
      requestId: result.requestId,
      engineVersion: result.engineVersion,
      calculationVersion: result.calculationVersion,
      policyVersion: result.policyVersion,
      mode: "derived",
      summary: "",
      steps: [],
      policyResolutionTree: {},
      invariantsChecked: [],
      warnings: [],
    };
    const deps = makeDeps({
      resolver: {
        build: () => ({
          context: { requestId: "req-1" } as unknown as PricingContext,
          resolution: {} as PricingContextBundle["resolution"],
        }),
      },
      engine: {
        compute: () => result,
        explain: () => explanation,
      },
    });
    await seedPolicies(deps);
    const out = await createApplySuggestedPriceUseCase(deps).execute({
      ...pricingContextInputBase(),
      actor: { userId: "u1" },
    });
    expect(out.command.priceCents).toBe(result.finalPriceCents);
    expect(out.command.strategy).toBe("final");
    expect(out.snapshot.snapshotHash).toBeDefined();
    expect(out.snapshot.createdBy).toBe("u1");
    expect(out.snapshot.explanation).toBe(explanation);
    // nenhuma decisão gravada
    const list = await deps.repositories.pricingDecisions.query({ companyId: COMPANY });
    expect(list).toHaveLength(0);
  });

  it("aplica estratégias min/recommended/premium/target/final", async () => {
    const result = fakeResult();
    const deps = makeDeps({
      resolver: {
        build: () => ({
          context: {} as PricingContext,
          resolution: {} as PricingContextBundle["resolution"],
        }),
      },
      engine: { compute: () => result, explain: () => ({} as PricingExplanation) },
    });
    await seedPolicies(deps);
    const uc = createApplySuggestedPriceUseCase(deps);
    const base = pricingContextInputBase();
    expect((await uc.execute({ ...base, strategy: "min" })).command.priceCents).toBe(6000);
    expect((await uc.execute({ ...base, strategy: "recommended" })).command.priceCents).toBe(8000);
    expect((await uc.execute({ ...base, strategy: "premium" })).command.priceCents).toBe(10000);
    expect((await uc.execute({ ...base, strategy: "target" })).command.priceCents).toBe(8500);
    expect((await uc.execute({ ...base, strategy: "final" })).command.priceCents).toBe(8500);
  });

  it("rejeita preço inválido para estratégia", async () => {
    const result = fakeResult({ finalPriceCents: Number.NaN });
    const deps = makeDeps({
      resolver: {
        build: () => ({
          context: {} as PricingContext,
          resolution: {} as PricingContextBundle["resolution"],
        }),
      },
      engine: { compute: () => result, explain: () => ({} as PricingExplanation) },
    });
    await seedPolicies(deps);
    await expect(
      createApplySuggestedPriceUseCase(deps).execute(pricingContextInputBase()),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RegisterPricingDecision
// ─────────────────────────────────────────────────────────────────────────────

describe("RegisterPricingDecision", () => {
  const snap = {
    companyId: COMPANY,
    requestId: "req-1",
    explainId: "exp-1",
    engineVersion: "pricing-engine/1.0.0",
    calculationVersion: "calc/2026-07-A",
    contextVersion: "pricing-context/1",
    resultVersion: "pricing-result/1",
    policyVersion: "pol-1",
    snapshotHash: "h",
    appliedRules: [],
    warnings: [],
    context: {} as PricingContext,
    result: {} as PricingResult,
  };

  it("append quando não existe", async () => {
    const deps = makeDeps();
    const uc = createRegisterPricingDecisionUseCase(deps);
    const stored = await uc.execute({ snapshot: snap });
    expect(stored.snapshot.explainId).toBe("exp-1");
  });

  it("idempotente por (companyId, explainId)", async () => {
    const deps = makeDeps();
    const uc = createRegisterPricingDecisionUseCase(deps);
    const a = await uc.execute({ snapshot: snap });
    const b = await uc.execute({ snapshot: snap });
    expect(b.id).toBe(a.id);
    const list = await deps.repositories.pricingDecisions.query({ companyId: COMPANY });
    expect(list).toHaveLength(1);
  });

  it("rejeita snapshot inválido", async () => {
    const deps = makeDeps();
    const uc = createRegisterPricingDecisionUseCase(deps);
    // @ts-expect-error test
    await expect(uc.execute({})).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    await expect(
      uc.execute({ snapshot: { ...snap, companyId: "" } }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    await expect(
      uc.execute({ snapshot: { ...snap, explainId: "" } }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    await expect(
      uc.execute({ snapshot: { ...snap, requestId: "" } }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    await expect(
      uc.execute({ snapshot: { ...snap, snapshotHash: "" } }),
    ).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  it("traduz erros de repositório", async () => {
    const failing = makeDeps({
      repositories: {
        ...createInMemoryRepositories(),
        pricingDecisions: {
          findByExplainId: async () => null,
          append: async () => { throw new RepositoryError("STORAGE_FAILURE", "db"); },
          query: async () => [],
        },
      },
    });
    await expect(
      createRegisterPricingDecisionUseCase(failing).execute({ snapshot: snap }),
    ).rejects.toMatchObject({ code: "STORAGE_FAILURE" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cobertura extra — tradução de erros em save() de category/product/price-list
// ─────────────────────────────────────────────────────────────────────────────

describe("repo error translation across use cases", () => {
  function repoThrowingOnSave(kind: "categoryPolicies" | "productPolicies" | "priceLists") {
    const inmem = createInMemoryRepositories();
    return makeDeps({
      repositories: {
        ...inmem,
        [kind]: new Proxy(inmem[kind], {
          get(target, prop) {
            if (prop === "save") {
              return async () => { throw new RepositoryError("STORAGE_FAILURE", "db"); };
            }
            return (target as unknown as Record<string, unknown>)[prop as string];
          },
        }),
      },
    });
  }

  it("category create/update repassam STORAGE_FAILURE", async () => {
    const c = repoThrowingOnSave("categoryPolicies");
    await expect(
      createCreateCategoryPolicyUseCase(c).execute({ companyId: COMPANY, input: categoryInput }),
    ).rejects.toMatchObject({ code: "STORAGE_FAILURE" });

    const ok = makeDeps();
    await createCreateCategoryPolicyUseCase(ok).execute({ companyId: COMPANY, input: categoryInput });
    const failing = makeDeps({
      repositories: {
        ...ok.repositories,
        categoryPolicies: new Proxy(ok.repositories.categoryPolicies, {
          get(t, p) {
            if (p === "save") return async () => { throw new Error("boom"); };
            return (t as unknown as Record<string, unknown>)[p as string];
          },
        }),
      },
    });
    await expect(
      createUpdateCategoryPolicyUseCase(failing).execute({
        companyId: COMPANY, input: categoryInput, expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "STORAGE_FAILURE" });
  });

  it("product create/update repassam STORAGE_FAILURE", async () => {
    const c = repoThrowingOnSave("productPolicies");
    await expect(
      createCreateProductPolicyUseCase(c).execute({ companyId: COMPANY, input: productInput }),
    ).rejects.toMatchObject({ code: "STORAGE_FAILURE" });

    const ok = makeDeps();
    await createCreateProductPolicyUseCase(ok).execute({ companyId: COMPANY, input: productInput });
    const failing = makeDeps({
      repositories: {
        ...ok.repositories,
        productPolicies: new Proxy(ok.repositories.productPolicies, {
          get(t, p) {
            if (p === "save") return async () => { throw new RepositoryError("STORAGE_FAILURE", "db"); };
            return (t as unknown as Record<string, unknown>)[p as string];
          },
        }),
      },
    });
    await expect(
      createUpdateProductPolicyUseCase(failing).execute({
        companyId: COMPANY, input: productInput, expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "STORAGE_FAILURE" });
  });

  it("price-list create/update/activate repassam STORAGE_FAILURE", async () => {
    const c = repoThrowingOnSave("priceLists");
    await expect(
      createCreatePriceListUseCase(c).execute({ companyId: COMPANY, input: priceListInput }),
    ).rejects.toMatchObject({ code: "STORAGE_FAILURE" });

    const ok = makeDeps();
    await createCreatePriceListUseCase(ok).execute({ companyId: COMPANY, input: priceListInput });
    const failing = makeDeps({
      repositories: {
        ...ok.repositories,
        priceLists: new Proxy(ok.repositories.priceLists, {
          get(t, p) {
            if (p === "save" || p === "restore") {
              return async () => { throw new RepositoryError("STORAGE_FAILURE", "db"); };
            }
            return (t as unknown as Record<string, unknown>)[p as string];
          },
        }),
      },
    });
    await expect(
      createUpdatePriceListUseCase(failing).execute({
        companyId: COMPANY, input: priceListInput, expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "STORAGE_FAILURE" });
    await expect(
      createActivatePriceListUseCase(failing).execute({
        companyId: COMPANY, priceListId: priceListInput.priceListId,
      }),
    ).rejects.toMatchObject({ code: "STORAGE_FAILURE" });
  });

  it("update-company-policy traduz erro de save", async () => {
    const deps = makeDeps();
    await createCreateCompanyPolicyUseCase(deps).execute({ input: companyInput });
    const failing = makeDeps({
      repositories: {
        ...deps.repositories,
        companyPolicies: new Proxy(deps.repositories.companyPolicies, {
          get(t, p) {
            if (p === "save") return async () => { throw new RepositoryError("CONCURRENCY", "v"); };
            return (t as unknown as Record<string, unknown>)[p as string];
          },
        }),
      },
    });
    await expect(
      createUpdateCompanyPolicyUseCase(failing).execute({
        input: companyInput, expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: "CONCURRENCY" });
  });

  it("defaultResolver.build integra com engine real", () => {
    // executa uma vez para cobrir linhas 25-26 do adapters.ts
    const inputBundle = defaultResolver.build({
      company: {
        companyId: COMPANY, currency: "BRL",
        defaults: { minMarginPct: 10, idealMarginPct: 25, premiumMarginPct: 40 },
      },
      product: { productId: PROD },
      quantity: 1,
      costComposition: {
        version: "cost-composition/1",
        perUnitCostCents: 5000,
        computedAt: "2026-07-14T12:00:00.000Z",
      },
      clock: { now: "2026-07-14T12:00:00.000Z" },
      requestId: "req-x",
      requestedBy: { module: "test" },
    });
    expect(inputBundle.context.company.id).toBe(COMPANY);
    const r = defaultEngine.compute(inputBundle.context);
    defaultEngine.explain(r);
    expect(r.resultVersion).toBeDefined();
  });
});
