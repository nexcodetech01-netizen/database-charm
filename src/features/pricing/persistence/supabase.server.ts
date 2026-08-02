/**
 * Supabase Persistence — Pricing Engine (Fase P4)
 * ================================================
 * Implementações Supabase dos Repository contracts. Este arquivo é `.server.ts`,
 * portanto BLOQUEADO pelo bundler para import em código client.
 *
 * Usam o cliente Supabase injetado (padrão do módulo: `supabaseAdmin` ou
 * `context.supabase` do `requireSupabaseAuth`), respeitando RLS quando não-admin.
 * Nenhuma regra de negócio: validações de infraestrutura apenas.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { toEnvelope, fromEnvelope, CONFIG_DOMAIN_VERSION } from "../config/serialization";
import { createPriceList, type PriceListAggregate } from "../config/price-list";
import { createCompanyPolicy } from "../config/company-policy";
import { createCategoryPolicy } from "../config/category-policy";
import { createProductPolicy } from "../config/product-policy";
import type { CategoryPolicy, CompanyPolicy, ProductPolicy } from "../resolver/types";
import { concurrency, invalidArgument, notFound, storageFailure } from "./errors";
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

type SB = SupabaseClient;

const require1 = (v: unknown, field: string): string => {
  if (typeof v !== "string" || v.length === 0) throw invalidArgument(`${field} is required`);
  return v;
};

const nowIso = () => new Date().toISOString();

const rowToMeta = (row: {
  id: string;
  company_id: string;
  version: number;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
  deleted_at?: string | null;
}): RecordMetadata => ({
  id: row.id,
  companyId: row.company_id,
  version: row.version,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  createdBy: row.created_by ?? undefined,
  deletedAt: row.deleted_at ?? undefined,
});

const unwrapEnvelope = <T>(envelope: unknown, expectKind: string): T => {
  const parsed = fromEnvelope<T>(envelope, {
    expectKind: expectKind as never,
  });
  return parsed.payload;
};

const raise = (op: string, error: unknown) => {
  throw storageFailure(`Supabase ${op} failed`, error);
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper genérico para as 3 tabelas de "política escopada por chave"
// ─────────────────────────────────────────────────────────────────────────────

interface ScopedTableConfig<TEntity> {
  table: string;
  keyColumn: string;
  kind: "CompanyPolicy" | "CategoryPolicy" | "ProductPolicy";
  extractKey: (entity: TEntity) => string;
  rehydrate: (payload: TEntity) => TEntity;
  what: string;
}

async function scopedFind<TEntity>(
  sb: SB,
  cfg: ScopedTableConfig<TEntity>,
  companyId: string,
  entityKey: string | null,
): Promise<StoredEntity<TEntity> | null> {
  const query = sb
    .from(cfg.table)
    .select("*")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .limit(1);
  const finalQuery = entityKey ? query.eq(cfg.keyColumn, entityKey) : query;
  const { data, error } = await finalQuery.maybeSingle();
  if (error) raise(`find ${cfg.what}`, error);
  if (!data) return null;
  const entity = cfg.rehydrate(unwrapEnvelope<TEntity>(data.envelope, cfg.kind));
  return { entity, meta: rowToMeta(data) };
}

async function scopedSave<TEntity>(
  sb: SB,
  cfg: ScopedTableConfig<TEntity>,
  companyId: string,
  entity: TEntity,
  opts: WriteOptions,
): Promise<StoredEntity<TEntity>> {
  const entityKey = cfg.extractKey(entity);
  require1(entityKey, `${cfg.what}.key`);
  const envelope = toEnvelope(cfg.kind, entity, nowIso());

  // Fetch existing row (including soft-deleted) to decide insert vs update.
  const existingQ = sb
    .from(cfg.table)
    .select("id, version, deleted_at")
    .eq("company_id", companyId);
  const existingFinal =
    cfg.keyColumn === "id"
      ? existingQ // company table: 1 per company_id (unique on company_id)
      : existingQ.eq(cfg.keyColumn, entityKey);
  const { data: existing, error: existErr } = await existingFinal.maybeSingle();
  if (existErr && existErr.code !== "PGRST116") raise(`load ${cfg.what}`, existErr);

  if (existing) {
    if (typeof opts.expectedVersion === "number" && opts.expectedVersion !== existing.version) {
      throw concurrency(cfg.what, opts.expectedVersion, existing.version);
    }
    const nextVersion = existing.version + 1;
    const updates: Record<string, unknown> = {
      envelope,
      version: nextVersion,
      deleted_at: null,
    };
    const { data, error } = await sb
      .from(cfg.table)
      .update(updates)
      .eq("id", existing.id)
      .eq("version", existing.version) // optimistic guard at DB layer
      .select("*")
      .maybeSingle();
    if (error) raise(`update ${cfg.what}`, error);
    if (!data) throw concurrency(cfg.what, existing.version, -1);
    return {
      entity: cfg.rehydrate(unwrapEnvelope<TEntity>(data.envelope, cfg.kind)),
      meta: rowToMeta(data),
    };
  }

  if (typeof opts.expectedVersion === "number" && opts.expectedVersion !== 0) {
    throw concurrency(cfg.what, opts.expectedVersion, 0);
  }
  const insert: Record<string, unknown> = {
    company_id: companyId,
    envelope,
    version: 1,
    created_by: opts.actor?.userId ?? null,
  };
  if (cfg.keyColumn !== "id") insert[cfg.keyColumn] = entityKey;
  const { data, error } = await sb.from(cfg.table).insert(insert).select("*").maybeSingle();
  if (error) raise(`insert ${cfg.what}`, error);
  if (!data) throw storageFailure(`insert ${cfg.what} returned no row`);
  return {
    entity: cfg.rehydrate(unwrapEnvelope<TEntity>(data.envelope, cfg.kind)),
    meta: rowToMeta(data),
  };
}

async function scopedSoftDelete<TEntity>(
  sb: SB,
  cfg: ScopedTableConfig<TEntity>,
  companyId: string,
  entityKey: string | null,
  opts: WriteOptions,
): Promise<void> {
  const base = sb.from(cfg.table).select("id, version").eq("company_id", companyId);
  const q = entityKey ? base.eq(cfg.keyColumn, entityKey) : base;
  const { data, error } = await q.maybeSingle();
  if (error) raise(`load ${cfg.what}`, error);
  if (!data) throw notFound(cfg.what, entityKey ?? companyId);
  if (typeof opts.expectedVersion === "number" && opts.expectedVersion !== data.version) {
    throw concurrency(cfg.what, opts.expectedVersion, data.version);
  }
  const { error: uErr } = await sb
    .from(cfg.table)
    .update({ deleted_at: nowIso() })
    .eq("id", data.id)
    .eq("version", data.version);
  if (uErr) raise(`soft-delete ${cfg.what}`, uErr);
}

async function scopedRestore<TEntity>(
  sb: SB,
  cfg: ScopedTableConfig<TEntity>,
  companyId: string,
  entityKey: string | null,
  opts: WriteOptions,
): Promise<StoredEntity<TEntity>> {
  const base = sb.from(cfg.table).select("*").eq("company_id", companyId);
  const q = entityKey ? base.eq(cfg.keyColumn, entityKey) : base;
  const { data, error } = await q.maybeSingle();
  if (error) raise(`load ${cfg.what}`, error);
  if (!data) throw notFound(cfg.what, entityKey ?? companyId);
  if (typeof opts.expectedVersion === "number" && opts.expectedVersion !== data.version) {
    throw concurrency(cfg.what, opts.expectedVersion, data.version);
  }
  const nextVersion = data.version + 1;
  const { data: upd, error: uErr } = await sb
    .from(cfg.table)
    .update({ deleted_at: null, version: nextVersion })
    .eq("id", data.id)
    .eq("version", data.version)
    .select("*")
    .maybeSingle();
  if (uErr) raise(`restore ${cfg.what}`, uErr);
  if (!upd) throw concurrency(cfg.what, data.version, -1);
  return {
    entity: cfg.rehydrate(unwrapEnvelope<TEntity>(upd.envelope, cfg.kind)),
    meta: rowToMeta(upd),
  };
}

async function scopedList<TEntity>(
  sb: SB,
  cfg: ScopedTableConfig<TEntity>,
  companyId: string,
  opts: ListOptions,
): Promise<StoredEntity<TEntity>[]> {
  let query = sb.from(cfg.table).select("*").eq("company_id", companyId);
  if (!opts.includeDeleted) query = query.is("deleted_at", null);
  if (typeof opts.limit === "number") {
    const from = opts.offset ?? 0;
    query = query.range(from, from + opts.limit - 1);
  }
  const { data, error } = await query;
  if (error) raise(`list ${cfg.what}`, error);
  return (data ?? []).map((row) => ({
    entity: cfg.rehydrate(unwrapEnvelope<TEntity>(row.envelope, cfg.kind)),
    meta: rowToMeta(row),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Repositories
// ─────────────────────────────────────────────────────────────────────────────

export class SupabaseCompanyPolicyRepository implements CompanyPolicyRepository {
  private cfg: ScopedTableConfig<CompanyPolicy>;
  constructor(private sb: SB) {
    this.cfg = {
      table: "company_pricing_policies",
      keyColumn: "id", // unique on company_id
      kind: "CompanyPolicy",
      what: "CompanyPolicy",
      extractKey: (p) => p.companyId,
      rehydrate: (p) => createCompanyPolicy(p),
    };
  }
  async findByCompany(companyId: string) {
    return scopedFind(this.sb, this.cfg, require1(companyId, "companyId"), null);
  }
  async save(policy: CompanyPolicy, opts: WriteOptions = {}) {
    return scopedSave(
      this.sb,
      this.cfg,
      require1(policy.companyId, "policy.companyId"),
      policy,
      opts,
    );
  }
  async softDelete(companyId: string, opts: WriteOptions = {}) {
    return scopedSoftDelete(this.sb, this.cfg, require1(companyId, "companyId"), null, opts);
  }
  async restore(companyId: string, opts: WriteOptions = {}) {
    return scopedRestore(this.sb, this.cfg, require1(companyId, "companyId"), null, opts);
  }
}

export class SupabaseCategoryPolicyRepository implements CategoryPolicyRepository {
  private cfg: ScopedTableConfig<CategoryPolicy>;
  constructor(private sb: SB) {
    this.cfg = {
      table: "category_pricing_policies",
      keyColumn: "category_id",
      kind: "CategoryPolicy",
      what: "CategoryPolicy",
      extractKey: (p) => p.categoryId,
      rehydrate: (p) => createCategoryPolicy(p),
    };
  }
  async findByCategory(companyId: string, categoryId: string) {
    return scopedFind(
      this.sb,
      this.cfg,
      require1(companyId, "companyId"),
      require1(categoryId, "categoryId"),
    );
  }
  async listByCompany(companyId: string, opts: ListOptions = {}) {
    return scopedList(this.sb, this.cfg, require1(companyId, "companyId"), opts);
  }
  async save(companyId: string, policy: CategoryPolicy, opts: WriteOptions = {}) {
    return scopedSave(this.sb, this.cfg, require1(companyId, "companyId"), policy, opts);
  }
  async softDelete(companyId: string, categoryId: string, opts: WriteOptions = {}) {
    return scopedSoftDelete(
      this.sb,
      this.cfg,
      require1(companyId, "companyId"),
      require1(categoryId, "categoryId"),
      opts,
    );
  }
  async restore(companyId: string, categoryId: string, opts: WriteOptions = {}) {
    return scopedRestore(
      this.sb,
      this.cfg,
      require1(companyId, "companyId"),
      require1(categoryId, "categoryId"),
      opts,
    );
  }
}

export class SupabaseProductPolicyRepository implements ProductPolicyRepository {
  private cfg: ScopedTableConfig<ProductPolicy>;
  constructor(private sb: SB) {
    this.cfg = {
      table: "product_pricing_policies",
      keyColumn: "product_id",
      kind: "ProductPolicy",
      what: "ProductPolicy",
      extractKey: (p) => p.productId,
      rehydrate: (p) => createProductPolicy(p),
    };
  }
  async findByProduct(companyId: string, productId: string) {
    return scopedFind(
      this.sb,
      this.cfg,
      require1(companyId, "companyId"),
      require1(productId, "productId"),
    );
  }
  async listByCompany(companyId: string, opts: ListOptions = {}) {
    return scopedList(this.sb, this.cfg, require1(companyId, "companyId"), opts);
  }
  async save(companyId: string, policy: ProductPolicy, opts: WriteOptions = {}) {
    return scopedSave(this.sb, this.cfg, require1(companyId, "companyId"), policy, opts);
  }
  async softDelete(companyId: string, productId: string, opts: WriteOptions = {}) {
    return scopedSoftDelete(
      this.sb,
      this.cfg,
      require1(companyId, "companyId"),
      require1(productId, "productId"),
      opts,
    );
  }
  async restore(companyId: string, productId: string, opts: WriteOptions = {}) {
    return scopedRestore(
      this.sb,
      this.cfg,
      require1(companyId, "companyId"),
      require1(productId, "productId"),
      opts,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PriceList — cabeçalho + entries (denormalizadas)
// ─────────────────────────────────────────────────────────────────────────────

export class SupabasePriceListRepository implements PriceListRepository {
  constructor(private sb: SB) {}

  private async load(companyId: string, priceListId: string) {
    const { data, error } = await this.sb
      .from("price_lists")
      .select("*, entries:price_list_entries(*)")
      .eq("company_id", companyId)
      .eq("price_list_key", priceListId)
      .maybeSingle();
    if (error) raise("find PriceList", error);
    return data ?? null;
  }

  async findById(companyId: string, priceListId: string) {
    require1(companyId, "companyId");
    require1(priceListId, "priceListId");
    const row = await this.load(companyId, priceListId);
    if (!row || row.deleted_at) return null;
    const aggregate = unwrapEnvelope<PriceListAggregate>(row.envelope, "PriceList");
    return { entity: aggregate, meta: rowToMeta(row) };
  }

  async listByCompany(companyId: string, opts: ListOptions = {}) {
    require1(companyId, "companyId");
    let query = this.sb
      .from("price_lists")
      .select("*, entries:price_list_entries(*)")
      .eq("company_id", companyId);
    if (!opts.includeDeleted) query = query.is("deleted_at", null);
    if (typeof opts.limit === "number") {
      const from = opts.offset ?? 0;
      query = query.range(from, from + opts.limit - 1);
    }
    const { data, error } = await query;
    if (error) raise("list PriceList", error);
    return (data ?? []).map((row) => ({
      entity: unwrapEnvelope<PriceListAggregate>(row.envelope, "PriceList"),
      meta: rowToMeta(row),
    }));
  }

  async save(companyId: string, aggregate: PriceListAggregate, opts: WriteOptions = {}) {
    require1(companyId, "companyId");
    require1(aggregate.priceListId, "aggregate.priceListId");
    const envelope = toEnvelope("PriceList", aggregate, nowIso());
    const existing = await this.load(companyId, aggregate.priceListId);
    if (existing) {
      if (typeof opts.expectedVersion === "number" && opts.expectedVersion !== existing.version) {
        throw concurrency("PriceList", opts.expectedVersion, existing.version);
      }
      const nextVersion = existing.version + 1;
      const { data: upd, error: uErr } = await this.sb
        .from("price_lists")
        .update({
          envelope,
          name: aggregate.name ?? null,
          currency: aggregate.currency,
          priority: aggregate.priority,
          scope: aggregate.scope,
          version: nextVersion,
          deleted_at: null,
        })
        .eq("id", existing.id)
        .eq("version", existing.version)
        .select("*")
        .maybeSingle();
      if (uErr) raise("update PriceList", uErr);
      if (!upd) throw concurrency("PriceList", existing.version, -1);

      await this.sb.from("price_list_entries").delete().eq("price_list_id", existing.id);
      await this.syncEntries(companyId, existing.id, aggregate);
      return { entity: aggregate, meta: rowToMeta(upd) };
    }

    if (typeof opts.expectedVersion === "number" && opts.expectedVersion !== 0) {
      throw concurrency("PriceList", opts.expectedVersion, 0);
    }
    const { data: ins, error: iErr } = await this.sb
      .from("price_lists")
      .insert({
        company_id: companyId,
        price_list_key: aggregate.priceListId,
        name: aggregate.name ?? null,
        currency: aggregate.currency,
        priority: aggregate.priority,
        scope: aggregate.scope,
        envelope,
        version: 1,
        created_by: opts.actor?.userId ?? null,
      })
      .select("*")
      .maybeSingle();
    if (iErr) raise("insert PriceList", iErr);
    if (!ins) throw storageFailure("insert PriceList returned no row");
    await this.syncEntries(companyId, ins.id, aggregate);
    return { entity: aggregate, meta: rowToMeta(ins) };
  }

  private async syncEntries(
    companyId: string,
    priceListRowId: string,
    aggregate: PriceListAggregate,
  ) {
    if (aggregate.entries.length === 0) return;
    const rows = aggregate.entries.map((e) => ({
      price_list_id: priceListRowId,
      company_id: companyId,
      product_id: e.productId,
      price_cents: e.priceCents,
      currency: e.currency,
      min_qty: e.minQty ?? null,
      max_qty: e.maxQty ?? null,
      fallback: e.fallback,
      priority: e.priority ?? aggregate.priority,
      entry: e,
    }));
    const { error } = await this.sb.from("price_list_entries").insert(rows);
    if (error) raise("insert price_list_entries", error);
  }

  async softDelete(companyId: string, priceListId: string, opts: WriteOptions = {}) {
    const row = await this.load(companyId, priceListId);
    if (!row) throw notFound("PriceList", priceListId);
    if (typeof opts.expectedVersion === "number" && opts.expectedVersion !== row.version) {
      throw concurrency("PriceList", opts.expectedVersion, row.version);
    }
    const { error } = await this.sb
      .from("price_lists")
      .update({ deleted_at: nowIso() })
      .eq("id", row.id)
      .eq("version", row.version);
    if (error) raise("soft-delete PriceList", error);
  }

  async restore(companyId: string, priceListId: string, opts: WriteOptions = {}) {
    const row = await this.load(companyId, priceListId);
    if (!row) throw notFound("PriceList", priceListId);
    if (typeof opts.expectedVersion === "number" && opts.expectedVersion !== row.version) {
      throw concurrency("PriceList", opts.expectedVersion, row.version);
    }
    const nextVersion = row.version + 1;
    const { data, error } = await this.sb
      .from("price_lists")
      .update({ deleted_at: null, version: nextVersion })
      .eq("id", row.id)
      .eq("version", row.version)
      .select("*")
      .maybeSingle();
    if (error) raise("restore PriceList", error);
    if (!data) throw concurrency("PriceList", row.version, -1);
    const aggregate = unwrapEnvelope<PriceListAggregate>(data.envelope, "PriceList");
    // rehydrate to guarantee canonical shape
    const rehydrated = createPriceList({
      priceListId: aggregate.priceListId,
      name: aggregate.name,
      currency: aggregate.currency,
      priority: aggregate.priority,
      scope: aggregate.scope,
      entries: aggregate.entries.map((e) => ({
        productId: e.productId,
        priceCents: e.priceCents,
        currency: e.currency,
        minQty: e.minQty,
        maxQty: e.maxQty,
        fallback: e.fallback,
        priority: e.priority,
      })),
    });
    return { entity: rehydrated, meta: rowToMeta(data) };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PricingDecision — append-only
// ─────────────────────────────────────────────────────────────────────────────

export class SupabasePricingDecisionRepository implements PricingDecisionRepository {
  constructor(private sb: SB) {}

  async append(snapshot: PricingDecisionSnapshot) {
    require1(snapshot.companyId, "snapshot.companyId");
    require1(snapshot.requestId, "snapshot.requestId");
    require1(snapshot.explainId, "snapshot.explainId");
    require1(snapshot.snapshotHash, "snapshot.snapshotHash");
    const { data, error } = await this.sb
      .from("pricing_decisions")
      .insert({
        company_id: snapshot.companyId,
        request_id: snapshot.requestId,
        explain_id: snapshot.explainId,
        engine_version: snapshot.engineVersion,
        calculation_version: snapshot.calculationVersion,
        context_version: snapshot.contextVersion,
        result_version: snapshot.resultVersion,
        policy_version: snapshot.policyVersion,
        snapshot_hash: snapshot.snapshotHash,
        applied_rules: snapshot.appliedRules,
        warnings: snapshot.warnings,
        context: snapshot.context,
        result: snapshot.result,
        explanation: snapshot.explanation ?? null,
        created_by: snapshot.createdBy ?? null,
      })
      .select("id, created_at")
      .maybeSingle();
    if (error) raise("append PricingDecision", error);
    if (!data) throw storageFailure("append PricingDecision returned no row");
    return { id: data.id, snapshot, createdAt: data.created_at };
  }

  async findByExplainId(companyId: string, explainId: string) {
    require1(companyId, "companyId");
    require1(explainId, "explainId");
    const { data, error } = await this.sb
      .from("pricing_decisions")
      .select("*")
      .eq("company_id", companyId)
      .eq("explain_id", explainId)
      .maybeSingle();
    if (error) raise("find PricingDecision", error);
    if (!data) return null;
    return rowToDecision(data);
  }

  async query(q: DecisionQuery) {
    require1(q.companyId, "companyId");
    let query = this.sb
      .from("pricing_decisions")
      .select("*")
      .eq("company_id", q.companyId)
      .order("created_at", { ascending: false });
    if (q.requestId) query = query.eq("request_id", q.requestId);
    if (q.explainId) query = query.eq("explain_id", q.explainId);
    if (q.since) query = query.gte("created_at", q.since);
    if (q.until) query = query.lte("created_at", q.until);
    if (typeof q.limit === "number") query = query.limit(q.limit);
    const { data, error } = await query;
    if (error) raise("query PricingDecision", error);
    return (data ?? []).map(rowToDecision);
  }
}

function rowToDecision(row: {
  id: string;
  company_id: string;
  request_id: string;
  explain_id: string;
  engine_version: string;
  calculation_version: string;
  context_version: string;
  result_version: string;
  policy_version: string;
  snapshot_hash: string;
  applied_rules: unknown;
  warnings: unknown;
  context: unknown;
  result: unknown;
  explanation: unknown;
  created_at: string;
  created_by?: string | null;
}): StoredPricingDecision {
  return {
    id: row.id,
    createdAt: row.created_at,
    snapshot: {
      companyId: row.company_id,
      requestId: row.request_id,
      explainId: row.explain_id,
      engineVersion: row.engine_version,
      calculationVersion: row.calculation_version,
      contextVersion: row.context_version,
      resultVersion: row.result_version,
      policyVersion: row.policy_version,
      snapshotHash: row.snapshot_hash,
      appliedRules: (row.applied_rules ?? []) as PricingDecisionSnapshot["appliedRules"],
      warnings: (row.warnings ?? []) as PricingDecisionSnapshot["warnings"],
      context: row.context as PricingDecisionSnapshot["context"],
      result: row.result as PricingDecisionSnapshot["result"],
      explanation: (row.explanation ?? undefined) as PricingDecisionSnapshot["explanation"],
      createdBy: row.created_by ?? undefined,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Factory
// ─────────────────────────────────────────────────────────────────────────────

export function createSupabaseRepositories(sb: SB): PricingRepositories {
  return {
    companyPolicies: new SupabaseCompanyPolicyRepository(sb),
    categoryPolicies: new SupabaseCategoryPolicyRepository(sb),
    productPolicies: new SupabaseProductPolicyRepository(sb),
    priceLists: new SupabasePriceListRepository(sb),
    pricingDecisions: new SupabasePricingDecisionRepository(sb),
  };
}

/** Constante exportada — usada por testes de contrato para versionamento. */
export const SUPABASE_PERSISTENCE_ENVELOPE = CONFIG_DOMAIN_VERSION;
