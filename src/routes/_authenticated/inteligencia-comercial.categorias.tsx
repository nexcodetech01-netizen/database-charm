import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { CategoryPoliciesWorkspace } from "@/features/pricing/components/category-policies-workspace";

export const Route = createFileRoute(
  "/_authenticated/inteligencia-comercial/categorias",
)({
  beforeLoad: requirePermission("products.view"),
  component: CategoryPoliciesPage,
});

function CategoryPoliciesPage() {
  const { company } = Route.useRouteContext();
  return <CategoryPoliciesWorkspace companyId={company.id} />;
}
