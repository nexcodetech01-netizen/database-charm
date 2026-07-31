import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { PriceReviewWorkspace } from "@/features/pricing/components/price-review-workspace";

export const Route = createFileRoute(
  "/_authenticated/inteligencia-comercial/revisao-precos",
)({
  beforeLoad: requirePermission("products.view"),
  component: PriceReviewPage,
});

function PriceReviewPage() {
  const { company } = Route.useRouteContext();
  return <PriceReviewWorkspace companyId={company.id} />;
}
