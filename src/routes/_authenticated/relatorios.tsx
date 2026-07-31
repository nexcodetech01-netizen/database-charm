import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { CentralWorkspace } from "@/features/reports/central";

export const Route = createFileRoute("/_authenticated/relatorios")({
  beforeLoad: requirePermission("reports.view"),
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const { company } = Route.useRouteContext();
  return <CentralWorkspace companyId={company.id} />;
}
