/**
 * Tool executors — porta que abstrai as chamadas à Application Layer.
 *
 * Em produção, `defaultToolExecutors` chama os server functions do Pricing
 * (`src/features/pricing/lib/*.functions.ts`) — que por sua vez consomem
 * exclusivamente Use Cases da Application Layer.
 *
 * Em testes, passa-se um objeto mock com as mesmas assinaturas → nenhum
 * acesso a Supabase, nenhuma dependência de HTTP.
 *
 * A separação garante que:
 *   1. Tools nunca importam Repositories, Engine, Resolver ou Supabase.
 *   2. Testes rodam offline com fixtures.
 *   3. Não há reimplementação de regra de negócio — só orquestração.
 */
import type {
  CategoryPoliciesOverviewDTO,
} from "@/features/pricing/lib/category-policy.functions";
import type { CommercialDashboardDTO } from "@/features/pricing/lib/commercial-dashboard.functions";
import type { CompanyPolicyOverviewDTO } from "@/features/pricing/lib/company-policy.functions";
import type {
  ApplyProductPriceResultDTO,
  PricingStrategy,
  ProductPricingIntelligenceDTO,
} from "@/features/pricing/lib/product-pricing.functions";
import type {
  SimulatePricingDTO,
  SimulatePricingInput,
} from "@/features/pricing/lib/pricing-simulator.functions";

export interface ToolExecutors {
  getCommercialDashboard(input: {
    companyId: string;
  }): Promise<CommercialDashboardDTO>;
  getCompanyPolicyOverview(input: {
    companyId: string;
  }): Promise<CompanyPolicyOverviewDTO>;
  getCategoryPoliciesOverview(input: {
    companyId: string;
  }): Promise<CategoryPoliciesOverviewDTO>;
  getProductPricingIntelligence(input: {
    companyId: string;
    productId: string;
  }): Promise<ProductPricingIntelligenceDTO>;
  simulatePricing(input: SimulatePricingInput): Promise<SimulatePricingDTO>;
  /**
   * SAFE ACTION — encapsula `ApplySuggestedPrice` + `RegisterPricingDecision`
   * do Application Layer. A auditoria fiscal já é feita pelo Use Case
   * (append-only) — o `AIInteractionEvent` marca `alreadyAudited=true`.
   */
  applyProductSuggestedPrice(input: {
    companyId: string;
    productId: string;
    strategy?: PricingStrategy;
  }): Promise<ApplyProductPriceResultDTO>;
}

/**
 * Produção: cada método chama o server function correspondente.
 * Import é dinâmico apenas para evitar pull-in em ambientes de teste que
 * não têm o runtime do TanStack Start disponível.
 */
export function createDefaultToolExecutors(): ToolExecutors {
  return {
    async getCommercialDashboard(input) {
      const mod = await import(
        "@/features/pricing/lib/commercial-dashboard.functions"
      );
      return mod.getCommercialDashboard({ data: input });
    },
    async getCompanyPolicyOverview(input) {
      const mod = await import(
        "@/features/pricing/lib/company-policy.functions"
      );
      return mod.getCompanyPolicyOverview({ data: input });
    },
    async getCategoryPoliciesOverview(input) {
      const mod = await import(
        "@/features/pricing/lib/category-policy.functions"
      );
      return mod.getCategoryPoliciesOverview({ data: input });
    },
    async getProductPricingIntelligence(input) {
      const mod = await import(
        "@/features/pricing/lib/product-pricing.functions"
      );
      return mod.getProductPricingIntelligence({ data: input });
    },
    async simulatePricing(input) {
      const mod = await import(
        "@/features/pricing/lib/pricing-simulator.functions"
      );
      return mod.simulatePricing({ data: input });
    },
    async applyProductSuggestedPrice(input) {
      const mod = await import(
        "@/features/pricing/lib/product-pricing.functions"
      );
      return mod.applyProductSuggestedPrice({ data: input });
    },
  };
}
