import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { ExecutiveDashboardWorkspace } from "@/features/bi";

export const Route = createFileRoute("/_authenticated/painel-executivo")({
  beforeLoad: requirePermission("reports.view"),
  component: PainelExecutivoPage,
});

function PainelExecutivoPage() {
  const { company } = Route.useRouteContext();
  return <ExecutiveDashboardWorkspace companyId={company.id} />;
}
