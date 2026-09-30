import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { BellaContadoraDashboard } from "@/features/accounting-ai";

export const Route = createFileRoute("/_authenticated/bella-contadora")({
  beforeLoad: requirePermission("reports.view"),
  component: BellaContadoraPage,
});

function BellaContadoraPage() {
  const { company } = Route.useRouteContext();
  return <BellaContadoraDashboard companyId={company.id} />;
}
