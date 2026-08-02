/**
 * Use Case — UpdateCompanyPolicy
 * ==============================
 * Substitui a política atual (versionamento otimista obrigatório).
 */
import {
  createCompanyPolicy,
  validateCompanyPolicy,
  type CompanyPolicyInput,
} from "../../config/company-policy";
import type { StoredEntity } from "../../persistence/types";
import type { CompanyPolicy } from "../../resolver/types";
import { invalidArgument, notFound, validationFailed } from "../errors";
import type { Actor, PricingApplicationDeps, UseCase } from "../ports";
import { translateRepoError } from "./_internal";

export interface UpdateCompanyPolicyInput {
  readonly input: CompanyPolicyInput;
  readonly expectedVersion: number;
  readonly actor?: Actor;
}

export type UpdateCompanyPolicyOutput = StoredEntity<CompanyPolicy>;

export function createUpdateCompanyPolicyUseCase(
  deps: PricingApplicationDeps,
): UseCase<UpdateCompanyPolicyInput, UpdateCompanyPolicyOutput> {
  return {
    async execute({ input, expectedVersion, actor }) {
      if (!input) throw invalidArgument("input is required");
      if (typeof expectedVersion !== "number" || expectedVersion < 1) {
        throw invalidArgument("expectedVersion must be a positive number");
      }

      const issues = validateCompanyPolicy(input, "companyPolicy");
      if (issues.some((i) => i.severity === "error")) {
        throw validationFailed("CompanyPolicy inválida", issues);
      }

      const existing = await deps.repositories.companyPolicies.findByCompany(input.companyId);
      if (!existing) throw notFound("CompanyPolicy", input.companyId);

      const policy = createCompanyPolicy(input);
      try {
        return await deps.repositories.companyPolicies.save(policy, {
          expectedVersion,
          actor: { userId: actor?.userId },
        });
      } catch (err) {
        throw translateRepoError(err, "CompanyPolicy");
      }
    },
  };
}
