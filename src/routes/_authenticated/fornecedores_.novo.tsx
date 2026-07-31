import { createFileRoute, Link } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupplierForm } from "@/features/suppliers";

export const Route = createFileRoute("/_authenticated/fornecedores_/novo")({
  beforeLoad: requirePermission("suppliers.view"),
  component: NewSupplierPage,
});

function NewSupplierPage() {
  const { company } = Route.useRouteContext();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/fornecedores">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Fornecedores
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Novo fornecedor</h1>
        <p className="text-sm text-muted-foreground">
          Preencha as informações do fornecedor. Você poderá editar depois.
        </p>
      </div>
      <SupplierForm companyId={company.id} />
    </div>
  );
}
