import { createFileRoute } from "@tanstack/react-router";
import { PageLayout } from "@/components/layout/page-layout";
import { Workflow } from "lucide-react";
import { ProcessStudioWorkspace } from "@/features/bella-ai/process-studio";
import { requirePermission } from "@/features/rbac";

export const Route = createFileRoute("/_authenticated/bella-processos")({
  beforeLoad: requirePermission("bella_ia.view"),
  component: BellaProcessosPage,
  head: () => ({
    meta: [
      { title: "Bella Process Studio — NexOS" },
      {
        name: "description",
        content:
          "Construa processos visuais para o NexOS: workflows, automações e fluxos conversacionais sem código.",
      },
      { property: "og:title", content: "Bella Process Studio — NexOS" },
      {
        property: "og:description",
        content:
          "Editor visual de processos que reutiliza o Workflow Engine e as Skills existentes do NexOS.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function BellaProcessosPage() {
  const { company, user } = Route.useRouteContext();
  return (
    <PageLayout
      title="Bella Process Studio"
      description="Desenhe processos completos usando Workflows, Automações e Skills existentes — sem escrever código."
      icon={Workflow}
    >
      <ProcessStudioWorkspace companyId={company.id} actorId={user?.id ?? null} />
    </PageLayout>
  );
}

