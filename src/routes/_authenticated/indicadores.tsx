import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { KpiCenterWorkspace } from "@/features/kpi-center";

export const Route = createFileRoute("/_authenticated/indicadores")({
  beforeLoad: requirePermission("reports.view"),
  component: IndicadoresPage,
});

function IndicadoresPage() {
  const { company } = Route.useRouteContext();
  return <KpiCenterWorkspace companyId={company.id} />;
}
