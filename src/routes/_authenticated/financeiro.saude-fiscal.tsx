import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@/components/layout";
import { requirePermission } from "@/features/rbac";
import { FiscalHealthDashboard } from "@/features/fiscal-health/v1/components/fiscal-health-dashboard";
import { FiscalHealthConfigCard } from "@/features/fiscal-health/v1/components/fiscal-health-config-card";

export const Route = createFileRoute("/_authenticated/financeiro/saude-fiscal")({
  beforeLoad: requirePermission("fiscal.view"),
  head: () => ({
    meta: [
      { title: "Saúde Fiscal — NexOS" },
      { name: "description", content: "Monitoramento contínuo de faturamento, limite tributário e projeção anual da empresa." },
      { property: "og:title", content: "Saúde Fiscal — NexOS" },
      { property: "og:description", content: "Bella CFO: acompanhe seu regime tributário e antecipe riscos fiscais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FiscalHealthPage,
});

function FiscalHealthPage() {
  return (
    <PageLayout
      title="Saúde Fiscal"
      description="Bella CFO acompanha faturamento, limite tributário e projeção anual da empresa."
    >
      <FiscalHealthDashboard />
      <FiscalHealthConfigCard />
    </PageLayout>
  );
}
