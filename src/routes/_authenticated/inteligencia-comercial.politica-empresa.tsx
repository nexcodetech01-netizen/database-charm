import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { CompanyPolicyWorkspace } from "@/features/pricing/components/company-policy-workspace";

export const Route = createFileRoute(
  "/_authenticated/inteligencia-comercial/politica-empresa",
)({
  beforeLoad: requirePermission("products.view"),
  component: CompanyPolicyPage,
});

function CompanyPolicyPage() {
  const { company } = Route.useRouteContext();
  return <CompanyPolicyWorkspace companyId={company.id} />;
}
