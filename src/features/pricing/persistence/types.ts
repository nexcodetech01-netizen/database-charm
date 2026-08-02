/**
 * Persistence Layer — Repository interfaces (Fase P4)
 * ====================================================
 * Contratos de infraestrutura para o domínio de Pricing.
 *
 * Estas interfaces são a ÚNICA porta de entrada para persistência.
 * Nenhum outro módulo — Core, Resolver, Config, UI — pode acessar
 * as tabelas do Pricing diretamente.
 *
 * Repositories APENAS persistem e recuperam. Regras de negócio (validações
 * de margem, coerência de PriceList, etc.) ficam no Commercial Configuration
 * Domain. Validações de infraestrutura (id ausente, versão nula) ficam aqui.
 *
 * Referências: ADR-001..010. Versionamento obrigatório (ADR-008).
 */
import type { PriceListAggregate } from "../config/price-list";
import type { CategoryPolicy, CompanyPolicy, ProductPolicy } from "../resolver/types";
import type {
  AppliedRule,
  PricingContext,
  PricingResult,
  PricingWarning,
  PricingExplanation,
} from "../engine/types";

// ─────────────────────────────────────────────────────────────────────────────
// Metadados de auditoria e versionamento
// ─────────────────────────────────────────────────────────────────────────────

export interface AuditMetadata {
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy?: string;
  readonly deletedAt?: string;
}

/** Metadados do registro. `version` é usado para concorrência otimista. */
export interface RecordMetadata extends AuditMetadata {
  readonly id: string;
  readonly companyId: string;
  readonly version: number;
}

/** Envelope combinando entidade de domínio + metadados de persistência. */
export interface StoredEntity<TEntity> {
  readonly entity: TEntity;
  readonly meta: RecordMetadata;
}

/** Ator responsável por uma escrita — usado para auditoria (`created_by`). */
export interface RepositoryActor {
  readonly userId?: string;
}

/** Opções comuns de escrita — carrega concorrência otimista opcional. */
export interface WriteOptions {
  /** Se informado, escrita falha com `CONCURRENCY` se versão divergir. */
  readonly expectedVersion?: number;
  readonly actor?: RepositoryActor;
}

export interface ListOptions {
  readonly includeDeleted?: boolean;
  readonly limit?: number;
  readonly offset?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// CompanyPolicyRepository — 1 política por empresa
// ─────────────────────────────────────────────────────────────────────────────

export interface CompanyPolicyRepository {
  findByCompany(companyId: string): Promise<StoredEntity<CompanyPolicy> | null>;
  save(policy: CompanyPolicy, opts?: WriteOptions): Promise<StoredEntity<CompanyPolicy>>;
  softDelete(companyId: string, opts?: WriteOptions): Promise<void>;
  restore(companyId: string, opts?: WriteOptions): Promise<StoredEntity<CompanyPolicy>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CategoryPolicyRepository — N por empresa (única por categoryId)
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryPolicyRepository {
  findByCategory(
    companyId: string,
    categoryId: string,
  ): Promise<StoredEntity<CategoryPolicy> | null>;
  listByCompany(
    companyId: string,
    opts?: ListOptions,
  ): Promise<readonly StoredEntity<CategoryPolicy>[]>;
  save(
    companyId: string,
    policy: CategoryPolicy,
    opts?: WriteOptions,
  ): Promise<StoredEntity<CategoryPolicy>>;
  softDelete(companyId: string, categoryId: string, opts?: WriteOptions): Promise<void>;
  restore(
    companyId: string,
    categoryId: string,
    opts?: WriteOptions,
  ): Promise<StoredEntity<CategoryPolicy>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ProductPolicyRepository — N por empresa (única por productId)
// ─────────────────────────────────────────────────────────────────────────────

export interface ProductPolicyRepository {
  findByProduct(companyId: string, productId: string): Promise<StoredEntity<ProductPolicy> | null>;
  listByCompany(
    companyId: string,
    opts?: ListOptions,
  ): Promise<readonly StoredEntity<ProductPolicy>[]>;
  save(
    companyId: string,
    policy: ProductPolicy,
    opts?: WriteOptions,
  ): Promise<StoredEntity<ProductPolicy>>;
  softDelete(companyId: string, productId: string, opts?: WriteOptions): Promise<void>;
  restore(
    companyId: string,
    productId: string,
    opts?: WriteOptions,
  ): Promise<StoredEntity<ProductPolicy>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PriceListRepository — agregado com entradas
// ─────────────────────────────────────────────────────────────────────────────

export interface PriceListRepository {
  findById(
    companyId: string,
    priceListId: string,
  ): Promise<StoredEntity<PriceListAggregate> | null>;
  listByCompany(
    companyId: string,
    opts?: ListOptions,
  ): Promise<readonly StoredEntity<PriceListAggregate>[]>;
  save(
    companyId: string,
    aggregate: PriceListAggregate,
    opts?: WriteOptions,
  ): Promise<StoredEntity<PriceListAggregate>>;
  softDelete(companyId: string, priceListId: string, opts?: WriteOptions): Promise<void>;
  restore(
    companyId: string,
    priceListId: string,
    opts?: WriteOptions,
  ): Promise<StoredEntity<PriceListAggregate>>;
}

// ─────────────────────────────────────────────────────────────────────────────
// PricingDecisionRepository — audit log imutável (append-only)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Snapshot completo de uma decisão de precificação.
 * Persistido apenas quando a aplicação SOLICITA (nunca automaticamente).
 *
 * Objetivo: auditoria fiscal (5+ anos) e reprodução do cálculo.
 * Ver ADR-005 (explain-api) e ADR-008 (engine-versioning).
 */
export interface PricingDecisionSnapshot {
  readonly companyId: string;
  readonly requestId: string;
  readonly explainId: string;
  readonly engineVersion: string;
  readonly calculationVersion: string;
  readonly contextVersion: string;
  readonly resultVersion: string;
  readonly policyVersion: string;
  readonly snapshotHash: string;
  readonly appliedRules: readonly AppliedRule[];
  readonly warnings: readonly PricingWarning[];
  readonly context: PricingContext;
  readonly result: PricingResult;
  readonly explanation?: PricingExplanation;
  readonly createdBy?: string;
}

export interface StoredPricingDecision {
  readonly id: string;
  readonly snapshot: PricingDecisionSnapshot;
  readonly createdAt: string;
}

export interface DecisionQuery {
  readonly companyId: string;
  readonly requestId?: string;
  readonly explainId?: string;
  readonly since?: string;
  readonly until?: string;
  readonly limit?: number;
}

export interface PricingDecisionRepository {
  /** Append imutável. Nunca sobrescreve. */
  append(snapshot: PricingDecisionSnapshot): Promise<StoredPricingDecision>;
  findByExplainId(companyId: string, explainId: string): Promise<StoredPricingDecision | null>;
  query(query: DecisionQuery): Promise<readonly StoredPricingDecision[]>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Bundle de repositórios — injetável nas camadas de aplicação
// ─────────────────────────────────────────────────────────────────────────────

export interface PricingRepositories {
  readonly companyPolicies: CompanyPolicyRepository;
  readonly categoryPolicies: CategoryPolicyRepository;
  readonly productPolicies: ProductPolicyRepository;
  readonly priceLists: PriceListRepository;
  readonly pricingDecisions: PricingDecisionRepository;
}

export const PERSISTENCE_VERSION = "pricing-persistence/1.0.0" as const;
