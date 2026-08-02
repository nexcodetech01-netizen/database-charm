import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { requirePermission } from "@/features/rbac";
import { ArrowLeft, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EntityHeader, FormLayout, LoadingSurface } from "@/components/design";
import { ProductForm, useProduct } from "@/features/products";

export const Route = createFileRoute("/_authenticated/produtos_/$productId/editar")({
  validateSearch: z.object({ price: z.coerce.number().positive().optional() }),
  beforeLoad: requirePermission("products.view"),
  component: EditProductPage,
});

const STATUS_MAP: Record<string, { label: string; status: "success" | "neutral" | "draft" }> = {
  active: { label: "Ativo", status: "success" },
  inactive: { label: "Inativo", status: "neutral" },
  draft: { label: "Rascunho", status: "draft" },
};

function EditProductPage() {
  const { productId } = Route.useParams();
  const { company } = Route.useRouteContext();
  const { price: suggestedPrice } = Route.useSearch();
  const { data: product, isLoading } = useProduct(productId);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
        <LoadingSurface variant="form" rows={8} />
      </div>
    );
  }
  if (!product) throw notFound();

  const badge = STATUS_MAP[product.status] ?? {
    label: product.status,
    status: "neutral" as const,
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <EntityHeader
        icon={Package}
        title="Editar produto"
        description={product.name}
        status={badge}
        breadcrumb={
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/produtos/$productId" params={{ productId: product.id }}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> {product.name}
            </Link>
          </Button>
        }
      />

      <FormLayout width="full">
        <ProductForm companyId={company.id} product={product} initialPrice={suggestedPrice} />
      </FormLayout>
    </div>
  );
}
