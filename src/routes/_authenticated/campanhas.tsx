import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { Megaphone } from "lucide-react";
import { PageLayout } from "@/components/layout";
import { CampaignsWorkspace } from "@/features/marketing/components/campaigns-workspace";

export const Route = createFileRoute("/_authenticated/campanhas")({
  beforeLoad: requirePermission("marketing.view"),
  component: CampaignsPage,
});

function CampaignsPage() {
  const { company } = Route.useRouteContext();
  return (
    <PageLayout
      icon={Megaphone}
      title="Campanhas inteligentes"
      description="Crie listas de clientes com base em segmentos, comportamento e valor gasto."
    >
      <CampaignsWorkspace companyId={company.id} />
    </PageLayout>
  );
}
