/**
 * Use Case — CreateCompanyPolicy
 * ==============================
 * Cria a política comercial de uma empresa. Falha se já existir uma ativa.
 * Delega validação de coerência ao Commercial Configuration Domain.
 */
import {
  createCompanyPolicy,
  validateCompanyPolicy,
  type CompanyPolicyInput,
} from "../../config/company-policy";

import type { StoredEntity } from "../../persistence/types";
import type { CompanyPolicy } from "../../resolver/types";
import { ApplicationError, invalidArgument, validationFailed } from "../errors";
import type { Actor, PricingApplicationDeps, UseCase } from "../ports";
import { translateRepoError } from "./_internal";

export interface CreateCompanyPolicyInput {
  readonly input: CompanyPolicyInput;
  readonly actor?: Actor;
}

export type CreateCompanyPolicyOutput = StoredEntity<CompanyPolicy>;

export function createCreateCompanyPolicyUseCase(
  deps: PricingApplicationDeps,
): UseCase<CreateCompanyPolicyInput, CreateCompanyPolicyOutput> {
  return {
    async execute({ input, actor }) {
      if (!input) throw invalidArgument("input is required");

      const issues = validateCompanyPolicy(input, "companyPolicy");
      if (issues.some((i) => i.severity === "error")) {
        throw validationFailed("CompanyPolicy inválida", issues);
      }

      const existing = await deps.repositories.companyPolicies.findByCompany(input.companyId);
      if (existing) {
        throw new ApplicationError("CONFLICT", `CompanyPolicy já existe para ${input.companyId}`, {
          detail: { companyId: input.companyId },
        });
      }

      const policy = createCompanyPolicy(input);
      try {
        return await deps.repositories.companyPolicies.save(policy, {
          expectedVersion: 0,
          actor: { userId: actor?.userId },
        });
      } catch (err) {
        throw translateRepoError(err, "CompanyPolicy");
      }
    },
  };
}
