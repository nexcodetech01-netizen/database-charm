import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomerForm, useCustomer } from "@/features/customers";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/clientes_/$customerId/editar")({
  beforeLoad: requirePermission("customers.view"),
  component: EditCustomerPage,
});

function EditCustomerPage() {
  const { customerId } = Route.useParams();
  const { company } = Route.useRouteContext();
  const { data: customer, isLoading } = useCustomer(customerId);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );
  }
  if (!customer) throw notFound();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/clientes/$customerId" params={{ customerId: customer.id }}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> {customer.name}
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Editar cliente</h1>
        <p className="text-sm text-muted-foreground">{customer.name}</p>
      </div>
      <CustomerForm companyId={company.id} customer={customer} />
    </div>
  );
}
