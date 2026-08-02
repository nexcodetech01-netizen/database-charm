/**
 * In-memory implementations — Persistence Layer
 * =============================================
 * Implementações puras, sem I/O. Servem como:
 *   - Spec executável dos contratos.
 *   - Test double para testes de unidade e integração leves.
 *
 * NÃO usar em produção. Não persistem entre processos.
 */
import type { PriceListAggregate } from "../config/price-list";
import type { CategoryPolicy, CompanyPolicy, ProductPolicy } from "../resolver/types";
import { concurrency, invalidArgument, notFound } from "./errors";
import type {
  CategoryPolicyRepository,
  CompanyPolicyRepository,
  DecisionQuery,
  ListOptions,
  PriceListRepository,
  PricingDecisionRepository,
  PricingDecisionSnapshot,
  PricingRepositories,
  ProductPolicyRepository,
  RecordMetadata,
  StoredEntity,
  StoredPricingDecision,
  WriteOptions,
} from "./types";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers compartilhados
// ─────────────────────────────────────────────────────────────────────────────

const nowIso = () => new Date().toISOString();

let counter = 0;
const genId = () => {
  counter += 1;
  return `mem-${Date.now().toString(36)}-${counter.toString(36)}`;
};

const requireString = (v: unknown, field: string): string => {
  if (typeof v !== "string" || v.length === 0) {
    throw invalidArgument(`${field} is required`);
  }
  return v;
};

const checkVersion = (what: string, current: number, expected: number | undefined): void => {
  if (typeof expected === "number" && expected !== current) {
    throw concurrency(what, expected, current);
  }
};

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

interface Row<T> {
  entity: T;
  meta: RecordMetadata;
}

const toStored = <T>(row: Row<T>): StoredEntity<T> => ({
  entity: clone(row.entity),
  meta: { ...row.meta },
});

// ─────────────────────────────────────────────────────────────────────────────
// CompanyPolicy
// ─────────────────────────────────────────────────────────────────────────────

export class InMemoryCompanyPolicyRepository implements CompanyPolicyRepository {
  private rows = new Map<string, Row<CompanyPolicy>>();

  async findByCompany(companyId: string) {
    requireString(companyId, "companyId");
    const row = this.rows.get(companyId);
    if (!row || row.meta.deletedAt) return null;
    return toStored(row);
  }

  async save(policy: CompanyPolicy, opts: WriteOptions = {}) {
    requireString(policy.companyId, "policy.companyId");
    const existing = this.rows.get(policy.companyId);
    const now = nowIso();
    if (existing) {
      checkVersion("CompanyPolicy", existing.meta.version, opts.expectedVersion);
      const meta: RecordMetadata = {
        ...existing.meta,
        version: existing.meta.version + 1,
        updatedAt: now,
        deletedAt: undefined,
      };
      const row: Row<CompanyPolicy> = { entity: clone(policy), meta };
      this.rows.set(policy.companyId, row);
      return toStored(row);
    }
    if (typeof opts.expectedVersion === "number" && opts.expectedVersion !== 0) {
      throw concurrency("CompanyPolicy", opts.expectedVersion, 0);
    }
    const meta: RecordMetadata = {
      id: genId(),
      companyId: policy.companyId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: opts.actor?.userId,
    };
    const row: Row<CompanyPolicy> = { entity: clone(policy), meta };
    this.rows.set(policy.companyId, row);
    return toStored(row);
  }

  async softDelete(companyId: string, opts: WriteOptions = {}) {
    const row = this.rows.get(requireString(companyId, "companyId"));
    if (!row) throw notFound("CompanyPolicy", companyId);
    checkVersion("CompanyPolicy", row.meta.version, opts.expectedVersion);
    row.meta = { ...row.meta, deletedAt: nowIso(), updatedAt: nowIso() };
  }

  async restore(companyId: string, opts: WriteOptions = {}) {
    const row = this.rows.get(requireString(companyId, "companyId"));
    if (!row) throw notFound("CompanyPolicy", companyId);
    checkVersion("CompanyPolicy", row.meta.version, opts.expectedVersion);
    row.meta = {
      ...row.meta,
      deletedAt: undefined,
      updatedAt: nowIso(),
      version: row.meta.version + 1,
    };
    return toStored(row);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Genérico para políticas escopadas por chave (categoryId / productId)
// ─────────────────────────────────────────────────────────────────────────────

class ScopedPolicyStore<TEntity> {
  private rows = new Map<string, Row<TEntity>>(); // key = companyId|entityKey

  private k(companyId: string, entityKey: string) {
    return `${companyId}|${entityKey}`;
  }

  find(companyId: string, entityKey: string): StoredEntity<TEntity> | null {
    const row = this.rows.get(this.k(companyId, entityKey));
    if (!row || row.meta.deletedAt) return null;
    return toStored(row);
  }

  list(companyId: string, opts: ListOptions = {}): StoredEntity<TEntity>[] {
    const out: StoredEntity<TEntity>[] = [];
    for (const row of this.rows.values()) {
      if (row.meta.companyId !== companyId) continue;
      if (!opts.includeDeleted && row.meta.deletedAt) continue;
      out.push(toStored(row));
    }
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? out.length;
    return out.slice(offset, offset + limit);
  }

  save(
    what: string,
    companyId: string,
    entityKey: string,
    entity: TEntity,
    opts: WriteOptions,
  ): StoredEntity<TEntity> {
    const key = this.k(companyId, entityKey);
    const existing = this.rows.get(key);
    const now = nowIso();
    if (existing) {
      checkVersion(what, existing.meta.version, opts.expectedVersion);
      const meta: RecordMetadata = {
        ...existing.meta,
        version: existing.meta.version + 1,
        updatedAt: now,
        deletedAt: undefined,
      };
      const row: Row<TEntity> = { entity: clone(entity), meta };
      this.rows.set(key, row);
      return toStored(row);
    }
    if (typeof opts.expectedVersion === "number" && opts.expectedVersion !== 0) {
      throw concurrency(what, opts.expectedVersion, 0);
    }
    const meta: RecordMetadata = {
      id: genId(),
      companyId,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: opts.actor?.userId,
    };
    const row: Row<TEntity> = { entity: clone(entity), meta };
    this.rows.set(key, row);
    return toStored(row);
  }

  softDelete(what: string, companyId: string, entityKey: string, opts: WriteOptions): void {
    const row = this.rows.get(this.k(companyId, entityKey));
    if (!row) throw notFound(what, entityKey);
    checkVersion(what, row.meta.version, opts.expectedVersion);
    row.meta = { ...row.meta, deletedAt: nowIso(), updatedAt: nowIso() };
  }

  restore(
    what: string,
    companyId: string,
    entityKey: string,
    opts: WriteOptions,
  ): StoredEntity<TEntity> {
    const row = this.rows.get(this.k(companyId, entityKey));
    if (!row) throw notFound(what, entityKey);
    checkVersion(what, row.meta.version, opts.expectedVersion);
    row.meta = {
      ...row.meta,
      deletedAt: undefined,
      updatedAt: nowIso(),
      version: row.meta.version + 1,
    };
    return toStored(row);
  }
}

export class InMemoryCategoryPolicyRepository implements CategoryPolicyRepository {
  private store = new ScopedPolicyStore<CategoryPolicy>();

  async findByCategory(companyId: string, categoryId: string) {
    return this.store.find(
      requireString(companyId, "companyId"),
      requireString(categoryId, "categoryId"),
    );
  }
  async listByCompany(companyId: string, opts?: ListOptions) {
    return this.store.list(requireString(companyId, "companyId"), opts);
  }
  async save(companyId: string, policy: CategoryPolicy, opts: WriteOptions = {}) {
    return this.store.save(
      "CategoryPolicy",
      requireString(companyId, "companyId"),
      requireString(policy.categoryId, "policy.categoryId"),
      policy,
      opts,
    );
  }
  async softDelete(companyId: string, categoryId: string, opts: WriteOptions = {}) {
    this.store.softDelete(
      "CategoryPolicy",
      requireString(companyId, "companyId"),
      requireString(categoryId, "categoryId"),
      opts,
    );
  }
  async restore(companyId: string, categoryId: string, opts: WriteOptions = {}) {
    return this.store.restore(
      "CategoryPolicy",
      requireString(companyId, "companyId"),
      requireString(categoryId, "categoryId"),
      opts,
    );
  }
}

export class InMemoryProductPolicyRepository implements ProductPolicyRepository {
  private store = new ScopedPolicyStore<ProductPolicy>();

  async findByProduct(companyId: string, productId: string) {
    return this.store.find(
      requireString(companyId, "companyId"),
      requireString(productId, "productId"),
    );
  }
  async listByCompany(companyId: string, opts?: ListOptions) {
    return this.store.list(requireString(companyId, "companyId"), opts);
  }
  async save(companyId: string, policy: ProductPolicy, opts: WriteOptions = {}) {
    return this.store.save(
      "ProductPolicy",
      requireString(companyId, "companyId"),
      requireString(policy.productId, "policy.productId"),
      policy,
      opts,
    );
  }
  async softDelete(companyId: string, productId: string, opts: WriteOptions = {}) {
    this.store.softDelete(
      "ProductPolicy",
      requireString(companyId, "companyId"),
      requireString(productId, "productId"),
      opts,
    );
  }
  async restore(companyId: string, productId: string, opts: WriteOptions = {}) {
    return this.store.restore(
      "ProductPolicy",
      requireString(companyId, "companyId"),
      requireString(productId, "productId"),
      opts,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PriceList
// ─────────────────────────────────────────────────────────────────────────────

export class InMemoryPriceListRepository implements PriceListRepository {
  private store = new ScopedPolicyStore<PriceListAggregate>();

  async findById(companyId: string, priceListId: string) {
    return this.store.find(
      requireString(companyId, "companyId"),
      requireString(priceListId, "priceListId"),
    );
  }
  async listByCompany(companyId: string, opts?: ListOptions) {
    return this.store.list(requireString(companyId, "companyId"), opts);
  }
  async save(companyId: string, aggregate: PriceListAggregate, opts: WriteOptions = {}) {
    return this.store.save(
      "PriceList",
      requireString(companyId, "companyId"),
      requireString(aggregate.priceListId, "aggregate.priceListId"),
      aggregate,
      opts,
    );
  }
  async softDelete(companyId: string, priceListId: string, opts: WriteOptions = {}) {
    this.store.softDelete(
      "PriceList",
      requireString(companyId, "companyId"),
      requireString(priceListId, "priceListId"),
      opts,
    );
  }
  async restore(companyId: string, priceListId: string, opts: WriteOptions = {}) {
    return this.store.restore(
      "PriceList",
      requireString(companyId, "companyId"),
      requireString(priceListId, "priceListId"),
      opts,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PricingDecision (append-only)
// ─────────────────────────────────────────────────────────────────────────────

export class InMemoryPricingDecisionRepository implements PricingDecisionRepository {
  private rows: StoredPricingDecision[] = [];

  async append(snapshot: PricingDecisionSnapshot) {
    requireString(snapshot.companyId, "snapshot.companyId");
    requireString(snapshot.requestId, "snapshot.requestId");
    requireString(snapshot.explainId, "snapshot.explainId");
    requireString(snapshot.snapshotHash, "snapshot.snapshotHash");
    const stored: StoredPricingDecision = {
      id: genId(),
      snapshot: clone(snapshot),
      createdAt: nowIso(),
    };
    this.rows.push(stored);
    return { ...stored, snapshot: clone(stored.snapshot) };
  }

  async findByExplainId(companyId: string, explainId: string) {
    requireString(companyId, "companyId");
    requireString(explainId, "explainId");
    const row = this.rows.find(
      (r) => r.snapshot.companyId === companyId && r.snapshot.explainId === explainId,
    );
    return row ? { ...row, snapshot: clone(row.snapshot) } : null;
  }

  async query(q: DecisionQuery) {
    requireString(q.companyId, "companyId");
    let out = this.rows.filter((r) => r.snapshot.companyId === q.companyId);
    if (q.requestId) out = out.filter((r) => r.snapshot.requestId === q.requestId);
    if (q.explainId) out = out.filter((r) => r.snapshot.explainId === q.explainId);
    if (q.since) out = out.filter((r) => r.createdAt >= q.since!);
    if (q.until) out = out.filter((r) => r.createdAt <= q.until!);
    out = out.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (q.limit) out = out.slice(0, q.limit);
    return out.map((r) => ({ ...r, snapshot: clone(r.snapshot) }));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory conveniente
// ─────────────────────────────────────────────────────────────────────────────

export function createInMemoryRepositories(): PricingRepositories {
  return {
    companyPolicies: new InMemoryCompanyPolicyRepository(),
    categoryPolicies: new InMemoryCategoryPolicyRepository(),
    productPolicies: new InMemoryProductPolicyRepository(),
    priceLists: new InMemoryPriceListRepository(),
    pricingDecisions: new InMemoryPricingDecisionRepository(),
  };
}
