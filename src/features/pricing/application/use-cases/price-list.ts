/**
 * Use Cases — PriceList: Create / Update / Activate / Deactivate
 *
 * Domínio não carrega flag `active` no PriceListAggregate — o estado de
 * ativação é derivado do soft-delete no repositório (deletedAt).
 * Activate = restore, Deactivate = softDelete. Nenhum PriceList é apagado.
 */
import {
  createPriceList,
  validatePriceList,
  type PriceListAggregate,
  type PriceListInput,
} from "../../config/price-list";
import type { StoredEntity } from "../../persistence/types";
import { ApplicationError, invalidArgument, notFound, validationFailed } from "../errors";
import type { Actor, PricingApplicationDeps, UseCase } from "../ports";
import { requireString, translateRepoError } from "./_internal";

export type PriceListOutput = StoredEntity<PriceListAggregate>;

export interface CreatePriceListInput {
  readonly companyId: string;
  readonly input: PriceListInput;
  readonly actor?: Actor;
}
export interface UpdatePriceListInput {
  readonly companyId: string;
  readonly input: PriceListInput;
  readonly expectedVersion: number;
  readonly actor?: Actor;
}
export interface TogglePriceListInput {
  readonly companyId: string;
  readonly priceListId: string;
  readonly expectedVersion?: number;
  readonly actor?: Actor;
}

function validateOrThrow(aggregate: PriceListAggregate): void {
  const issues = validatePriceList(aggregate, "priceList");
  if (issues.some((i) => i.severity === "error")) {
    throw validationFailed("PriceList inválida", issues);
  }
}

export function createCreatePriceListUseCase(
  deps: PricingApplicationDeps,
): UseCase<CreatePriceListInput, PriceListOutput> {
  return {
    async execute({ companyId, input, actor }) {
      requireString(companyId, "companyId");
      if (!input) throw invalidArgument("input is required");
      const aggregate = createPriceList(input);
      validateOrThrow(aggregate);
      const existing = await deps.repositories.priceLists.findById(
        companyId,
        aggregate.priceListId,
      );
      if (existing) {
        throw new ApplicationError("CONFLICT", "PriceList já existe", {
          detail: { companyId, priceListId: aggregate.priceListId },
        });
      }
      try {
        return await deps.repositories.priceLists.save(companyId, aggregate, {
          expectedVersion: 0,
          actor: { userId: actor?.userId },
        });
      } catch (err) {
        throw translateRepoError(err, "PriceList");
      }
    },
  };
}

export function createUpdatePriceListUseCase(
  deps: PricingApplicationDeps,
): UseCase<UpdatePriceListInput, PriceListOutput> {
  return {
    async execute({ companyId, input, expectedVersion, actor }) {
      requireString(companyId, "companyId");
      if (!input) throw invalidArgument("input is required");
      if (typeof expectedVersion !== "number" || expectedVersion < 1) {
        throw invalidArgument("expectedVersion must be a positive number");
      }
      const aggregate = createPriceList(input);
      validateOrThrow(aggregate);
      const existing = await deps.repositories.priceLists.findById(
        companyId,
        aggregate.priceListId,
      );
      if (!existing) throw notFound("PriceList", aggregate.priceListId);
      try {
        return await deps.repositories.priceLists.save(companyId, aggregate, {
          expectedVersion,
          actor: { userId: actor?.userId },
        });
      } catch (err) {
        throw translateRepoError(err, "PriceList");
      }
    },
  };
}

export function createActivatePriceListUseCase(
  deps: PricingApplicationDeps,
): UseCase<TogglePriceListInput, PriceListOutput> {
  return {
    async execute({ companyId, priceListId, expectedVersion, actor }) {
      requireString(companyId, "companyId");
      requireString(priceListId, "priceListId");
      try {
        return await deps.repositories.priceLists.restore(companyId, priceListId, {
          expectedVersion,
          actor: { userId: actor?.userId },
        });
      } catch (err) {
        throw translateRepoError(err, "PriceList");
      }
    },
  };
}

export function createDeactivatePriceListUseCase(
  deps: PricingApplicationDeps,
): UseCase<TogglePriceListInput, void> {
  return {
    async execute({ companyId, priceListId, expectedVersion, actor }) {
      requireString(companyId, "companyId");
      requireString(priceListId, "priceListId");
      try {
        await deps.repositories.priceLists.softDelete(companyId, priceListId, {
          expectedVersion,
          actor: { userId: actor?.userId },
        });
      } catch (err) {
        throw translateRepoError(err, "PriceList");
      }
    },
  };
}
