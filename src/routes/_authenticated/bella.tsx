import { createFileRoute } from "@tanstack/react-router";
import { Sparkles, Lightbulb, Plus, Cog } from "lucide-react";
import { EntityHeader } from "@/components/design";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { cn } from "@/lib/utils";
import {
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
  BellaKpiRow,
  BellaGreetingHero,
  BellaQuickActions,
  BellaExecutiveStrip,
  BellaPrioritiesBlock,
  useBellaHomeSnapshot,
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

function BellaPage() {
  const { company } = Route.useRouteContext();
  const snapshot = useBellaHomeSnapshot(company.id);

  const brief = snapshot.brief;
  const highlights = [brief.prioritiesLine, brief.financeLine, brief.commercialLine].filter(
    Boolean,
  );

  return (
    <div className="space-y-6">
      <EntityHeader
        icon={Sparkles}
        title="Bella IA"
        description="Copiloto do NexOS: prioridades, insights e ações que impulsionam seu negócio."
        status={{ label: "Copiloto ativo", status: "info" }}
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
      />

      <BellaGreetingHero
        greeting={snapshot.greeting}
        highlights={highlights}
        closing={brief.closingLine}
      />

      <BellaKpiRow />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="w-full flex-wrap justify-start">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
              <TabsTrigger value="automations">Automações</TabsTrigger>
              <TabsTrigger value="agents">Agentes</TabsTrigger>
              <TabsTrigger value="prompts">Prompts</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            {/* HOME — Resumo executivo · Ações rápidas · Prioridades (timeline) */}
            <TabsContent value="overview" className="space-y-6">
              <BellaExecutiveStrip period="month" />
              <BellaQuickActions />
              <BellaPrioritiesBlock priorities={snapshot.priorities} />
            </TabsContent>

            {/* INSIGHTS — crítico, atenção, oportunidade + insights ativos. */}
            <TabsContent value="insights" className="space-y-6">
              <NexosEventsPanel companyId={company.id} />
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
        </div>

        {/* Coluna direita — barra fixa da Bella IA. */}
        <aside className="min-w-0 space-y-4">
          <BellaAskPanel />
        </aside>
      </div>

      {/* Placeholder de referência para o local futuro das integrações. */}
      <IntegrationsMovedNote />
    </div>
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
