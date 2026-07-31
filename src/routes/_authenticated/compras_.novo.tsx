import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { PurchaseForm } from "@/features/purchases";

export const Route = createFileRoute("/_authenticated/compras_/novo")({
  beforeLoad: requirePermission("purchases.view"),
  component: NewPurchasePage,
});

function NewPurchasePage() {
  const { company } = Route.useRouteContext();
  return <PurchaseForm companyId={company.id} />;
}
