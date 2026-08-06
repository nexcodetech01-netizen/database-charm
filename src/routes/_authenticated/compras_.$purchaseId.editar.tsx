import { createFileRoute, notFound } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { Skeleton } from "@/components/ui/skeleton";
import { PurchaseForm, usePurchase } from "@/features/purchases";

export const Route = createFileRoute("/_authenticated/compras_/$purchaseId/editar")({
  beforeLoad: requirePermission("purchases.update"),
  component: EditPurchasePage,
});

function EditPurchasePage() {
  const { company } = Route.useRouteContext();
  const { purchaseId } = Route.useParams();
  const { data: purchase, isLoading } = usePurchase(purchaseId);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4 p-4 sm:p-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!purchase) throw notFound();

  return <PurchaseForm companyId={company.id} purchase={purchase} />;
}
