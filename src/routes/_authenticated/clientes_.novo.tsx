import { createFileRoute, Link } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerForm } from "@/features/customers";

export const Route = createFileRoute("/_authenticated/clientes_/novo")({
  beforeLoad: requirePermission("customers.view"),
  component: NewCustomerPage,
});

function NewCustomerPage() {
  const { company } = Route.useRouteContext();
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/clientes">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Clientes
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Novo cliente</h1>
        <p className="text-sm text-muted-foreground">
          Preencha os dados abaixo para adicionar ao CRM.
        </p>
      </div>
      <CustomerForm companyId={company.id} />
    </div>
  );
}
