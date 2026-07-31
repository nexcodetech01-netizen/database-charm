import { createFileRoute, Link } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { ArrowLeft } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/produtos">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Produtos
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {isDuplicating ? "Duplicar produto" : "Novo produto"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isDuplicating
            ? "Revise os dados, ajuste cor/imagens e salve para criar um novo produto."
            : "Preencha as informações abaixo para adicionar um produto ao catálogo."}
        </p>
      </div>
      {ready ? (
        <ProductForm
          companyId={company.id}
          duplicateOf={isDuplicating ? source ?? undefined : undefined}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Carregando produto de origem…</p>
      )}
    </div>
  );
}
