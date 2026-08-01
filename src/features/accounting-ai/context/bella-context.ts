/**
 * BellaContext (Sprint 7.2.1) — contexto único de leitura da Bella.
 *
 * Substitui a montagem manual e repetida de `ProviderDeps` por um objeto
 * com resolvers LAZY e MEMOIZADOS: cada retrato (summary, tributário,
 * auditoria) é lido no máximo uma vez por contexto, mesmo que várias
 * skills/painéis peçam o mesmo dado.
 *
 * Regras mantidas:
 *  - somente leitura; nenhum cálculo novo, nenhuma regra de negócio;
 *  - todo dado continua vindo dos providers oficiais já existentes;
 *  - `toDeps()` devolve exatamente o mesmo shape de `ProviderDeps`, para
 *    que nenhum consumidor atual precise mudar de contrato.
 */
import type { AuditSnapshot } from "../audit/types";
import { auditProvider } from "../audit/provider";
import { taxRegimeProvider } from "../tax/provider";
import type { BellaTaxSimulationInput, BellaTaxSnapshot } from "../tax/types";
import { buildAccountingSummary } from "../providers/summary";
import type { ProviderDeps } from "../providers";
import type { AccountingAiServices } from "../services/ports";
import { accountingAiServices } from "../services/adapters";
import { currentPeriod, todayISO } from "../lib/helpers";
import type { AccountingPeriod, AccountingSummary, ProviderResult } from "../types";

export interface BellaContextInput {
  companyId: string;
  period?: AccountingPeriod;
  today?: string;
  services?: AccountingAiServices;
  simulation?: BellaTaxSimulationInput | null;
  /** Retratos já disponíveis (ex.: vindos de um cache de rota). */
  preloaded?: {
    summary?: AccountingSummary | null;
    tax?: ProviderResult<BellaTaxSnapshot> | null;
    audit?: ProviderResult<AuditSnapshot> | null;
  };
}

export interface BellaSnapshots {
  summary: AccountingSummary;
  tax: ProviderResult<BellaTaxSnapshot>;
  audit: ProviderResult<AuditSnapshot>;
}

export interface BellaContext {
  readonly companyId: string;
  readonly period: AccountingPeriod;
  readonly today: string;
  readonly services: AccountingAiServices;
  readonly simulation: BellaTaxSimulationInput | null;
  /** Resumo consolidado — memoizado. */
  summary(): Promise<AccountingSummary>;
  /** Retrato tributário oficial — memoizado. */
  tax(): Promise<ProviderResult<BellaTaxSnapshot>>;
  /** Retrato de auditoria — memoizado. */
  audit(): Promise<ProviderResult<AuditSnapshot>>;
  /** Os três retratos em paralelo (sem waterfall). */
  snapshots(): Promise<BellaSnapshots>;
  /** `ProviderDeps` equivalente, já com o que estiver resolvido. */
  toDeps(overrides?: Partial<ProviderDeps>): ProviderDeps;
  /** Quantas leituras realmente aconteceram (telemetria/testes). */
  readonly stats: { summary: number; tax: number; audit: number };
}

function memoize<T>(load: () => Promise<T>, onLoad: () => void, initial?: T | null) {
  let cached: Promise<T> | null =
    initial === undefined || initial === null ? null : Promise.resolve(initial);
  return () => {
    if (!cached) {
      onLoad();
      cached = load().catch((error) => {
        cached = null;
        throw error;
      });
    }
    return cached;
  };
}

export function createBellaContext(input: BellaContextInput): BellaContext {
  const period = input.period ?? currentPeriod();
  const today = input.today ?? todayISO();
  const services = input.services ?? accountingAiServices;
  const simulation = input.simulation ?? null;
  const stats = { summary: 0, tax: 0, audit: 0 };

  let resolvedSummary: AccountingSummary | null = input.preloaded?.summary ?? null;
  let resolvedTax: ProviderResult<BellaTaxSnapshot> | null = input.preloaded?.tax ?? null;
  let resolvedAudit: ProviderResult<AuditSnapshot> | null = input.preloaded?.audit ?? null;

  const baseDeps = (): ProviderDeps => ({
    services,
    period,
    today,
    simulation,
  });

  const summary = memoize<AccountingSummary>(
    async () => {
      const data = await buildAccountingSummary(input.companyId, baseDeps());
      resolvedSummary = data;
      return data;
    },
    () => {
      stats.summary += 1;
    },
    resolvedSummary,
  );

  const tax = memoize<ProviderResult<BellaTaxSnapshot>>(
    async () => {
      const data = await taxRegimeProvider(input.companyId, baseDeps());
      resolvedTax = data;
      return data;
    },
    () => {
      stats.tax += 1;
    },
    resolvedTax,
  );

  const audit = memoize<ProviderResult<AuditSnapshot>>(
    async () => {
      const data = await auditProvider(input.companyId, baseDeps());
      resolvedAudit = data;
      return data;
    },
    () => {
      stats.audit += 1;
    },
    resolvedAudit,
  );

  return {
    companyId: input.companyId,
    period,
    today,
    services,
    simulation,
    summary,
    tax,
    audit,
    async snapshots() {
      const [s, t, a] = await Promise.all([summary(), tax(), audit()]);
      return { summary: s, tax: t, audit: a };
    },
    toDeps(overrides) {
      return {
        ...baseDeps(),
        summary: resolvedSummary,
        taxSnapshot: resolvedTax,
        auditSnapshot: resolvedAudit,
        ...overrides,
      };
    },
    stats,
  };
}
