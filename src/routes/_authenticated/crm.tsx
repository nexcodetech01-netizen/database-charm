import { useMemo, useState } from "react";
import { toast } from "sonner";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { companyDayKey } from "@/lib/time/company-day";
import {
  Download,
  Filter,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageLayout, SectionToolbar } from "@/components/layout";
import {
  CrmMetrics,
  CrmTimeline,
  OpportunityDetailSheet,
  OpportunityFormDialog,
  OpportunityKanban,
  useCloseOpportunity,
  useCreateOpportunity,
  useCrmEvents,
  useCrmMetrics,
  useMoveOpportunity,
  useOpportunities,
  usePipelineStages,
  useUpdateOpportunity,
} from "@/features/crm";
import {
  LEAD_SOURCE_OPTIONS,
  OPPORTUNITY_STATUS_OPTIONS,
  type Opportunity,
} from "@/features/crm";
import { ErrorState, LoadingState } from "@/components/layout/state-views";

export const Route = createFileRoute("/_authenticated/crm")({
  beforeLoad: requirePermission("crm.view"),
  component: CrmPage,
});

/** Primeiro dia (yyyy-mm-dd, fuso da loja) do período escolhido; null = sem filtro. */
function periodStartKey(period: string): string | null {
  const today = companyDayKey(new Date());
  const [y, m, d] = today.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d, 12));
  if (period === "7d" || period === "30d") {
    base.setUTCDate(base.getUTCDate() - (period === "7d" ? 6 : 29));
    return base.toISOString().slice(0, 10);
  }
  if (period === "quarter") {
    const qMonth = Math.floor((m - 1) / 3) * 3 + 1;
    return `${y}-${String(qMonth).padStart(2, "0")}-01`;
  }
  return null;
}

const PERIOD_OPTIONS = [
  { value: "all", label: "Qualquer período" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "quarter", label: "Trimestre atual" },
];

function CrmPage() {
  const { company } = Route.useRouteContext();
  const [search, setSearch] = useState("");
  const [stageId, setStageId] = useState<string>("all");
  const [assignee, setAssignee] = useState<string>("all");
  const [source, setSource] = useState<string>("all");
  const [status, setStatus] = useState<string>("all");
  const [period, setPeriod] = useState<string>("all");
  const [tag, setTag] = useState<string>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Opportunity | null>(null);
  const [selected, setSelected] = useState<Opportunity | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const stagesQ = usePipelineStages(company.id);
  const oppsQ = useOpportunities(company.id, {
    search: search || undefined,
    stageId: stageId === "all" ? undefined : stageId,
    status: status === "all" ? undefined : status,
  });
  const metricsQ = useCrmMetrics(company.id);
  const eventsQ = useCrmEvents(company.id, { limit: 30 });

  const create = useCreateOpportunity(company.id);
  const update = useUpdateOpportunity(company.id);
  const move = useMoveOpportunity(company.id);
  const close = useCloseOpportunity(company.id);

  const stages = stagesQ.data ?? [];
  const allOpps = useMemo(() => oppsQ.data ?? [], [oppsQ.data]);
  const opps = useMemo(() => {
    // Período = quando a oportunidade foi criada (no fuso da loja).
    const fromKey = periodStartKey(period);
    return allOpps.filter((o) => {
      if (assignee !== "all" && o.assignee !== assignee) return false;
      if (source !== "all" && o.lead_source !== source) return false;
      if (fromKey && companyDayKey(new Date(o.created_at)) < fromKey) return false;
      return true;
    });
  }, [allOpps, assignee, source, period]);

  const assignees = useMemo(() => {
    const set = new Set<string>();
    allOpps.forEach((o) => o.assignee && set.add(o.assignee));
    return Array.from(set).sort();
  }, [allOpps]);

  const notReady = () =>
    toast.info("Em breve", {
      description: "Este recurso será liberado nas próximas atualizações.",
    });

  return (
    <PageLayout
      icon={Users}
      title="CRM & Funil de Vendas"
      description="Painel comercial com oportunidades, pipeline e histórico de interações."
      actions={
        <>
          <Button variant="outline" size="sm" onClick={notReady}>
            <Upload className="mr-1.5 h-4 w-4" /> Importar
          </Button>
          <Button variant="outline" size="sm" onClick={notReady}>
            <Filter className="mr-1.5 h-4 w-4" /> Filtros
          </Button>
          <Button variant="outline" size="sm" onClick={notReady}>
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Sparkles className="mr-1.5 h-4 w-4" /> Novo Lead
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Nova Oportunidade
          </Button>
        </>
      }
      kpis={<CrmMetrics metrics={metricsQ.data} isLoading={metricsQ.isLoading} />}
      toolbar={
        <SectionToolbar
          search={
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar oportunidade, cliente ou tag…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          }
          filters={
            <>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder="Responsável" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos responsáveis</SelectItem>
                  {assignees.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="Origem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas origens</SelectItem>
                  {LEAD_SOURCE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-9 w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos status</SelectItem>
                  {OPPORTUNITY_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="h-9 w-[160px]">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={tag} onValueChange={setTag}>
                <SelectTrigger className="h-9 w-[120px]">
                  <SelectValue placeholder="Tags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas tags</SelectItem>
                </SelectContent>
              </Select>
              <Select value={stageId} onValueChange={setStageId}>
                <SelectTrigger className="h-9 w-[150px]">
                  <SelectValue placeholder="Estágio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos estágios</SelectItem>
                  {stages.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          }
          actions={
            <Button variant="ghost" size="sm" onClick={notReady}>
              <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Salvar visão
            </Button>
          }
        />
      }
    >
      <Card className="overflow-hidden border-border/60">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 py-3">
          <CardTitle className="text-sm font-semibold">Pipeline</CardTitle>
          <span className="text-xs text-muted-foreground">
            {opps.length} oportunidades exibidas
          </span>
        </CardHeader>
        <CardContent className="p-3 sm:p-4">
          {(stagesQ.isError && !stagesQ.data) || (oppsQ.isError && !oppsQ.data) ? (
            <ErrorState
              title="Não foi possível carregar o funil"
              description="Suas oportunidades não sumiram — o funil só não carregou. Tente de novo."
              onRetry={() => {
                void stagesQ.refetch();
                void oppsQ.refetch();
              }}
            />
          ) : stagesQ.isLoading || oppsQ.isLoading ? (
            <LoadingState label="Carregando funil…" />
          ) : stages.length === 0 ? (
            <ErrorState
              title="Nenhuma etapa no funil"
              description="O funil precisa de etapas (ex.: Novo, Negociação, Ganho) para mostrar as oportunidades. Recarregue a página para criar as etapas padrão."
              onRetry={() => void stagesQ.refetch()}
            />
          ) : (
          <OpportunityKanban
            stages={stages}
            opportunities={opps}
            onOpportunityClick={(o: Opportunity) => {
              setSelected(o);
              setSheetOpen(true);
            }}
            onMove={async (id: string, targetStageId: string) => {
              const target = opps.filter((o) => o.stage_id === targetStageId).length;
              const stage = stages.find((s) => s.id === targetStageId);
              const current = allOpps.find((o) => o.id === id);
              // Em sequência: etapa e situação não podem ficar desencontradas.
              try {
                await move.mutateAsync({ id, stageId: targetStageId, position: target });
                if (stage?.is_won) {
                  await close.mutateAsync({ id, status: "won" });
                } else if (stage?.is_lost) {
                  await close.mutateAsync({ id, status: "lost" });
                } else if (current && current.status !== "open") {
                  // Saiu de Ganho/Perdido para uma etapa normal: reabre.
                  await update.mutateAsync({
                    id,
                    patch: { status: "open", closed_at: null },
                  });
                }
              } catch (err) {
                toast.error("Não foi possível mover a oportunidade", {
                  description:
                    err instanceof Error ? err.message : "Atualize a página e tente de novo.",
                });
                void oppsQ.refetch();
              }
            }}
            onAddOpportunity={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            onEditOpportunity={(o) => {
              setEditing(o);
              setFormOpen(true);
            }}
            onQuickAction={() => notReady()}
          />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-semibold">Timeline recente</CardTitle>
        </CardHeader>
        <CardContent>
          {eventsQ.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Carregando histórico…</p>
          ) : eventsQ.isError && !eventsQ.data ? (
            <div role="alert" className="py-6 text-center text-sm text-muted-foreground">
              Não foi possível carregar o histórico.{" "}
              <Button variant="link" size="sm" className="h-auto p-0" onClick={() => void eventsQ.refetch()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            <CrmTimeline events={eventsQ.data ?? []} />
          )}
        </CardContent>
      </Card>

      <OpportunityDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        opportunity={selected}
        stages={stages}
        companyId={company.id}
        onEdit={(o) => {
          setSheetOpen(false);
          setEditing(o);
          setFormOpen(true);
        }}
      />

      <OpportunityFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        companyId={company.id}
        stages={stages}
        onSubmit={async (values, id) => {
          try {
            if (id) {
              await update.mutateAsync({ id, patch: values });
              toast.success("Oportunidade atualizada");
            } else {
              await create.mutateAsync(values);
              toast.success("Oportunidade criada");
            }
          } catch (err) {
            toast.error("Não foi possível salvar a oportunidade", {
              description: err instanceof Error ? err.message : "Tente de novo em instantes.",
            });
            // Repassa o erro para a janela continuar aberta com o que foi digitado.
            throw err;
          }
        }}
      />
    </PageLayout>
  );
}
