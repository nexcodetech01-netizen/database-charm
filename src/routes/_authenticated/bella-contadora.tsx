import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/features/rbac";
import { BellaContadoraDashboard } from "@/features/accounting-ai";

export const Route = createFileRoute("/_authenticated/bella-contadora")({
  beforeLoad: requirePermission("reports.view"),
  component: BellaContadoraPage,
});

function BellaContadoraPage() {
  const { company } = Route.useRouteContext();
    return (
    <>
      <div className="flex justify-end px-4 pt-4 md:px-6">
        <Button asChild variant="outline" size="sm">
          <Link to="/bella-contadora/fechamento-mensal">
            <CalendarCheck className="mr-1.5 h-4 w-4" /> Fechamento do mês
          </Link>
        </Button>
      </div>
      <BellaContadoraDashboard companyId={company.id} />
    </>
  );
}
