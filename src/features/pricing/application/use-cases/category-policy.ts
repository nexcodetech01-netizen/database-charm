/**
 * Use Cases — CreateCategoryPolicy / UpdateCategoryPolicy
 */
import {
  createCategoryPolicy,
  validateCategoryPolicy,
  type CategoryPolicyInput,
} from "../../config/category-policy";
import type { StoredEntity } from "../../persistence/types";
import type { CategoryPolicy } from "../../resolver/types";
import {
  ApplicationError,
  invalidArgument,
  notFound,
  validationFailed,
} from "../errors";
import type { Actor, PricingApplicationDeps, UseCase } from "../ports";
import { requireString, translateRepoError } from "./_internal";

export interface CreateCategoryPolicyInput {
  readonly companyId: string;
  readonly input: CategoryPolicyInput;
  readonly actor?: Actor;
}
export interface UpdateCategoryPolicyInput {
  readonly companyId: string;
  readonly input: CategoryPolicyInput;
  readonly expectedVersion: number;
  readonly actor?: Actor;
}
export type CategoryPolicyOutput = StoredEntity<CategoryPolicy>;

export function createCreateCategoryPolicyUseCase(
  deps: PricingApplicationDeps,
): UseCase<CreateCategoryPolicyInput, CategoryPolicyOutput> {
  return {
    async execute({ companyId, input, actor }) {
      requireString(companyId, "companyId");
      if (!input) throw invalidArgument("input is required");

      const issues = validateCategoryPolicy(input, "categoryPolicy");
      if (issues.some((i) => i.severity === "error")) {
        throw validationFailed("CategoryPolicy inválida", issues);
      }

      const existing = await deps.repositories.categoryPolicies.findByCategory(
        companyId,
        input.categoryId,
      );
      if (existing) {
        throw new ApplicationError(
          "CONFLICT",
          `CategoryPolicy já existe`,
          { detail: { companyId, categoryId: input.categoryId } },
        );
      }

      try {
        return await deps.repositories.categoryPolicies.save(
          companyId,
          createCategoryPolicy(input),
          { expectedVersion: 0, actor: { userId: actor?.userId } },
        );
      } catch (err) {
        throw translateRepoError(err, "CategoryPolicy");
      }
    },
  };
}

export function createUpdateCategoryPolicyUseCase(
  deps: PricingApplicationDeps,
): UseCase<UpdateCategoryPolicyInput, CategoryPolicyOutput> {
  return {
    async execute({ companyId, input, expectedVersion, actor }) {
      requireString(companyId, "companyId");
      if (!input) throw invalidArgument("input is required");
      if (typeof expectedVersion !== "number" || expectedVersion < 1) {
        throw invalidArgument("expectedVersion must be a positive number");
      }
      const issues = validateCategoryPolicy(input, "categoryPolicy");
      if (issues.some((i) => i.severity === "error")) {
        throw validationFailed("CategoryPolicy inválida", issues);
      }
      const existing = await deps.repositories.categoryPolicies.findByCategory(
        companyId,
        input.categoryId,
      );
      if (!existing) throw notFound("CategoryPolicy", input.categoryId);
      try {
        return await deps.repositories.categoryPolicies.save(
          companyId,
          createCategoryPolicy(input),
          { expectedVersion, actor: { userId: actor?.userId } },
        );
      } catch (err) {
        throw translateRepoError(err, "CategoryPolicy");
      }
    },
  };
}
