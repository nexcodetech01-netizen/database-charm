import { createFileRoute } from "@tanstack/react-router";
import { MonitorSmartphone } from "lucide-react";
import { requirePermission } from "@/features/rbac";
import { PageLayout } from "@/components/layout";
import { PDVScreen } from "@/features/sales/pdv";

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

      <PDVScreen
        companyId={company.id}
        operatorId={user.id}
        operatorName={operatorName}
        companyName={company.trade_name ?? company.name ?? "NexOS"}
      />
    </PageLayout>
  );
}
