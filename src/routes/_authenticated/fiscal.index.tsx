import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { LayoutDashboard, FileText, Settings, Sparkles } from "lucide-react";

import { PageLayout, KpiSection, KpiCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requirePermission } from "@/features/rbac";
import { BellaFiscalPanel } from "@/features/accounting-ai/fiscal";
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
import { FiscalFirstNfeEmpty } from "@/features/fiscal/v2/components/fiscal-first-nfe-empty";
import { FiscalOnboardingChecklist } from "@/features/fiscal/v2/components/fiscal-onboarding-checklist";
import { FiscalOverviewCard } from "@/features/fiscal/v2/components/fiscal-overview-card";
import { FiscalTable } from "@/features/fiscal/v2/components/fiscal-table";
import { IssueNfeDialog } from "@/features/fiscal/v2/components/issue-nfe-dialog";
import { formatNumber } from "@/lib/format";

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
  const processing = totals
    ? totals.draft +
      totals.validating +
      totals.signing +
      totals.sending
    : 0;
  const totalDocs = totals ? Object.values(totals).reduce((a, b) => a + b, 0) : 0;
  const hasDocuments = totalDocs > 0;
  const emitDisabled = readiness.blockers > 0;

  return (
    <PageLayout
      title="Fiscal"
      meta={`${totalDocs} documentos`}
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
      kpis={
        <KpiSection>
          <KpiCard
            label="Notas autorizadas"
            value={totals ? formatNumber(totals.authorized) : "—"}
            loading={dashboard.isLoading}
            highlight
          />
          <KpiCard
            label="Em processamento"
            value={formatNumber(processing)}
            loading={dashboard.isLoading}
          />
          <KpiCard
            label="Rejeitadas / Erro"
            value={totals ? formatNumber(totals.rejected + totals.error) : "—"}
            loading={dashboard.isLoading}
            highlight={totals && (totals.rejected + totals.error) > 0}
          />
          <KpiCard
            label="Ambiente"
            value={readiness.environment === "production" ? "Produção" : "Homologação"}
            loading={readiness.isLoading}
          />
        </KpiSection>
      }
    >
      <FiscalEnvironmentBanner />
      
      <Tabs defaultValue="operacional" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="operacional">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Operacional
          </TabsTrigger>
          <TabsTrigger value="history">
            <FileText className="mr-2 h-4 w-4" />
            Notas Fiscais
          </TabsTrigger>
          <TabsTrigger value="insights">
            <Sparkles className="mr-2 h-4 w-4" />
            Insights Bella
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings className="mr-2 h-4 w-4" />
            Configuração
          </TabsTrigger>
        </TabsList>

        <TabsContent value="operacional" className="space-y-6 border-none p-0 outline-none">
          {hasDocuments ? (
            <div className="space-y-6">
              <FiscalOverviewCard />
              <section className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">Últimas NF-es</h2>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { /* Navegação via tab context seria ideal aqui */ }}>
                    Ver histórico
                  </Button>
                </div>
                <FiscalTable documents={recent.data} isLoading={recent.isLoading} />
              </section>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <FiscalOnboardingChecklist />
              <FiscalFirstNfeEmpty onIssue={() => setIssueOpen(true)} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4 border-none p-0 outline-none">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Listagem de Documentos</h2>
            <Button variant="outline" size="sm" asChild>
              <Link to="/fiscal/notas">Gerenciar todas</Link>
            </Button>
          </div>
          <FiscalTable documents={recent.data} isLoading={recent.isLoading} />
        </TabsContent>

        <TabsContent value="insights" className="space-y-6 border-none p-0 outline-none">
          <KpiSection>
            <KpiCard
              label="Notas autorizadas"
              value={totals ? formatNumber(totals.authorized) : "—"}
              loading={dashboard.isLoading}
              highlight
            />
            <KpiCard
              label="Em processamento"
              value={formatNumber(processing)}
              loading={dashboard.isLoading}
            />
            <KpiCard
              label="Rejeitadas / Erro"
              value={totals ? formatNumber(totals.rejected + totals.error) : "—"}
              loading={dashboard.isLoading}
              highlight={totals && (totals.rejected + totals.error) > 0}
            />
            <KpiCard
              label="Ambiente"
              value={readiness.environment === "production" ? "Produção" : "Homologação"}
              loading={readiness.isLoading}
            />
          </KpiSection>
          <BellaFiscalPanel companyId={company.id} />
        </TabsContent>

        <TabsContent value="config" className="space-y-6 border-none p-0 outline-none">
          <FiscalOverviewCard />
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">Configurações detalhadas disponíveis em breve nesta aba.</p>
            <Button variant="link" size="sm" asChild className="mt-2">
              <Link to="/fiscal/configuracao">Abrir editor clássico</Link>
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <IssueNfeDialog open={issueOpen} onOpenChange={setIssueOpen} />
    </PageLayout>
  );
}
