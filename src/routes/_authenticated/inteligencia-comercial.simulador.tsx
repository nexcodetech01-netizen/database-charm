import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { PricingSimulatorWorkspace } from "@/features/pricing/components/pricing-simulator-workspace";

export const Route = createFileRoute(
  "/_authenticated/inteligencia-comercial/simulador",
)({
  beforeLoad: requirePermission("products.view"),
  component: PricingSimulatorPage,
});

function PricingSimulatorPage() {
  const { company } = Route.useRouteContext();
  return <PricingSimulatorWorkspace companyId={company.id} />;
}
