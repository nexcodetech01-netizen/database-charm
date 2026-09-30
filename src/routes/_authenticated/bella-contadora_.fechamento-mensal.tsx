import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/features/rbac";
import { MonthlyClosingSummary } from "@/features/accounting-ai/monthly-closing/components/monthly-closing-summary";

// "bella-contadora_" (com _) = página própria, sem ficar aninhada dentro do
// layout da Bella Contadora. A versão antiga era filha de uma rota sem
// <Outlet/> e nunca aparecia na tela.
export const Route = createFileRoute("/_authenticated/bella-contadora_/fechamento-mensal")({
  beforeLoad: requirePermission("reports.view"),
  component: MonthlyClosingPage,
});

function MonthlyClosingPage() {
  const { company } = Route.useRouteContext();
  return (
    <div className="container mx-auto max-w-5xl space-y-6 py-6">
      <div>
        <Link
          to="/bella-contadora"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Bella Contadora
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Fechamento do mês</h1>
        <p className="text-muted-foreground">
          Quanto a loja vendeu, gastou e lucrou, quanto cada sócia já retirou e quanto ainda dá pra retirar.
        </p>
      </div>
      <MonthlyClosingSummary companyId={company.id} />
    </div>
  );
}
