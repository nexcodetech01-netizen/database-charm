/**
 * Server functions — Category Commercial Policies (UX-002)
 * ========================================================
 * Ponte entre a UI e a Application Layer do Pricing.
 *
 * A UI NUNCA:
 *   - importa Repositories
 *   - importa o Pricing Engine
 *   - executa cálculo local
 *
 * Toda escrita passa pelos Use Cases (`CreateCategoryPolicy` / `UpdateCategoryPolicy`).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireServerPermission } from "@/features/rbac/guards/server-guards";
import type { CategoryPolicyInput } from "@/features/pricing/config/category-policy";
import type { StoredEntity } from "@/features/pricing/persistence/types";
import type { CategoryPolicy, CompanyPolicy } from "@/features/pricing/resolver/types";

// ─────────────────────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────────────────────

export interface CategoryRow {
  readonly id: string;
  readonly name: string;
  readonly parentId: string | null;
  readonly color: string | null;
  readonly icon: string | null;
  readonly status: string | null;
}

export interface CategoryPolicyRow {
  readonly category: CategoryRow;
  /** Política própria (quando existe). Null significa herdada da empresa. */
  readonly policy: StoredEntity<CategoryPolicy> | null;
}

export interface CategoryPoliciesOverviewDTO {
  readonly companyPolicy: StoredEntity<CompanyPolicy> | null;
  readonly rows: readonly CategoryPolicyRow[];
}

// ─────────────────────────────────────────────────────────────────────────────
// getCategoryPoliciesOverview — leitura consolidada da tela
// ─────────────────────────────────────────────────────────────────────────────

export const getCategoryPoliciesOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string }) => {
    if (!input?.companyId) throw new Error("companyId é obrigatório");
    return input;
  })
  .handler(async ({ data, context }): Promise<CategoryPoliciesOverviewDTO> => {
    const { createSupabaseRepositories } =
      await import("@/features/pricing/persistence/supabase.server");
    const repos = createSupabaseRepositories(context.supabase);

    const [companyPolicy, categoryPolicies, categoriesRes] = await Promise.all([
      repos.companyPolicies.findByCompany(data.companyId),
      repos.categoryPolicies.listByCompany(data.companyId),
      context.supabase
        .from("product_categories")
        .select("id, name, parent_id, color, icon, status")
        .eq("company_id", data.companyId)
        .order("name"),
    ]);

    if (categoriesRes.error) throw categoriesRes.error;

    const policyByCategory = new Map<string, StoredEntity<CategoryPolicy>>();
    for (const p of categoryPolicies) {
      policyByCategory.set(p.entity.categoryId, p);
    }

    const rows: CategoryPolicyRow[] = (categoriesRes.data ?? []).map((c) => ({
      category: {
        id: c.id,
        name: c.name,
        parentId: c.parent_id,
        color: c.color,
        icon: c.icon,
        status: c.status,
      },
      policy: policyByCategory.get(c.id) ?? null,
    }));

    return { companyPolicy, rows };
  });

// ─────────────────────────────────────────────────────────────────────────────
// saveCategoryPolicy — cria OU atualiza via Use Cases (Application Layer)
// ─────────────────────────────────────────────────────────────────────────────

export const saveCategoryPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { companyId: string; input: CategoryPolicyInput; expectedVersion?: number }) => {
      if (!input?.companyId) throw new Error("companyId é obrigatório");
      if (!input?.input?.categoryId) throw new Error("categoryId é obrigatório");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    // Hardening RBAC server-side (a UI não é barreira de segurança).
    await requireServerPermission(context, "products.update", {
      companyId: data.companyId,
      action: "pricing.category_policy.save",
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

    const result =
      data.expectedVersion && data.expectedVersion > 0
        ? await application
            .createUpdateCategoryPolicyUseCase(deps)
            .execute({
              companyId: data.companyId,
              input: data.input,
              expectedVersion: data.expectedVersion,
              actor,
            })
        : await application
            .createCreateCategoryPolicyUseCase(deps)
            .execute({ companyId: data.companyId, input: data.input, actor });

    // Espelha as margens nas colunas lidas pelo Motor Comercial V2, para que
    // política (UI) e motor jamais divirjam. Best-effort: não bloqueia o save.
    try {
      const { categoryMarginColumns } = await import(
        "@/features/pricing/lib/category-margin-mirror"
      );
      await context.supabase
        .from("product_categories")
        .update(categoryMarginColumns(data.input))
        .eq("id", data.input.categoryId)
        .eq("company_id", data.companyId);
    } catch (err) {
      console.warn("[category-policy] falha ao espelhar margens da categoria", err);
    }

    return result;
  });
