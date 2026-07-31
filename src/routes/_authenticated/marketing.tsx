import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import {
  Bot,
  Cake,
  Calendar,
  ChevronRight,
  Clock,
  DollarSign,
  Facebook,
  Filter,
  Instagram,
  Mail,
  Megaphone,
  MessageCircle,
  Plus,
  Repeat,
  RotateCcw,
  Search,
  Send,
  Star,
  TrendingUp,
  Upload,
  UserPlus,
  Users,
  UsersRound,
  Zap,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLayout, EmptyState, KpiSection, KpiCard } from "@/components/layout";
import { formatCurrency, formatNumber } from "@/lib/format";
import { toast } from "sonner";
import {
  CampaignFormDialog,
  CampaignTable,
  SegmentationPanel,
  useCampaigns,
  useCreateCampaign,
  useDeleteCampaign,
  useMarketingMetrics,
  useUpdateCampaign,
  CAMPAIGN_CHANNEL_OPTIONS,
  CAMPAIGN_STATUS_OPTIONS,
} from "@/features/marketing";
import type { MarketingCampaign } from "@/features/marketing";
import { MarketingBellaHints } from "@/features/bella-ai";
import { CatalogWorkspace } from "@/features/catalog";

export const Route = createFileRoute("/_authenticated/marketing")({
  beforeLoad: requirePermission("marketing.view"),
  component: MarketingPage,
});

function MarketingPage() {
  const { company } = Route.useRouteContext();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [channel, setChannel] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingCampaign | null>(null);

  const filters = {
    search: search || undefined,
    status: status === "all" ? undefined : status,
    channel: channel === "all" ? undefined : channel,
  };

  const metricsQ = useMarketingMetrics(company.id);
  const campaignsQ = useCampaigns(company.id, filters);
  const create = useCreateCampaign(company.id);
  const update = useUpdateCampaign(company.id);
  const remove = useDeleteCampaign(company.id);

  const metrics = metricsQ.data;
  const campaigns = campaignsQ.data ?? [];
  const loadingMetrics = metricsQ.isLoading;

  function openNewCampaign() {
    setEditing(null);
    setFormOpen(true);
  }

  return (
    <PageLayout
      icon={Megaphone}
      title="Marketing"
      description="O que publicar? Gere posts para cada canal a partir dos seus produtos."
      actions={
        <>
          <Button variant="outline" size="sm">
            <Upload className="mr-1.5 h-4 w-4" /> Importar contatos
          </Button>
          <Button variant="outline" size="sm">
            <UsersRound className="mr-1.5 h-4 w-4" /> Criar segmento
          </Button>
          <Button size="sm" onClick={openNewCampaign}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova campanha
          </Button>
        </>
      }
      kpis={
        <KpiSection>
          <KpiCard
            label="Campanhas ativas"
            value={metrics ? formatNumber(metrics.activeCampaigns) : "0"}
            hint={
              metrics ? `${formatNumber(metrics.totalCampaigns)} no total` : undefined
            }
            icon={Megaphone}
            loading={loadingMetrics}
          />
          <KpiCard
            label="Clientes impactados"
            value={metrics ? formatNumber(metrics.leads) : "0"}
            hint={
              metrics
                ? `${formatNumber(metrics.totalCustomers)} na base`
                : undefined
            }
            icon={Users}
            loading={loadingMetrics}
          />
          <KpiCard
            label="Conversões"
            value={metrics ? formatNumber(metrics.conversions) : "0"}
            hint={
              metrics ? `${metrics.conversionRate.toFixed(1)}% de conversão` : undefined
            }
            icon={TrendingUp}
            loading={loadingMetrics}
          />
          <KpiCard
            label="Receita atribuída"
            value={metrics ? formatCurrency(metrics.revenueGenerated) : "R$ 0,00"}
            hint="Somatório das campanhas"
            icon={DollarSign}
            loading={loadingMetrics}
          />
        </KpiSection>
      }
    >
      <MarketingBellaHints companyId={company.id} onNewCampaign={openNewCampaign} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* MAIN COLUMN */}
        <div className="min-w-0 space-y-4">
          <Tabs defaultValue="campaigns" className="space-y-3">
            <TabsList>
              <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
              <TabsTrigger value="catalog">Catálogo</TabsTrigger>
              <TabsTrigger value="automations">Automações</TabsTrigger>
              <TabsTrigger value="results">Resultados</TabsTrigger>
              <TabsTrigger value="segmentation">Segmentação avançada</TabsTrigger>
            </TabsList>

            {/* CAMPANHAS */}
            <TabsContent value="campaigns" className="space-y-3">
              <Card>
                <CardHeader className="flex flex-col gap-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-base">Suas campanhas</CardTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Planeje, ative e acompanhe cada campanha
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar campanha…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-9 w-48 pl-8"
                      />
                    </div>
                    <Select value={channel} onValueChange={setChannel}>
                      <SelectTrigger className="h-9 w-36">
                        <SelectValue placeholder="Canal" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos canais</SelectItem>
                        {CAMPAIGN_CHANNEL_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="h-9 w-36">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos status</SelectItem>
                        {CAMPAIGN_STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" className="h-9">
                      <Filter className="mr-1.5 h-3.5 w-3.5" /> Filtros
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  {campaignsQ.isLoading ? (
                    <div className="space-y-2">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : campaigns.length === 0 ? (
                    <EmptyState
                      icon={Megaphone}
                      title="Nenhuma campanha ainda"
                      description="Crie sua primeira campanha para começar a impactar clientes."
                      className="py-12"
                    />
                  ) : (
                    <CampaignTable
                      campaigns={campaigns}
                      onEdit={(c) => {
                        setEditing(c);
                        setFormOpen(true);
                      }}
                      onDelete={(c) =>
                        remove.mutate(c.id, {
                          onSuccess: () => toast.success("Campanha removida"),
                        })
                      }
                    />
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* CATÁLOGO */}
            <TabsContent value="catalog" className="space-y-3">
              <CatalogWorkspace companyId={company.id} />
            </TabsContent>

            {/* AUTOMAÇÕES */}
            <TabsContent value="automations" className="space-y-3">
              <AutomationsGrid />
            </TabsContent>

            {/* RESULTADOS */}
            <TabsContent value="results" className="space-y-3">
              <ResultsSection />
            </TabsContent>

            {/* SEGMENTAÇÃO */}
            <TabsContent value="segmentation">
              <SegmentationPanel companyId={company.id} />
            </TabsContent>
          </Tabs>
        </div>

        {/* ASIDE COLUMN */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <IntegrationsPanel />
          <SegmentsPanel />
        </aside>
      </div>

      <CampaignFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        companyId={company.id}
        onSubmit={async (values, id) => {
          if (id) {
            await update.mutateAsync({ id, patch: values });
            toast.success("Campanha atualizada");
          } else {
            await create.mutateAsync(values);
            toast.success("Campanha criada");
          }
        }}
      />
    </PageLayout>
  );
}

/* ------------------------------------------------------------------ */
/* SEGMENTOS — lista compacta                                          */
/* ------------------------------------------------------------------ */

const SEGMENTS: Array<{ label: string; icon: LucideIcon; tone: string }> = [
  { label: "VIP", icon: Star, tone: "text-amber-500 bg-amber-500/10" },
  { label: "Aniversariantes", icon: Cake, tone: "text-pink-500 bg-pink-500/10" },
  { label: "Novos clientes", icon: UserPlus, tone: "text-blue-500 bg-blue-500/10" },
  { label: "Inativos", icon: Clock, tone: "text-slate-500 bg-slate-500/10" },
  { label: "Recorrentes", icon: Repeat, tone: "text-emerald-500 bg-emerald-500/10" },
];

function SegmentsPanel() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Segmentos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5 pb-3">
        {SEGMENTS.map((s) => {
          const Icon = s.icon;
          return (
            <div
              key={s.label}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50"
            >
              <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${s.tone}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span className="flex-1 truncate text-sm">{s.label}</span>
              <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                0
              </span>
            </div>
          );
        })}
        <Button variant="ghost" size="sm" className="mt-2 h-8 w-full justify-start text-xs">
          Gerenciar segmentos
        </Button>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* INTEGRAÇÕES — lista compacta                                        */
/* ------------------------------------------------------------------ */

type IntegrationStatus = "connected" | "soon" | "disconnected";

const STATUS_STYLE: Record<
  IntegrationStatus,
  { label: string; dot: string; text: string }
> = {
  connected: {
    label: "Conectado",
    dot: "bg-success",
    text: "text-success",
  },
  soon: {
    label: "Em breve",
    dot: "bg-amber-500",
    text: "text-amber-600",
  },
  disconnected: {
    label: "Não conectado",
    dot: "bg-muted-foreground/40",
    text: "text-muted-foreground",
  },
};

const INTEGRATIONS: Array<{
  name: string;
  icon: LucideIcon;
  status: IntegrationStatus;
}> = [
  { name: "WhatsApp", icon: MessageCircle, status: "disconnected" },
  { name: "E-mail", icon: Mail, status: "disconnected" },
  { name: "Instagram", icon: Instagram, status: "soon" },
  { name: "Facebook", icon: Facebook, status: "soon" },
  { name: "Bella IA", icon: Bot, status: "connected" },
];

function IntegrationsPanel() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Integrações</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0.5 pb-3">
        {INTEGRATIONS.map((i) => {
          const Icon = i.icon;
          const st = STATUS_STYLE[i.status];
          return (
            <div
              key={i.name}
              className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/50"
            >
              <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate text-sm">{i.name}</span>
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                <span className={`text-xs ${st.text}`}>{st.label}</span>
              </div>
            </div>
          );
        })}
        <Button variant="ghost" size="sm" className="mt-2 h-8 w-full justify-start text-xs">
          Configurar integrações
        </Button>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* AUTOMAÇÕES                                                          */
/* ------------------------------------------------------------------ */

const AUTOMATIONS: Array<{
  name: string;
  description: string;
  trigger: string;
  channel: string;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    name: "Boas-vindas",
    description: "Envia mensagem quando um cliente é cadastrado.",
    trigger: "Novo cliente",
    channel: "WhatsApp",
    icon: UserPlus,
    tone: "text-blue-500 bg-blue-500/10",
  },
  {
    name: "Carrinho abandonado",
    description: "Reengaja clientes que não concluíram a compra.",
    trigger: "Carrinho > 30 min",
    channel: "E-mail",
    icon: Zap,
    tone: "text-amber-500 bg-amber-500/10",
  },
  {
    name: "Pós-venda",
    description: "Solicita avaliação após a entrega do pedido.",
    trigger: "Pedido entregue",
    channel: "WhatsApp",
    icon: CheckCircle2,
    tone: "text-emerald-500 bg-emerald-500/10",
  },
  {
    name: "Aniversário",
    description: "Envia felicitação e cupom no aniversário.",
    trigger: "Data especial",
    channel: "WhatsApp",
    icon: Cake,
    tone: "text-pink-500 bg-pink-500/10",
  },
  {
    name: "Reativação",
    description: "Alcança clientes sem compra há 90 dias.",
    trigger: "Inatividade",
    channel: "E-mail",
    icon: RotateCcw,
    tone: "text-slate-500 bg-slate-500/10",
  },
];

function AutomationsGrid() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardTitle className="text-base">Automações</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Fluxos que rodam sozinhos e conversam com seus clientes
          </p>
        </div>
        <Button variant="outline" size="sm">
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Nova automação
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {AUTOMATIONS.map((a) => {
            const Icon = a.icon;
            return (
              <div
                key={a.name}
                className="flex flex-col rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between">
                  <div className={`grid h-9 w-9 place-items-center rounded-md ${a.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <Badge
                    variant="outline"
                    className="border-border bg-muted text-[10px] text-muted-foreground"
                  >
                    Rascunho
                  </Badge>
                </div>
                <p className="mt-3 text-sm font-semibold tracking-tight">{a.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{a.description}</p>
                <div className="mt-3 flex items-center gap-1.5 border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">{a.trigger}</span>
                  <ChevronRight className="h-3 w-3" />
                  <span>{a.channel}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* RESULTADOS                                                          */
/* ------------------------------------------------------------------ */

function ResultsSection() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Campanhas recentes</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Últimas campanhas com desempenho consolidado
          </p>
        </CardHeader>
        <CardContent className="flex-1">
          <EmptyState
            icon={Megaphone}
            title="Sem campanhas recentes"
            description="As campanhas concluídas aparecerão aqui com os resultados."
            className="py-12"
          />
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Últimos envios</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Fluxo de mensagens disparadas por canal
          </p>
        </CardHeader>
        <CardContent className="flex-1">
          <EmptyState
            icon={Send}
            title="Nenhum envio registrado"
            description="Ao ativar campanhas, os envios recentes aparecerão aqui."
            className="py-12"
          />
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Linha do tempo</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Eventos recentes do centro de campanhas
          </p>
        </CardHeader>
        <CardContent>
          <ol className="relative space-y-4 border-l border-border pl-5">
            <li className="relative">
              <span className="absolute -left-[27px] grid h-6 w-6 place-items-center rounded-full border border-border bg-background">
                <Calendar className="h-3 w-3 text-muted-foreground" />
              </span>
              <p className="text-sm font-medium">Nenhum evento por enquanto</p>
              <p className="text-xs text-muted-foreground">
                Assim que você criar campanhas, elas aparecerão na timeline.
              </p>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
