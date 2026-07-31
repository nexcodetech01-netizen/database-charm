import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

import { PageLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { requirePermission } from "@/features/rbac";
import {
  useFiscalDashboard,
  useFiscalDocuments,
  useFiscalRealtime,
} from "@/features/fiscal/v2/hooks/use-fiscal";
import { useFiscalReadiness } from "@/features/fiscal/v2/hooks/use-fiscal-readiness";
import {
  FiscalEnvironmentBadge,
  FiscalEnvironmentBanner,
} from "@/features/fiscal/v2/components/fiscal-environment";
import { FiscalDashboardCards } from "@/features/fiscal/v2/components/fiscal-dashboard-cards";
import { FiscalFirstNfeEmpty } from "@/features/fiscal/v2/components/fiscal-first-nfe-empty";
import { FiscalOnboardingChecklist } from "@/features/fiscal/v2/components/fiscal-onboarding-checklist";
import { FiscalOverviewCard } from "@/features/fiscal/v2/components/fiscal-overview-card";
import { FiscalTable } from "@/features/fiscal/v2/components/fiscal-table";
import { FiscalTabs } from "@/features/fiscal/v2/components/fiscal-tabs";
import { IssueNfeDialog } from "@/features/fiscal/v2/components/issue-nfe-dialog";

export const Route = createFileRoute("/_authenticated/fiscal/")({
  beforeLoad: requirePermission("fiscal.view"),
  component: FiscalDashboardPage,
});

function FiscalDashboardPage() {
  const { company } = Route.useRouteContext();
  useFiscalRealtime(company.id);
  const dashboard = useFiscalDashboard();
  const recent = useFiscalDocuments({ limit: 10 });
  const readiness = useFiscalReadiness();
  const [issueOpen, setIssueOpen] = useState(false);

  const totals = dashboard.data?.totals;
  const totalDocs = totals ? Object.values(totals).reduce((a, b) => a + b, 0) : 0;
  const hasDocuments = totalDocs > 0;
  const emitDisabled = readiness.blockers > 0;

  return (
    <PageLayout
      title="Fiscal"
      description="Configuração, emissão e acompanhamento de NF-e."
      showBreadcrumb={false}
      actions={
        <div className="flex items-center gap-3">
          <FiscalEnvironmentBadge environment={readiness.environment} withPrefix />
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button onClick={() => setIssueOpen(true)} disabled={emitDisabled}>
                    Emitir NF-e
                  </Button>
                </span>
              </TooltipTrigger>
              {emitDisabled ? (
                <TooltipContent>Conclua a configuração para emitir.</TooltipContent>
              ) : null}
            </Tooltip>
          </TooltipProvider>
        </div>
      }
    >
      <FiscalEnvironmentBanner />
      <FiscalTabs />

      <FiscalOverviewCard />

      {hasDocuments ? (
        <>
          <FiscalDashboardCards data={dashboard.data} />

          <section className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-base font-semibold tracking-tight">Últimas NF-es</h2>
                <p className="text-sm text-muted-foreground">
                  As dez notas mais recentes desta empresa.
                </p>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/fiscal/notas">Ver todas</Link>
              </Button>
            </div>
            <FiscalTable documents={recent.data} isLoading={recent.isLoading} />
          </section>
        </>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <FiscalOnboardingChecklist />
          <FiscalFirstNfeEmpty onIssue={() => setIssueOpen(true)} />
        </div>
      )}

      <IssueNfeDialog open={issueOpen} onOpenChange={setIssueOpen} />
    </PageLayout>
  );
}
