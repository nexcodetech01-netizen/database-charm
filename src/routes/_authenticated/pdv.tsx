import { createFileRoute } from "@tanstack/react-router";
import { MonitorSmartphone } from "lucide-react";
import { requirePermission } from "@/features/rbac";
import { PageLayout } from "@/components/layout";
import { PDVScreen } from "@/features/sales/pdv";
import { ErrorBoundary } from "react-error-boundary";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pdv")({
  beforeLoad: requirePermission("sales.view"),
  head: () => ({
    meta: [
      { title: "PDV — NexOS" },
      {
        name: "description",
        content: "Ponto de venda do NexOS para atendimento rápido no balcão.",
      },
      { property: "og:title", content: "PDV — NexOS" },
      {
        property: "og:description",
        content: "Ponto de venda do NexOS para atendimento rápido no balcão.",
      },
    ],
  }),
  component: PdvPage,
});

function PdvPage() {
  const { company, user } = Route.useRouteContext();
  const operatorName =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email ??
    "Operador";
  return (
    <PageLayout
      icon={MonitorSmartphone}
      title="PDV"
      description="Frente de caixa do NexOS."
    >
      <ErrorBoundary
        fallbackRender={({ error }) => (
          <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center bg-card border rounded-xl">
            <AlertTriangle className="mb-4 h-12 w-12 text-destructive" />
            <h2 className="text-xl font-bold">Erro no PDV</h2>
            <p className="mt-2 text-muted-foreground">Ocorreu uma falha crítica na interface do caixa.</p>
            <pre className="mt-4 max-w-full overflow-auto rounded bg-muted p-4 text-left text-xs text-destructive">
              {String(error)}
            </pre>
            <Button className="mt-6" onClick={() => window.location.reload()}>
              Recarregar Sistema
            </Button>
          </div>
        )}
      >
        <PDVScreen
          companyId={company.id}
          operatorId={user.id}
          operatorName={operatorName}
          companyName={company.trade_name ?? company.name ?? "NexOS"}
        />
      </ErrorBoundary>
    </PageLayout>
  );
}
