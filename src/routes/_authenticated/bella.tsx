import { createFileRoute } from "@tanstack/react-router";
import {
  Sparkles,
  Lightbulb,
  Zap,
  Wallet,
  TrendingUp,
  AlertTriangle,
  PiggyBank,
  Plus,
  Cog,
  type LucideIcon,
} from "lucide-react";
import { PageLayout } from "@/components/layout/page-layout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { cn } from "@/lib/utils";
import {
  BellaExecutiveNarrative,
  BellaPrioritiesToday,
  BellaAskPanel,
  BellaOverviewGrid,
  BellaInsightsGrid,
  BellaSuggestedTasks,
  BellaMissions,
  BellaAgentsGrid,
  BellaContextSources,
  BellaProvidersCard,
  BellaPromptsLibrary,
  BellaHistoryTimeline,
  BellaRecentConversations,
  InsightsPanel,
  BellaDailyBriefCard,
  BellaPriorityCenterCard,
  BellaMetricsStrip,
  useBellaHomeSnapshot,
  ExecutiveSummaryCard,
} from "@/features/bella-ai";
import { NexosEventsPanel } from "@/features/bella-ai/events/components/NexosEventsPanel";
import { requirePermission } from "@/features/rbac";

export const Route = createFileRoute("/_authenticated/bella")({
  beforeLoad: requirePermission("bella_ia.view"),
  component: BellaPage,
});


/**
 * Bella IA — Home reorganizada
 *
 * A Visão Geral concentra apenas as 5 respostas que a Bella precisa
 * entregar ao abrir: Resumo Executivo, Pergunte para Bella, Prioridades
 * do dia, Leitura da Bella (curta) e KPIs principais.
 *
 * Insights, Automações, Histórico e Agentes recebem o restante do
 * conteúdo sem duplicação. Nenhuma regra de negócio, provider ou skill
 * foi tocada — apenas a organização visual da UI.
 */

interface CompactKpi {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
}

// KPIs principais: Receita, Lucro, Caixa, Alertas.
const COMPACT_KPIS: CompactKpi[] = [
  { key: "revenue", label: "Receita do mês", value: "R$ 0,00", icon: TrendingUp, tone: "bg-primary/10 text-primary" },
  { key: "profit", label: "Lucro estimado", value: "R$ 0,00", icon: PiggyBank, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { key: "cash", label: "Caixa disponível", value: "R$ 0,00", icon: Wallet, tone: "bg-primary/10 text-primary" },
  { key: "alerts", label: "Alertas críticos", value: "0", icon: AlertTriangle, tone: "bg-danger/10 text-danger" },
];

function BellaPage() {
  const { company } = Route.useRouteContext();
  const snapshot = useBellaHomeSnapshot(company.id);

  return (
    <PageLayout
      icon={Sparkles}
      title="Bella IA"
      description="Copiloto do NexOS: prioridades, insights e ações que impulsionam seu negócio."
      meta={
        <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Copiloto · em preparação
        </span>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Cog className="h-4 w-4" /> Configurações
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Lightbulb className="h-4 w-4" /> Novo insight
          </Button>
          <Button size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova automação
          </Button>
        </div>
      }
      kpis={
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {COMPACT_KPIS.map(({ key, label, value, icon: Icon, tone }) => (
            <div
              key={key}
              className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card px-3 py-2"
            >
              <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md", tone)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </div>
                <div className="truncate text-sm font-semibold tracking-tight">
                  {value}
                </div>
              </div>
            </div>
          ))}
        </div>
      }
      aside={
        // Coluna direita — destaque total para "Pergunte para Bella".
        <div className="space-y-4">
          <BellaAskPanel />
        </div>
      }
    >
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full flex-wrap justify-start">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="automations">Automações</TabsTrigger>
          <TabsTrigger value="agents">Agentes</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        {/* HOME — 0. Resumo Executivo · 1. Daily Brief · 2. Prioridades · 3. KPIs · 4. Contexto extra */}
        <TabsContent value="overview" className="space-y-4">
          <ExecutiveSummaryCard period="month" />
          <BellaDailyBriefCard brief={snapshot.brief} />
          <BellaPriorityCenterCard priorities={snapshot.priorities} />
          <BellaMetricsStrip metrics={snapshot.metrics} />
          <BellaExecutiveNarrative />
          <BellaPrioritiesToday />
          <NexosEventsPanel companyId={company.id} />
        </TabsContent>

        {/* INSIGHTS — crítico, atenção, oportunidade + insights ativos. */}
        <TabsContent value="insights" className="space-y-6">
          <BellaOverviewGrid />
          <InsightsPanel />
          <BellaInsightsGrid />
        </TabsContent>

        {/* AUTOMAÇÕES — tarefas sugeridas + missões. */}
        <TabsContent value="automations" className="space-y-6">
          <BellaSuggestedTasks />
          <BellaMissions />
        </TabsContent>

        {/* AGENTES — fontes de contexto, providers, skills, status. */}
        <TabsContent value="agents" className="space-y-6">
          <BellaAgentsGrid />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <BellaContextSources />
            <BellaProvidersCard />
          </div>
        </TabsContent>

        <TabsContent value="prompts" className="space-y-4">
          <BellaPromptsLibrary />
        </TabsContent>

        {/* HISTÓRICO — todo o rastro conversacional. */}
        <TabsContent value="history" className="space-y-6">
          <BellaRecentConversations />
          <BellaHistoryTimeline />
        </TabsContent>
      </Tabs>

      {/* Placeholder de referência para o local futuro das integrações. */}
      <IntegrationsMovedNote />
    </PageLayout>
  );
}

/**
 * Aviso discreto e único: as integrações de IA (OpenAI, Gemini,
 * Claude, Azure, Modelos Locais) deixaram a Home e serão configuradas
 * em Configurações → Bella IA. Mantido fora das Tabs para não poluir
 * a Visão Geral, mas visível como referência ao operador.
 */
function IntegrationsMovedNote() {
  return (
    <Card className="mt-2 border-dashed border-border/70 bg-transparent">
      <CardHeader className="pb-1.5">
        <CardTitle className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Integrações de IA
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">
          A configuração de provedores (OpenAI, Gemini, Claude, Azure e modelos
          locais) foi movida para{" "}
          <span className="font-medium text-foreground">Configurações → Bella IA</span>.
        </p>
      </CardContent>
    </Card>
  );
}
