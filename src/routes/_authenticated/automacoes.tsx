import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { PageHeader } from "@/components/layout";
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import { BellaAutomationsPanel } from "@/features/bella-ai/automations";
import { usePermissions } from "@/features/rbac/hooks/use-permissions";

export const Route = createFileRoute("/_authenticated/automacoes")({
  beforeLoad: requirePermission("bella_ia.view"),
  head: () => ({
    meta: [
      { title: "Automações · NexOS" },
      { name: "description", content: "Gatilhos e ações automatizadas da Bella IA." },
      { property: "og:title", content: "Automações · NexOS" },
      {
        property: "og:description",
        content: "Configure automações que disparam Skills da Bella IA a partir de eventos do ERP.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AutomacoesPage,
});

function AutomacoesPage() {
  const perms = usePermissions();
  const companyId = perms.companyId ?? null;
  return (
    <div className="space-y-6 p-6">
      <BreadcrumbNav />
      <PageHeader
        title="Automações"
        description="Cada automação escuta um gatilho e dispara Skills da Bella. Ações destrutivas são bloqueadas."
      />
      <BellaAutomationsPanel companyId={companyId} />
    </div>
  );
}
