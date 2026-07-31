/**
 * Use Cases — CreateProductPolicy / UpdateProductPolicy
 */
import {
  createProductPolicy,
  validateProductPolicy,
  type ProductPolicyInput,
} from "../../config/product-policy";
import type { StoredEntity } from "../../persistence/types";
import type { ProductPolicy } from "../../resolver/types";
import {
  ApplicationError,
  invalidArgument,
  notFound,
  validationFailed,
} from "../errors";
import type { Actor, PricingApplicationDeps, UseCase } from "../ports";
import { requireString, translateRepoError } from "./_internal";

export interface CreateProductPolicyInput {
  readonly companyId: string;
  readonly input: ProductPolicyInput;
  readonly actor?: Actor;
}
export interface UpdateProductPolicyInput {
  readonly companyId: string;
  readonly input: ProductPolicyInput;
  readonly expectedVersion: number;
  readonly actor?: Actor;
}
export type ProductPolicyOutput = StoredEntity<ProductPolicy>;

export function createCreateProductPolicyUseCase(
  deps: PricingApplicationDeps,
): UseCase<CreateProductPolicyInput, ProductPolicyOutput> {
  return {
    async execute({ companyId, input, actor }) {
      requireString(companyId, "companyId");
      if (!input) throw invalidArgument("input is required");
      const issues = validateProductPolicy(input, "productPolicy");
      if (issues.some((i) => i.severity === "error")) {
        throw validationFailed("ProductPolicy inválida", issues);
      }
      const existing = await deps.repositories.productPolicies.findByProduct(
        companyId,
        input.productId,
      );
      if (existing) {
        throw new ApplicationError("CONFLICT", "ProductPolicy já existe", {
          detail: { companyId, productId: input.productId },
        });
      }
      try {
        return await deps.repositories.productPolicies.save(
          companyId,
          createProductPolicy(input),
          { expectedVersion: 0, actor: { userId: actor?.userId } },
        );
      } catch (err) {
        throw translateRepoError(err, "ProductPolicy");
      }
    },
  };
}

export function createUpdateProductPolicyUseCase(
  deps: PricingApplicationDeps,
): UseCase<UpdateProductPolicyInput, ProductPolicyOutput> {
  return {
    async execute({ companyId, input, expectedVersion, actor }) {
      requireString(companyId, "companyId");
      if (!input) throw invalidArgument("input is required");
      if (typeof expectedVersion !== "number" || expectedVersion < 1) {
        throw invalidArgument("expectedVersion must be a positive number");
      }
      const issues = validateProductPolicy(input, "productPolicy");
      if (issues.some((i) => i.severity === "error")) {
        throw validationFailed("ProductPolicy inválida", issues);
      }
      const existing = await deps.repositories.productPolicies.findByProduct(
        companyId,
        input.productId,
      );
      if (!existing) throw notFound("ProductPolicy", input.productId);
      try {
        return await deps.repositories.productPolicies.save(
          companyId,
          createProductPolicy(input),
          { expectedVersion, actor: { userId: actor?.userId } },
        );
      } catch (err) {
        throw translateRepoError(err, "ProductPolicy");
      }
    },
  };
}
