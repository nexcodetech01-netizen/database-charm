import { createFileRoute } from "@tanstack/react-router";
import { Scale } from "lucide-react";
import { PageLayout } from "@/components/layout";
import { requirePermission } from "@/features/rbac";
import { InventoryReconciliationWorkspace } from "@/features/inventory";

export const Route = createFileRoute("/_authenticated/estoque/reconciliacao")({
  beforeLoad: requirePermission("inventory.view"),
  head: () => ({
    meta: [
      { title: "Reconciliação de Estoque | NexOS" },
      {
        name: "description",
        content:
          "Audite o razão de estoque, crie movimentos de saldo inicial e garanta CMV e lucro confiáveis.",
      },
      { property: "og:title", content: "Reconciliação de Estoque | NexOS" },
      {
        property: "og:description",
        content: "Razão de estoque, movimento de abertura e política de custo do NexOS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ReconciliationPage,
});

function ReconciliationPage() {
  const { company } = Route.useRouteContext();
  return (
    <PageLayout
      icon={Scale}
      title="Reconciliação de estoque"
      description="Saldo inicial + entradas − saídas = saldo atual. Corrija divergências com movimento de abertura."
    >
      <InventoryReconciliationWorkspace companyId={company.id} />
    </PageLayout>
  );
}
