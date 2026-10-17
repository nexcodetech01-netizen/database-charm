import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { BatchPhotosWorkspace } from "@/features/products/batch-photos/components/batch-photos-workspace";

export const Route = createFileRoute("/_authenticated/produtos_/fotos-em-lote")({
  head: () => ({ meta: [{ title: "Fotos em lote — NexOS" }] }),
  beforeLoad: requirePermission("products.view"),
  component: BatchPhotosPage,
});

function BatchPhotosPage() {
  const { company } = Route.useRouteContext();
  return <BatchPhotosWorkspace companyId={company.id} />;
}
