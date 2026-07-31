/**
 * Use Case — RegisterPricingDecision
 * ==================================
 * Append-only. Registro explícito de decisão de precificação para auditoria
 * fiscal (5+ anos) e reprodutibilidade histórica.
 *
 * O snapshot pode ser construído pelo consumidor OU obtido de
 * `ApplySuggestedPrice`. Idempotência via `(companyId, explainId)`:
 * se já existir, devolve o registro existente sem duplicar.
 */
import type {
  PricingDecisionSnapshot,
  StoredPricingDecision,
} from "../../persistence/types";
import { invalidArgument } from "../errors";
import type { PricingApplicationDeps, UseCase } from "../ports";
import { requireString, translateRepoError } from "./_internal";

export interface RegisterPricingDecisionInput {
  readonly snapshot: PricingDecisionSnapshot;
}

export function createRegisterPricingDecisionUseCase(
  deps: PricingApplicationDeps,
): UseCase<RegisterPricingDecisionInput, StoredPricingDecision> {
  return {
    async execute({ snapshot }) {
      if (!snapshot) throw invalidArgument("snapshot is required");
      requireString(snapshot.companyId, "snapshot.companyId");
      requireString(snapshot.explainId, "snapshot.explainId");
      requireString(snapshot.requestId, "snapshot.requestId");
      requireString(snapshot.snapshotHash, "snapshot.snapshotHash");

      try {
        const existing = await deps.repositories.pricingDecisions.findByExplainId(
          snapshot.companyId,
          snapshot.explainId,
        );
        if (existing) return existing;
        return await deps.repositories.pricingDecisions.append(snapshot);
      } catch (err) {
        throw translateRepoError(err, "PricingDecision");
      }
    },
  };
}
