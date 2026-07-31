/**
 * Use Case — ResolvePricing
 * =========================
 * Carrega as políticas persistidas (Company/Category/Product + PriceLists ativas),
 * monta o `PricingContextInput`, delega ao Resolver e devolve o bundle
 * `{ context, resolution }` sem invocar o Core. Útil para diagnóstico e para
 * consumidores que precisam do contexto antes de calcular.
 */
import type { PricingContextBundle } from "../../resolver/pricing-context-factory";
import type { PricingContextInput } from "../../resolver/types";
import { invalidArgument, notFound } from "../errors";
import type { PricingApplicationDeps, UseCase } from "../ports";
import { requireString, translateRepoError } from "./_internal";

/** Campos que o caller deve fornecer — o restante é buscado ou defaultado. */
export interface ResolvePricingInput {
  readonly companyId: string;
  readonly productId: string;
  readonly categoryId?: string;
  readonly quantity: number;
  readonly context: Pick<
    PricingContextInput,
    | "costComposition"
    | "channel"
    | "taxQuote"
    | "customerSegment"
    | "store"
    | "contextOverrides"
    | "currency"
    | "clock"
    | "requestedBy"
  >;
  /** Se omitido, gerado. Ids são opacos. */
  readonly requestId?: string;
}

export function createResolvePricingUseCase(
  deps: PricingApplicationDeps,
): UseCase<ResolvePricingInput, PricingContextBundle> {
  return {
    async execute(input) {
      requireString(input.companyId, "companyId");
      requireString(input.productId, "productId");
      if (!input.context) throw invalidArgument("context is required");
      if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
        throw invalidArgument("quantity must be > 0");
      }

      try {
        const companyEnt = await deps.repositories.companyPolicies.findByCompany(
          input.companyId,
        );
        if (!companyEnt) throw notFound("CompanyPolicy", input.companyId);

        const productEnt = await deps.repositories.productPolicies.findByProduct(
          input.companyId,
          input.productId,
        );
        if (!productEnt) throw notFound("ProductPolicy", input.productId);

        const categoryEnt = input.categoryId
          ? await deps.repositories.categoryPolicies.findByCategory(
              input.companyId,
              input.categoryId,
            )
          : null;

        const priceListEntities =
          await deps.repositories.priceLists.listByCompany(input.companyId, {
            includeDeleted: false,
          });

        const priceListCandidates = priceListEntities.flatMap(
          (pl) => pl.entity.entries,
        );

        const resolverInput: PricingContextInput = {
          company: companyEnt.entity,
          category: categoryEnt?.entity,
          product: productEnt.entity,
          quantity: input.quantity,
          costComposition: input.context.costComposition,
          channel: input.context.channel,
          taxQuote: input.context.taxQuote,
          customerSegment: input.context.customerSegment,
          store: input.context.store,
          contextOverrides: input.context.contextOverrides,
          currency: input.context.currency,
          clock: input.context.clock,
          requestId: input.requestId ?? deps.ids.next("req"),
          requestedBy: input.context.requestedBy,
          priceListCandidates,
        };

        return deps.resolver.build(resolverInput);
      } catch (err) {
        throw translateRepoError(err, "ResolvePricing");
      }
    },
  };
}
