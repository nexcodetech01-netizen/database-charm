import { createFileRoute, notFound } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { Skeleton } from "@/components/ui/skeleton";
import { PurchaseForm, usePurchase } from "@/features/purchases";
import { LoadErrorPage } from "@/components/layout/state-views";

export const Route = createFileRoute("/_authenticated/compras_/$purchaseId/editar")({
  beforeLoad: requirePermission("purchases.update"),
  component: EditPurchasePage,
});

function EditPurchasePage() {
  const { company } = Route.useRouteContext();
  const { purchaseId } = Route.useParams();
  const { data: purchase, isLoading, isError: loadError, refetch: retryLoad } = usePurchase(purchaseId);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-4 p-4 sm:p-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (loadError && !purchase) {
    return <LoadErrorPage what="esta compra" onRetry={() => void retryLoad()} />;
  }
  if (!purchase) throw notFound();

  return <PurchaseForm companyId={company.id} purchase={purchase} />;
}
