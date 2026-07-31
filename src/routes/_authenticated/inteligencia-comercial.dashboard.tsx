import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { CommercialDashboardWorkspace } from "@/features/pricing/components/commercial-dashboard-workspace";

export const Route = createFileRoute(
  "/_authenticated/inteligencia-comercial/dashboard",
)({
  beforeLoad: requirePermission("products.view"),
  component: CommercialDashboardPage,
});

function CommercialDashboardPage() {
  const { company } = Route.useRouteContext();
  return <CommercialDashboardWorkspace companyId={company.id} />;
}
