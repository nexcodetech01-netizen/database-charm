import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { PageLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { requirePermission } from "@/features/rbac";

import { FiscalEnvironmentBanner } from "@/features/fiscal/v2/components/fiscal-environment";
import { FiscalConfigWizard } from "@/features/fiscal/v2/components/fiscal-config-wizard";
import { FiscalTabs } from "@/features/fiscal/v2/components/fiscal-tabs";
import { IssueNfeDialog } from "@/features/fiscal/v2/components/issue-nfe-dialog";

const searchSchema = z.object({
  step: z.enum(["empresa", "certificado", "provedor", "regras", "testes"]).optional(),
});

export const Route = createFileRoute("/_authenticated/fiscal/configuracao")({
  beforeLoad: requirePermission("fiscal.manage"),
  validateSearch: searchSchema,
  component: FiscalConfiguracaoPage,
});

function FiscalConfiguracaoPage() {
  const { step } = Route.useSearch();
  const [issueOpen, setIssueOpen] = useState(false);

  return (
    <PageLayout
      title="Fiscal"
      description="Assistente guiado para configurar o módulo fiscal em 5 etapas."
      showBreadcrumb={false}
      actions={
        <Button onClick={() => setIssueOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Emitir NF-e
        </Button>
      }
    >
      <FiscalEnvironmentBanner />
      <FiscalTabs />
      <FiscalConfigWizard initialStep={step} />
      <IssueNfeDialog open={issueOpen} onOpenChange={setIssueOpen} />
    </PageLayout>
  );
}
