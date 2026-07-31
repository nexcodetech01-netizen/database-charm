/**
 * Application Layer — ports (dependency contracts)
 * ================================================
 * A camada Application NUNCA importa Supabase, React, HTTP.
 * Ela declara PORTAS (interfaces) que os adaptadores implementam:
 *   - Repositories (já vêm do módulo `persistence/types`)
 *   - PricingEngine port (compute + explain)
 *   - PolicyResolver port (buildPricingContext)
 *   - Clock port (para gerar `computedAt`, `requestId`, `explainId`)
 *   - IdGenerator port
 *   - Hasher port (snapshot hash determinístico)
 */
import type {
  PricingContext,
  PricingExplanation,
  PricingResult,
} from "../engine/types";
import type { PricingContextBundle } from "../resolver/pricing-context-factory";
import type { PricingContextInput } from "../resolver/types";
import type { PricingRepositories } from "../persistence/types";

/** Motor Core como porta injetável (a implementação real é `engine/compute` + `engine/explain`). */
export interface PricingEnginePort {
  compute(context: PricingContext): PricingResult;
  explain(result: PricingResult): PricingExplanation;
}

/** Resolver como porta injetável (implementação real é `resolver/buildPricingContext`). */
export interface PricingResolverPort {
  build(input: PricingContextInput): PricingContextBundle;
}

/** Clock — injetada (nunca ler `Date.now` em Use Cases). */
export interface ClockPort {
  nowIso(): string;
}

/** Gerador de ids opacos para requestId/explainId — injetável. */
export interface IdGeneratorPort {
  next(prefix?: string): string;
}

/** Hash determinístico usado no snapshot de PricingDecision. */
export interface HasherPort {
  hash(input: unknown): string;
}

/** Bundle único injetado nos Use Cases. */
export interface PricingApplicationDeps {
  readonly repositories: PricingRepositories;
  readonly engine: PricingEnginePort;
  readonly resolver: PricingResolverPort;
  readonly clock: ClockPort;
  readonly ids: IdGeneratorPort;
  readonly hasher: HasherPort;
}

/** Ator responsável (`created_by`) — propagado para Persistence. */
export interface Actor {
  readonly userId?: string;
  readonly module?: string;
}

/** Shape genérico de Use Case. */
export interface UseCase<TInput, TOutput> {
  execute(input: TInput): Promise<TOutput>;
}

export const APPLICATION_VERSION = "pricing-application/1.0.0" as const;
