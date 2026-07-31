import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SupplierForm, useSupplier } from "@/features/suppliers";

export const Route = createFileRoute("/_authenticated/fornecedores_/$supplierId/editar")({
  beforeLoad: requirePermission("suppliers.view"),
  component: EditSupplierPage,
});

function EditSupplierPage() {
  const { supplierId } = Route.useParams();
  const { company } = Route.useRouteContext();
  const { data: supplier, isLoading } = useSupplier(supplierId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!supplier) throw notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link
          to="/fornecedores/$supplierId"
          params={{ supplierId: supplier.id }}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> {supplier.name}
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editar fornecedor</h1>
        <p className="text-sm text-muted-foreground">{supplier.name}</p>
      </div>
      <SupplierForm companyId={company.id} supplier={supplier} />
    </div>
  );
}
