/**
 * Server functions — Company Commercial Policy (UX-001)
 * =====================================================
 * Ponte entre a UI e a Application Layer do Pricing.
 *
 * A UI NUNCA:
 *   - importa Repositories
 *   - importa o Pricing Engine
 *   - executa cálculo local
 *
 * Este módulo é a única entrada válida a partir de React.
 *
 * Padrão adotado (idêntico a `bella-pay.functions.ts`):
 *   - `.server.ts` fica isolado no bundler (Supabase repos + adapters);
 *   - dependências pesadas são carregadas dentro dos handlers via `await import`
 *     para evitar a armadilha do splitter do createServerFn.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerPermission } from "@/features/rbac/guards/server-guards";
import type { CompanyPolicyInput } from "@/features/pricing/config/company-policy";
import type { StoredEntity } from "@/features/pricing/persistence/types";
import type { CompanyPolicy } from "@/features/pricing/resolver/types";

// ─────────────────────────────────────────────────────────────────────────────
// Payload para UI (evita expor tipos de infraestrutura profundos)
// ─────────────────────────────────────────────────────────────────────────────

export interface CompanyPolicyOverviewDTO {
  readonly policy: StoredEntity<CompanyPolicy> | null;
  readonly stats: {
    readonly categoriesUsingPolicy: number;
    readonly productsOverriding: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// getCompanyPolicyOverview — leitura consolidada para Card 6 (Resumo) + form
// ─────────────────────────────────────────────────────────────────────────────

export const getCompanyPolicyOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) => {
    if (!input?.companyId) throw new Error("companyId é obrigatório");
    return input;
  })
  .handler(async ({ data, context }): Promise<CompanyPolicyOverviewDTO> => {
    const { createSupabaseRepositories } =
      await import("@/features/pricing/persistence/supabase.server");
    const repos = createSupabaseRepositories(context.supabase);

    const [policy, categories, products] = await Promise.all([
      repos.companyPolicies.findByCompany(data.companyId),
      repos.categoryPolicies.listByCompany(data.companyId),
      repos.productPolicies.listByCompany(data.companyId),
    ]);

    return {
      policy,
      stats: {
        categoriesUsingPolicy: categories.length,
        productsOverriding: products.length,
      },
    };
  });

// ─────────────────────────────────────────────────────────────────────────────
// saveCompanyPolicy — cria OU atualiza via Use Cases (Application Layer)
// ─────────────────────────────────────────────────────────────────────────────

export const saveCompanyPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { input: CompanyPolicyInput; expectedVersion?: number }) => {
    if (!input?.input?.companyId) throw new Error("companyId é obrigatório");
    return input;
  })
  .handler(async ({ data, context }) => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "products.update", {
      companyId: data.input.companyId,
      action: "pricing.company_policy.save",
      module: "pricing",
    });
    const [{ createSupabaseRepositories }, application] = await Promise.all([
      import("@/features/pricing/persistence/supabase.server"),
      import("@/features/pricing/application"),
    ]);

    const deps = {
      repositories: createSupabaseRepositories(context.supabase),
      engine: application.defaultEngine,
      resolver: application.defaultResolver,
      clock: application.systemClock,
      ids: application.createIdGenerator(),
      hasher: application.defaultHasher,
    };

    const actor = { userId: context.userId, module: "commercial-experience" };

    if (data.expectedVersion && data.expectedVersion > 0) {
      const uc = application.createUpdateCompanyPolicyUseCase(deps);
      return uc.execute({
        input: data.input,
        expectedVersion: data.expectedVersion,
        actor,
      });
    }

    const uc = application.createCreateCompanyPolicyUseCase(deps);
    return uc.execute({ input: data.input, actor });
  });
