import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductForm, useProduct } from "@/features/products";

export const Route = createFileRoute("/_authenticated/produtos_/$productId/editar")({
  beforeLoad: requirePermission("products.view"),
  component: EditProductPage,
});

function EditProductPage() {
  const { productId } = Route.useParams();
  const { company } = Route.useRouteContext();
  const { data: product, isLoading } = useProduct(productId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }
  if (!product) throw notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/produtos/$productId" params={{ productId: product.id }}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> {product.name}
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editar produto</h1>
        <p className="text-sm text-muted-foreground">{product.name}</p>
      </div>
      <ProductForm companyId={company.id} product={product} />
    </div>
  );
}
