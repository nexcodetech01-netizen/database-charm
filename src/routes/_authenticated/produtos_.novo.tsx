import { createFileRoute, Link } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { ArrowLeft, Package } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { EntityHeader, FormLayout, LoadingSurface } from "@/components/design";
import { ProductForm, useProduct } from "@/features/products";

const searchSchema = z.object({
  duplicateFrom: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/produtos_/novo")({
  beforeLoad: requirePermission("products.view"),
  validateSearch: searchSchema,
  component: NewProductPage,
});

function NewProductPage() {
  const { company } = Route.useRouteContext();
  const { duplicateFrom } = Route.useSearch();
  const { data: source, isLoading } = useProduct(duplicateFrom ?? "");
  const isDuplicating = !!duplicateFrom;
  const ready = !isDuplicating || (!!source && !isLoading);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <EntityHeader
        icon={Package}
        title={isDuplicating ? "Duplicar produto" : "Novo produto"}
        description={
          isDuplicating
            ? "Revise os dados, ajuste cor/imagens e salve para criar um novo produto."
            : "Preencha as informações abaixo para adicionar um produto ao catálogo."
        }
        status={
          isDuplicating
            ? { label: "Duplicação", status: "info" }
            : { label: "Rascunho", status: "draft" }
        }
        breadcrumb={
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link to="/produtos">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Produtos
            </Link>
          </Button>
        }
      />

      {ready ? (
        <FormLayout width="full">
          <ProductForm
            companyId={company.id}
            duplicateOf={isDuplicating ? source ?? undefined : undefined}
          />
        </FormLayout>
      ) : (
        <LoadingSurface variant="form" rows={6} />
      )}
    </div>
  );
}
