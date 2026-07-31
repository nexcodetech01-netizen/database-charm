import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { MetaWorkspace } from "@/features/integrations/meta/meta-workspace";

export const Route = createFileRoute("/_authenticated/configuracoes/integracoes/meta")({
  beforeLoad: requirePermission("settings.view"),
  component: MetaWorkspace,
  head: () => ({
    meta: [
      { title: "Meta · Integrações · NexOS" },
      {
        name: "description",
        content:
          "Gerencie a integração Meta (Facebook + Instagram): status, catálogo, sincronização e publicações.",
      },
    ],
  }),
});
