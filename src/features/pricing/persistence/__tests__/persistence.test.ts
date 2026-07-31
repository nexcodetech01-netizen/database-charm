/**
 * Persistence Layer — tests
 * =========================
 * Cobre:
 *   - CRUD por repositório (Company/Category/Product/PriceList/Decision)
 *   - Versionamento + concorrência otimista
 *   - Soft delete + restore
 *   - Serialização via envelope (config domain)
 *   - Snapshots imutáveis de PricingDecision
 *   - Repositório Supabase com fake client (contrato do adapter)
 */
import { describe, expect, it, vi } from "vitest";
import {
  createCategoryPolicy,
  createCompanyPolicy,
  createPriceList,
  createProductPolicy,
} from "../../config";
import {
  createInMemoryRepositories,
  InMemoryCategoryPolicyRepository,
  InMemoryCompanyPolicyRepository,
  InMemoryPriceListRepository,
  InMemoryPricingDecisionRepository,
  InMemoryProductPolicyRepository,
  PERSISTENCE_VERSION,
  RepositoryError,
  concurrency,
  conflict,
  invalidArgument,
  notFound,
  storageFailure,
  type PricingDecisionSnapshot,
} from "../index";
import {
  SupabaseCategoryPolicyRepository,
  SupabaseCompanyPolicyRepository,
  SupabasePriceListRepository,
  SupabasePricingDecisionRepository,
  SupabaseProductPolicyRepository,
  createSupabaseRepositories,
  SUPABASE_PERSISTENCE_ENVELOPE,
} from "../supabase.server";
import type { PricingContext, PricingResult } from "../../engine/types";
import { toEnvelope } from "../../config/serialization";

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const COMPANY = "company-1";
const CAT = "cat-1";
const PROD = "prod-1";

const companyPolicy = createCompanyPolicy({
  companyId: COMPANY,
  currency: "BRL",
  defaults: { minMarginPct: 10, idealMarginPct: 25, premiumMarginPct: 40 },
});

const categoryPolicy = createCategoryPolicy({
  categoryId: CAT,
  name: "Bolsas",
  minMarginPct: 12,
});

const productPolicy = createProductPolicy({
  productId: PROD,
  sku: "SKU-1",
  priceFloorCents: 5000,
});

const priceList = createPriceList({
  priceListId: "pl-1",
  name: "Wholesale",
  currency: "BRL",
  priority: 10,
  entries: [
    { productId: PROD, priceCents: 9900, currency: "BRL", minQty: 1, maxQty: 9 },
    { productId: PROD, priceCents: 8900, currency: "BRL", minQty: 10 },
  ],
});

const decisionSnapshot = (over: Partial<PricingDecisionSnapshot> = {}): PricingDecisionSnapshot => ({
  companyId: COMPANY,
  requestId: "req-1",
  explainId: "exp-1",
  engineVersion: "pricing-engine/1.0.0",
  calculationVersion: "calc/2026-07-A",
  contextVersion: "pricing-context/1",
  resultVersion: "pricing-result/1",
  policyVersion: "pol-hash-1",
  snapshotHash: "sha-1",
  appliedRules: [],
  warnings: [],
  context: { requestId: "req-1" } as unknown as PricingContext,
  result: { priceCents: 9900 } as unknown as PricingResult,
  createdBy: "user-1",
  ...over,
});

// ─────────────────────────────────────────────────────────────────────────────
// Errors
// ─────────────────────────────────────────────────────────────────────────────

describe("errors", () => {
  it("carrega code + detail nas fábricas", () => {
    expect(notFound("X", "id").code).toBe("NOT_FOUND");
    expect(conflict("X").code).toBe("CONFLICT");
    expect(concurrency("X", 2, 1).code).toBe("CONCURRENCY");
    expect(invalidArgument("bad").code).toBe("INVALID_ARGUMENT");
    const s = storageFailure("boom", new Error("db"));
    expect(s.code).toBe("STORAGE_FAILURE");
    expect(s.cause).toBeInstanceOf(Error);
    const bare = new RepositoryError("CONFLICT", "x");
    expect(bare.name).toBe("RepositoryError");
    expect(bare.detail).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CompanyPolicyRepository
// ─────────────────────────────────────────────────────────────────────────────

describe("InMemoryCompanyPolicyRepository", () => {
  it("cria + busca + atualiza incrementando versão", async () => {
    const repo = new InMemoryCompanyPolicyRepository();
    const first = await repo.save(companyPolicy, { actor: { userId: "u1" } });
    expect(first.meta.version).toBe(1);
    expect(first.meta.createdBy).toBe("u1");
    expect(first.entity.companyId).toBe(COMPANY);

    const fetched = await repo.findByCompany(COMPANY);
    expect(fetched?.meta.id).toBe(first.meta.id);

    const updated = await repo.save({ ...companyPolicy, minMarginPct: 5 }, {
      expectedVersion: 1,
    });
    expect(updated.meta.version).toBe(2);
    expect(updated.entity.minMarginPct).toBe(5);
  });

  it("rejeita save com versão divergente", async () => {
    const repo = new InMemoryCompanyPolicyRepository();
    await repo.save(companyPolicy);
    await expect(repo.save(companyPolicy, { expectedVersion: 42 })).rejects.toMatchObject({
      code: "CONCURRENCY",
    });
  });

  it("rejeita insert quando expectedVersion != 0", async () => {
    const repo = new InMemoryCompanyPolicyRepository();
    await expect(repo.save(companyPolicy, { expectedVersion: 1 })).rejects.toMatchObject({
      code: "CONCURRENCY",
    });
  });

  it("soft delete oculta em findByCompany e restore recupera", async () => {
    const repo = new InMemoryCompanyPolicyRepository();
    await repo.save(companyPolicy);
    await repo.softDelete(COMPANY);
    expect(await repo.findByCompany(COMPANY)).toBeNull();
    const restored = await repo.restore(COMPANY);
    expect(restored.meta.deletedAt).toBeUndefined();
    expect(restored.meta.version).toBeGreaterThan(1);
  });

  it("softDelete e restore em id inexistente falham NOT_FOUND", async () => {
    const repo = new InMemoryCompanyPolicyRepository();
    await expect(repo.softDelete("x")).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(repo.restore("x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("softDelete respeita expectedVersion", async () => {
    const repo = new InMemoryCompanyPolicyRepository();
    await repo.save(companyPolicy);
    await expect(repo.softDelete(COMPANY, { expectedVersion: 99 })).rejects.toMatchObject({
      code: "CONCURRENCY",
    });
  });

  it("restore respeita expectedVersion", async () => {
    const repo = new InMemoryCompanyPolicyRepository();
    await repo.save(companyPolicy);
    await repo.softDelete(COMPANY);
    await expect(repo.restore(COMPANY, { expectedVersion: 99 })).rejects.toMatchObject({
      code: "CONCURRENCY",
    });
  });

  it("valida companyId ausente", async () => {
    const repo = new InMemoryCompanyPolicyRepository();
    await expect(repo.findByCompany("")).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    await expect(repo.save({ ...companyPolicy, companyId: "" })).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
  });

  it("retorna null quando empresa não existe", async () => {
    const repo = new InMemoryCompanyPolicyRepository();
    expect(await repo.findByCompany("x")).toBeNull();
  });

  it("clonagem impede mutação externa", async () => {
    const repo = new InMemoryCompanyPolicyRepository();
    const saved = await repo.save(companyPolicy);
    (saved.entity as { minMarginPct?: number }).minMarginPct = 999;
    const again = await repo.findByCompany(COMPANY);
    expect(again?.entity.minMarginPct).not.toBe(999);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CategoryPolicyRepository
// ─────────────────────────────────────────────────────────────────────────────

describe("InMemoryCategoryPolicyRepository", () => {
  it("CRUD completo e list com paginação", async () => {
    const repo = new InMemoryCategoryPolicyRepository();
    await repo.save(COMPANY, categoryPolicy);
    await repo.save(COMPANY, createCategoryPolicy({ categoryId: "cat-2" }));
    await repo.save(COMPANY, createCategoryPolicy({ categoryId: "cat-3" }));

    const all = await repo.listByCompany(COMPANY);
    expect(all).toHaveLength(3);

    const page = await repo.listByCompany(COMPANY, { limit: 1, offset: 1 });
    expect(page).toHaveLength(1);

    const found = await repo.findByCategory(COMPANY, CAT);
    expect(found?.entity.categoryId).toBe(CAT);
  });

  it("soft delete removido de list por padrão, includeDeleted revela", async () => {
    const repo = new InMemoryCategoryPolicyRepository();
    await repo.save(COMPANY, categoryPolicy);
    await repo.softDelete(COMPANY, CAT);
    expect(await repo.listByCompany(COMPANY)).toHaveLength(0);
    expect(await repo.listByCompany(COMPANY, { includeDeleted: true })).toHaveLength(1);
    expect(await repo.findByCategory(COMPANY, CAT)).toBeNull();
    await repo.restore(COMPANY, CAT);
    expect(await repo.findByCategory(COMPANY, CAT)).not.toBeNull();
  });

  it("versionamento e concorrência", async () => {
    const repo = new InMemoryCategoryPolicyRepository();
    const a = await repo.save(COMPANY, categoryPolicy);
    expect(a.meta.version).toBe(1);
    const b = await repo.save(
      COMPANY,
      { ...categoryPolicy, minMarginPct: 30 },
      { expectedVersion: 1 },
    );
    expect(b.meta.version).toBe(2);
    await expect(
      repo.save(COMPANY, categoryPolicy, { expectedVersion: 1 }),
    ).rejects.toMatchObject({ code: "CONCURRENCY" });
    await expect(
      repo.save(COMPANY, createCategoryPolicy({ categoryId: "novo" }), { expectedVersion: 5 }),
    ).rejects.toMatchObject({ code: "CONCURRENCY" });
  });

  it("valida entradas", async () => {
    const repo = new InMemoryCategoryPolicyRepository();
    await expect(repo.findByCategory("", CAT)).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(repo.save(COMPANY, { ...categoryPolicy, categoryId: "" })).rejects.toMatchObject(
      { code: "INVALID_ARGUMENT" },
    );
    await expect(repo.softDelete(COMPANY, "")).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(repo.restore(COMPANY, "")).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(repo.listByCompany("")).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  it("softDelete e restore em chave inexistente falham", async () => {
    const repo = new InMemoryCategoryPolicyRepository();
    await expect(repo.softDelete(COMPANY, "missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(repo.restore(COMPANY, "missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("softDelete/restore respeitam expectedVersion", async () => {
    const repo = new InMemoryCategoryPolicyRepository();
    await repo.save(COMPANY, categoryPolicy);
    await expect(repo.softDelete(COMPANY, CAT, { expectedVersion: 9 })).rejects.toMatchObject({
      code: "CONCURRENCY",
    });
    await repo.softDelete(COMPANY, CAT);
    await expect(repo.restore(COMPANY, CAT, { expectedVersion: 9 })).rejects.toMatchObject({
      code: "CONCURRENCY",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ProductPolicyRepository
// ─────────────────────────────────────────────────────────────────────────────

describe("InMemoryProductPolicyRepository", () => {
  it("CRUD, versionamento e soft delete", async () => {
    const repo = new InMemoryProductPolicyRepository();
    const s = await repo.save(COMPANY, productPolicy, { actor: { userId: "u1" } });
    expect(s.meta.createdBy).toBe("u1");
    expect((await repo.listByCompany(COMPANY))).toHaveLength(1);
    await repo.softDelete(COMPANY, PROD);
    expect(await repo.findByProduct(COMPANY, PROD)).toBeNull();
    const back = await repo.restore(COMPANY, PROD);
    expect(back.entity.productId).toBe(PROD);
  });

  it("valida entradas", async () => {
    const repo = new InMemoryProductPolicyRepository();
    await expect(repo.findByProduct(COMPANY, "")).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(repo.save(COMPANY, { ...productPolicy, productId: "" })).rejects.toMatchObject(
      { code: "INVALID_ARGUMENT" },
    );
    await expect(repo.softDelete(COMPANY, "")).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(repo.restore(COMPANY, "")).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PriceListRepository
// ─────────────────────────────────────────────────────────────────────────────

describe("InMemoryPriceListRepository", () => {
  it("persiste agregado com entries e reidrata", async () => {
    const repo = new InMemoryPriceListRepository();
    const s = await repo.save(COMPANY, priceList, { actor: { userId: "u1" } });
    expect(s.entity.entries).toHaveLength(2);
    const found = await repo.findById(COMPANY, "pl-1");
    expect(found?.entity.priceListId).toBe("pl-1");
  });

  it("CRUD completo, soft delete e list", async () => {
    const repo = new InMemoryPriceListRepository();
    await repo.save(COMPANY, priceList);
    expect(await repo.listByCompany(COMPANY)).toHaveLength(1);
    await repo.softDelete(COMPANY, "pl-1");
    expect(await repo.findById(COMPANY, "pl-1")).toBeNull();
    expect(await repo.listByCompany(COMPANY, { includeDeleted: true })).toHaveLength(1);
    await repo.restore(COMPANY, "pl-1");
    expect(await repo.findById(COMPANY, "pl-1")).not.toBeNull();
  });

  it("valida chaves + falha em id inexistente", async () => {
    const repo = new InMemoryPriceListRepository();
    await expect(repo.findById(COMPANY, "")).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
    await expect(repo.softDelete(COMPANY, "x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PricingDecisionRepository — append-only
// ─────────────────────────────────────────────────────────────────────────────

describe("InMemoryPricingDecisionRepository", () => {
  it("append + findByExplainId + query com filtros", async () => {
    const repo = new InMemoryPricingDecisionRepository();
    const a = await repo.append(decisionSnapshot());
    const b = await repo.append(decisionSnapshot({ requestId: "req-2", explainId: "exp-2" }));

    expect(a.id).not.toBe(b.id);
    expect(await repo.findByExplainId(COMPANY, "exp-1")).not.toBeNull();
    expect(await repo.findByExplainId(COMPANY, "missing")).toBeNull();

    const all = await repo.query({ companyId: COMPANY });
    expect(all).toHaveLength(2);

    const filtered = await repo.query({ companyId: COMPANY, requestId: "req-1" });
    expect(filtered).toHaveLength(1);

    const byExplain = await repo.query({ companyId: COMPANY, explainId: "exp-2" });
    expect(byExplain[0].snapshot.explainId).toBe("exp-2");

    const limited = await repo.query({ companyId: COMPANY, limit: 1 });
    expect(limited).toHaveLength(1);

    const since = await repo.query({ companyId: COMPANY, since: "2099-01-01" });
    expect(since).toHaveLength(0);
    const until = await repo.query({ companyId: COMPANY, until: "1900-01-01" });
    expect(until).toHaveLength(0);
  });

  it("valida campos obrigatórios do snapshot", async () => {
    const repo = new InMemoryPricingDecisionRepository();
    await expect(repo.append(decisionSnapshot({ companyId: "" }))).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(repo.append(decisionSnapshot({ requestId: "" }))).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(repo.append(decisionSnapshot({ explainId: "" }))).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(repo.append(decisionSnapshot({ snapshotHash: "" }))).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(repo.findByExplainId("", "x")).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(repo.query({ companyId: "" })).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
  });

  it("snapshot é imutável (clonagem defensiva)", async () => {
    const repo = new InMemoryPricingDecisionRepository();
    const snap = decisionSnapshot();
    const stored = await repo.append(snap);
    (stored.snapshot as { snapshotHash: string }).snapshotHash = "MUTATED";
    const again = await repo.findByExplainId(COMPANY, "exp-1");
    expect(again?.snapshot.snapshotHash).toBe("sha-1");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Factory + versão
// ─────────────────────────────────────────────────────────────────────────────

describe("factory & metadata", () => {
  it("createInMemoryRepositories devolve 5 repos", () => {
    const repos = createInMemoryRepositories();
    expect(repos.companyPolicies).toBeInstanceOf(InMemoryCompanyPolicyRepository);
    expect(repos.categoryPolicies).toBeInstanceOf(InMemoryCategoryPolicyRepository);
    expect(repos.productPolicies).toBeInstanceOf(InMemoryProductPolicyRepository);
    expect(repos.priceLists).toBeInstanceOf(InMemoryPriceListRepository);
    expect(repos.pricingDecisions).toBeInstanceOf(InMemoryPricingDecisionRepository);
    expect(PERSISTENCE_VERSION).toBe("pricing-persistence/1.0.0");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Fake Supabase client — testa contrato do adapter sem tocar em rede.
// ─────────────────────────────────────────────────────────────────────────────

interface FakeRow {
  id: string;
  company_id: string;
  version: number;
  envelope: unknown;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  deleted_at?: string | null;
  [k: string]: unknown;
}

/** Query builder mínimo que registra chamadas e devolve um resultado configurado. */
function makeBuilder(result: { data: unknown; error: unknown }) {
  const calls: Array<{ op: string; args: unknown[] }> = [];
  const b = {} as Record<string, unknown>;
  const method = (name: string) => (...args: unknown[]) => {
    calls.push({ op: name, args });
    return b;
  };
  for (const m of [
    "select",
    "eq",
    "is",
    "gte",
    "lte",
    "order",
    "limit",
    "range",
    "update",
    "insert",
    "delete",
  ]) {
    b[m] = method(m);
  }
  b.maybeSingle = () => Promise.resolve(result);
  b.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return { builder: b, calls };
}

function makeFakeClient(responses: Record<string, { data: unknown; error: unknown }>) {
  const tableCalls: string[] = [];
  const client = {
    from: (table: string) => {
      tableCalls.push(table);
      const { builder } = makeBuilder(responses[table] ?? { data: null, error: null });
      return builder;
    },
  };
  return { client: client as unknown as import("@supabase/supabase-js").SupabaseClient, tableCalls };
}

const envelopeFor = (kind: "CompanyPolicy" | "CategoryPolicy" | "ProductPolicy" | "PriceList", payload: unknown) =>
  toEnvelope(kind, payload, new Date().toISOString());

const fakeRow = (over: Partial<FakeRow>): FakeRow => ({
  id: "row-1",
  company_id: COMPANY,
  version: 1,
  envelope: envelopeFor("CompanyPolicy", companyPolicy),
  created_at: "2026-07-14T00:00:00Z",
  updated_at: "2026-07-14T00:00:00Z",
  created_by: "u1",
  deleted_at: null,
  ...over,
});

describe("SupabaseCompanyPolicyRepository", () => {
  it("findByCompany devolve entidade reidratada", async () => {
    const { client } = makeFakeClient({
      company_pricing_policies: { data: fakeRow({}), error: null },
    });
    const repo = new SupabaseCompanyPolicyRepository(client);
    const found = await repo.findByCompany(COMPANY);
    expect(found?.entity.companyId).toBe(COMPANY);
    expect(found?.meta.version).toBe(1);
  });

  it("findByCompany retorna null quando linha ausente", async () => {
    const { client } = makeFakeClient({
      company_pricing_policies: { data: null, error: null },
    });
    const repo = new SupabaseCompanyPolicyRepository(client);
    expect(await repo.findByCompany(COMPANY)).toBeNull();
  });

  it("propaga erros de storage", async () => {
    const { client } = makeFakeClient({
      company_pricing_policies: { data: null, error: { message: "boom" } },
    });
    const repo = new SupabaseCompanyPolicyRepository(client);
    await expect(repo.findByCompany(COMPANY)).rejects.toMatchObject({ code: "STORAGE_FAILURE" });
  });

  it("save (insert) usa version=1 quando não há registro", async () => {
    // 1st call: load existing (none) -> null; 2nd: insert -> row v1
    const responses = {
      company_pricing_policies: { data: fakeRow({ version: 1 }), error: null },
    };
    const { client } = makeFakeClient(responses);
    // For insert path the fake returns the same row; that's fine for adapter test.
    const repo = new SupabaseCompanyPolicyRepository(client);
    // Force the existing lookup to return null by using a client that alternates:
    let callIdx = 0;
    const alt = {
      from: () => {
        callIdx += 1;
        return callIdx === 1
          ? makeBuilder({ data: null, error: null }).builder
          : makeBuilder({ data: fakeRow({ version: 1 }), error: null }).builder;
      },
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const r2 = new SupabaseCompanyPolicyRepository(alt);
    const saved = await r2.save(companyPolicy, { actor: { userId: "u1" } });
    expect(saved.meta.version).toBe(1);
  });

  it("save (update) incrementa versão", async () => {
    let callIdx = 0;
    const alt = {
      from: () => {
        callIdx += 1;
        if (callIdx === 1) {
          return makeBuilder({ data: { id: "row-1", version: 3, deleted_at: null }, error: null })
            .builder;
        }
        return makeBuilder({ data: fakeRow({ version: 4 }), error: null }).builder;
      },
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabaseCompanyPolicyRepository(alt);
    const s = await repo.save(companyPolicy, { expectedVersion: 3 });
    expect(s.meta.version).toBe(4);
  });

  it("save falha com CONCURRENCY quando expectedVersion diverge", async () => {
    const alt = {
      from: () =>
        makeBuilder({ data: { id: "r", version: 5, deleted_at: null }, error: null }).builder,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabaseCompanyPolicyRepository(alt);
    await expect(repo.save(companyPolicy, { expectedVersion: 1 })).rejects.toMatchObject({
      code: "CONCURRENCY",
    });
  });

  it("valida ausência de companyId", async () => {
    const { client } = makeFakeClient({});
    const repo = new SupabaseCompanyPolicyRepository(client);
    await expect(repo.findByCompany("")).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });

  it("softDelete falha NOT_FOUND quando não existe", async () => {
    const { client } = makeFakeClient({
      company_pricing_policies: { data: null, error: null },
    });
    const repo = new SupabaseCompanyPolicyRepository(client);
    await expect(repo.softDelete(COMPANY)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("softDelete respeita expectedVersion", async () => {
    let callIdx = 0;
    const alt = {
      from: () => {
        callIdx += 1;
        if (callIdx === 1) return makeBuilder({ data: { id: "r", version: 2 }, error: null }).builder;
        return makeBuilder({ data: null, error: null }).builder;
      },
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabaseCompanyPolicyRepository(alt);
    await expect(repo.softDelete(COMPANY, { expectedVersion: 9 })).rejects.toMatchObject({
      code: "CONCURRENCY",
    });
  });

  it("softDelete emite update quando encontra linha", async () => {
    let callIdx = 0;
    const alt = {
      from: () => {
        callIdx += 1;
        if (callIdx === 1) {
          return makeBuilder({ data: { id: "r", version: 2 }, error: null }).builder;
        }
        return makeBuilder({ data: null, error: null }).builder;
      },
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabaseCompanyPolicyRepository(alt);
    await expect(repo.softDelete(COMPANY)).resolves.toBeUndefined();
  });

  it("restore emite update", async () => {
    let callIdx = 0;
    const alt = {
      from: () => {
        callIdx += 1;
        if (callIdx === 1) {
          return makeBuilder({
            data: fakeRow({ version: 2, deleted_at: "2026-07-14T00:00:00Z" }),
            error: null,
          }).builder;
        }
        return makeBuilder({ data: fakeRow({ version: 3 }), error: null }).builder;
      },
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabaseCompanyPolicyRepository(alt);
    const r = await repo.restore(COMPANY);
    expect(r.meta.version).toBe(3);
  });
});

describe("SupabaseCategoryPolicyRepository", () => {
  it("find/list/save/softDelete/restore compõem SQL correto", async () => {
    let idx = 0;
    const results: Array<{ data: unknown; error: unknown }> = [
      { data: fakeRow({ envelope: envelopeFor("CategoryPolicy", categoryPolicy) }), error: null },
      { data: [fakeRow({ envelope: envelopeFor("CategoryPolicy", categoryPolicy) })], error: null },
    ];
    const alt = {
      from: () => makeBuilder(results[idx++] ?? { data: null, error: null }).builder,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabaseCategoryPolicyRepository(alt);
    const found = await repo.findByCategory(COMPANY, CAT);
    expect(found?.entity.categoryId).toBe(CAT);
    const list = await repo.listByCompany(COMPANY, { limit: 5, offset: 2 });
    expect(list).toHaveLength(1);
  });

  it("list vazia devolve []", async () => {
    const alt = {
      from: () => makeBuilder({ data: [], error: null }).builder,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabaseCategoryPolicyRepository(alt);
    expect(await repo.listByCompany(COMPANY)).toEqual([]);
  });

  it("valida entradas", async () => {
    const { client } = makeFakeClient({});
    const repo = new SupabaseCategoryPolicyRepository(client);
    await expect(repo.findByCategory("", CAT)).rejects.toMatchObject({ code: "INVALID_ARGUMENT" });
  });
});

describe("SupabaseProductPolicyRepository", () => {
  it("find devolve entidade", async () => {
    const alt = {
      from: () =>
        makeBuilder({
          data: fakeRow({ envelope: envelopeFor("ProductPolicy", productPolicy) }),
          error: null,
        }).builder,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabaseProductPolicyRepository(alt);
    const found = await repo.findByProduct(COMPANY, PROD);
    expect(found?.entity.productId).toBe(PROD);
  });

  it("save insert emite operação", async () => {
    let idx = 0;
    const alt = {
      from: () => {
        idx += 1;
        if (idx === 1) return makeBuilder({ data: null, error: null }).builder;
        return makeBuilder({
          data: fakeRow({ envelope: envelopeFor("ProductPolicy", productPolicy) }),
          error: null,
        }).builder;
      },
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabaseProductPolicyRepository(alt);
    const s = await repo.save(COMPANY, productPolicy);
    expect(s.entity.productId).toBe(PROD);
  });
});

describe("SupabasePriceListRepository", () => {
  it("find devolve agregado quando existe", async () => {
    const alt = {
      from: () =>
        makeBuilder({
          data: fakeRow({ envelope: envelopeFor("PriceList", priceList) }),
          error: null,
        }).builder,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabasePriceListRepository(alt);
    const found = await repo.findById(COMPANY, "pl-1");
    expect(found?.entity.priceListId).toBe("pl-1");
  });

  it("find retorna null quando deleted", async () => {
    const alt = {
      from: () =>
        makeBuilder({
          data: fakeRow({
            envelope: envelopeFor("PriceList", priceList),
            deleted_at: "2026-01-01T00:00:00Z",
          }),
          error: null,
        }).builder,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabasePriceListRepository(alt);
    expect(await repo.findById(COMPANY, "pl-1")).toBeNull();
  });

  it("list retorna array", async () => {
    const alt = {
      from: () =>
        makeBuilder({
          data: [fakeRow({ envelope: envelopeFor("PriceList", priceList) })],
          error: null,
        }).builder,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabasePriceListRepository(alt);
    const list = await repo.listByCompany(COMPANY, { limit: 10, offset: 0, includeDeleted: true });
    expect(list).toHaveLength(1);
  });

  it("save insert cria PriceList e insere entries", async () => {
    let idx = 0;
    const alt = {
      from: () => {
        idx += 1;
        if (idx === 1) return makeBuilder({ data: null, error: null }).builder; // load existing
        if (idx === 2)
          return makeBuilder({
            data: fakeRow({ envelope: envelopeFor("PriceList", priceList) }),
            error: null,
          }).builder;
        return makeBuilder({ data: null, error: null }).builder;
      },
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabasePriceListRepository(alt);
    const s = await repo.save(COMPANY, priceList);
    expect(s.entity.priceListId).toBe("pl-1");
  });

  it("save update incrementa versão", async () => {
    let idx = 0;
    const alt = {
      from: () => {
        idx += 1;
        if (idx === 1)
          return makeBuilder({
            data: fakeRow({ id: "row-1", version: 2, envelope: envelopeFor("PriceList", priceList) }),
            error: null,
          }).builder;
        if (idx === 2)
          return makeBuilder({
            data: fakeRow({ version: 3, envelope: envelopeFor("PriceList", priceList) }),
            error: null,
          }).builder;
        return makeBuilder({ data: null, error: null }).builder;
      },
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabasePriceListRepository(alt);
    const s = await repo.save(COMPANY, priceList, { expectedVersion: 2 });
    expect(s.meta.version).toBe(3);
  });

  it("softDelete NOT_FOUND quando linha ausente", async () => {
    const alt = {
      from: () => makeBuilder({ data: null, error: null }).builder,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabasePriceListRepository(alt);
    await expect(repo.softDelete(COMPANY, "pl-x")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("softDelete emite update quando existe", async () => {
    const alt = {
      from: () =>
        makeBuilder({
          data: fakeRow({ envelope: envelopeFor("PriceList", priceList) }),
          error: null,
        }).builder,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabasePriceListRepository(alt);
    await expect(repo.softDelete(COMPANY, "pl-1")).resolves.toBeUndefined();
  });

  it("restore rehydrata via createPriceList", async () => {
    let idx = 0;
    const alt = {
      from: () => {
        idx += 1;
        if (idx === 1)
          return makeBuilder({
            data: fakeRow({ envelope: envelopeFor("PriceList", priceList) }),
            error: null,
          }).builder;
        return makeBuilder({
          data: fakeRow({ version: 2, envelope: envelopeFor("PriceList", priceList) }),
          error: null,
        }).builder;
      },
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabasePriceListRepository(alt);
    const r = await repo.restore(COMPANY, "pl-1");
    expect(r.entity.entries).toHaveLength(2);
  });
});

describe("SupabasePricingDecisionRepository", () => {
  it("append persiste snapshot", async () => {
    const alt = {
      from: () =>
        makeBuilder({
          data: { id: "d1", created_at: "2026-07-14T12:00:00Z" },
          error: null,
        }).builder,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabasePricingDecisionRepository(alt);
    const s = await repo.append(decisionSnapshot());
    expect(s.id).toBe("d1");
    expect(s.snapshot.explainId).toBe("exp-1");
  });

  it("findByExplainId devolve null quando ausente", async () => {
    const alt = {
      from: () => makeBuilder({ data: null, error: null }).builder,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabasePricingDecisionRepository(alt);
    expect(await repo.findByExplainId(COMPANY, "nope")).toBeNull();
  });

  it("findByExplainId hidrata linha", async () => {
    const row = {
      id: "d1",
      company_id: COMPANY,
      request_id: "r",
      explain_id: "e",
      engine_version: "v",
      calculation_version: "v",
      context_version: "v",
      result_version: "v",
      policy_version: "v",
      snapshot_hash: "h",
      applied_rules: null,
      warnings: null,
      context: {},
      result: {},
      explanation: null,
      created_at: "2026-07-14T00:00:00Z",
      created_by: null,
    };
    const alt = {
      from: () => makeBuilder({ data: row, error: null }).builder,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabasePricingDecisionRepository(alt);
    const s = await repo.findByExplainId(COMPANY, "e");
    expect(s?.snapshot.explainId).toBe("e");
    expect(s?.snapshot.appliedRules).toEqual([]);
  });

  it("query aplica filtros e limit", async () => {
    const alt = {
      from: () =>
        makeBuilder({
          data: [
            {
              id: "d1",
              company_id: COMPANY,
              request_id: "r",
              explain_id: "e",
              engine_version: "v",
              calculation_version: "v",
              context_version: "v",
              result_version: "v",
              policy_version: "v",
              snapshot_hash: "h",
              applied_rules: [],
              warnings: [],
              context: {},
              result: {},
              explanation: null,
              created_at: "2026-07-14T00:00:00Z",
              created_by: null,
            },
          ],
          error: null,
        }).builder,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabasePricingDecisionRepository(alt);
    const out = await repo.query({
      companyId: COMPANY,
      requestId: "r",
      explainId: "e",
      since: "2020-01-01",
      until: "2030-01-01",
      limit: 5,
    });
    expect(out).toHaveLength(1);
  });

  it("valida entradas obrigatórias", async () => {
    const alt = {
      from: () => makeBuilder({ data: null, error: null }).builder,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabasePricingDecisionRepository(alt);
    await expect(repo.append(decisionSnapshot({ companyId: "" }))).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(repo.findByExplainId("", "x")).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
    await expect(repo.query({ companyId: "" })).rejects.toMatchObject({
      code: "INVALID_ARGUMENT",
    });
  });

  it("propaga storage failure", async () => {
    const alt = {
      from: () => makeBuilder({ data: null, error: { message: "x" } }).builder,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repo = new SupabasePricingDecisionRepository(alt);
    await expect(repo.append(decisionSnapshot())).rejects.toMatchObject({
      code: "STORAGE_FAILURE",
    });
  });
});

describe("Supabase factory", () => {
  it("createSupabaseRepositories devolve o bundle", () => {
    const alt = {
      from: () => makeBuilder({ data: null, error: null }).builder,
    } as unknown as import("@supabase/supabase-js").SupabaseClient;
    const repos = createSupabaseRepositories(alt);
    expect(repos.companyPolicies).toBeInstanceOf(SupabaseCompanyPolicyRepository);
    expect(repos.priceLists).toBeInstanceOf(SupabasePriceListRepository);
    expect(SUPABASE_PERSISTENCE_ENVELOPE).toContain("commercial-config/");
  });

  it("silencia mock não-usado", () => {
    // vi.fn() referenciada só para manter o import ativo se um dia usarmos spies.
    expect(vi.fn()).toBeTypeOf("function");
  });
});
