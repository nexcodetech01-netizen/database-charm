import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  CalendarDays,
  CircleDollarSign,
  MessageSquarePlus,
  Pencil,
  Target,
  User2,
} from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { useAddCrmNote, useCrmEvents } from "../hooks/use-crm";
import type { Opportunity, PipelineStage } from "../types";
import { CrmTimeline } from "./crm-timeline";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  opportunity: Opportunity | null;
  stages: PipelineStage[];
  companyId: string;
  onEdit: (o: Opportunity) => void;
}

export function OpportunityDetailSheet({
  open,
  onOpenChange,
  opportunity,
  stages,
  companyId,
  onEdit,
}: Props) {
  const eventsQ = useCrmEvents(companyId, { opportunityId: opportunity?.id, limit: 50 });
  const addNote = useAddCrmNote(companyId);
  const [note, setNote] = useState("");

  if (!opportunity) return null;
  const stage = stages.find((s) => s.id === opportunity.stage_id);
  const events = eventsQ.data ?? [];
  const notes = events.filter((e) => e.event_type === "note");
  const activities = events.filter((e) => e.event_type !== "note");
  const contacts = events
    .filter((e) => e.customer_id)
    .slice(0, 5);

  async function handleAddNote() {
    const trimmed = note.trim();
    if (!trimmed || !opportunity) return;
    try {
      await addNote.mutateAsync({
        opportunity_id: opportunity.id,
        customer_id: opportunity.customer_id ?? null,
        description: trimmed,
      });
      setNote("");
      toast.success("Observação registrada");
    } catch (e) {
      toast.error("Não foi possível salvar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-hidden sm:max-w-xl">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate">{opportunity.title}</SheetTitle>
              <SheetDescription className="flex flex-wrap items-center gap-2">
                {stage ? (
                  <Badge
                    variant="outline"
                    style={{ borderColor: stage.color ?? undefined, color: stage.color ?? undefined }}
                  >
                    {stage.name}
                  </Badge>
                ) : null}
                <span>{opportunity.probability ?? 0}% de probabilidade</span>
              </SheetDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => onEdit(opportunity)}>
              <Pencil className="mr-1.5 h-4 w-4" /> Editar
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <SummaryTile
            icon={CircleDollarSign}
            label="Valor estimado"
            value={formatCurrency(Number(opportunity.estimated_value ?? 0))}
          />
          <SummaryTile
            icon={Target}
            label="Próxima ação"
            value={opportunity.next_action ?? "—"}
          />
          <SummaryTile
            icon={User2}
            label="Responsável"
            value={opportunity.assignee ?? "—"}
          />
          <SummaryTile
            icon={CalendarDays}
            label="Fechamento previsto"
            value={
              opportunity.expected_close_date
                ? format(new Date(opportunity.expected_close_date), "dd MMM yyyy", { locale: ptBR })
                : "—"
            }
          />
        </div>

        <Separator className="my-4" />

        <Tabs defaultValue="info" className="flex min-h-0 flex-1 flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="info">Informações</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
            <TabsTrigger value="next">Próximas ações</TabsTrigger>
            <TabsTrigger value="notes">Anotações</TabsTrigger>
          </TabsList>

          <div className="mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
            <TabsContent value="info" className="mt-0 space-y-3">
              <div className="rounded-lg border bg-muted/10 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Descrição
                </p>
                <p className="mt-1 text-sm text-foreground">
                  {opportunity.description ?? "Sem descrição adicionada."}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <SummaryTile
                  icon={Target}
                  label="Origem"
                  value={opportunity.lead_source ?? "—"}
                />
                <SummaryTile
                  icon={Activity}
                  label="Status"
                  value={opportunity.status ?? "—"}
                />
              </div>
              {contacts.length > 0 ? (
                <div className="rounded-lg border p-3">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Contatos relacionados
                  </p>
                  <ul className="space-y-2">
                    {contacts.map((ev) => (
                      <li key={ev.id} className="rounded-md bg-muted/20 p-2">
                        <p className="text-sm">{ev.description ?? ev.event_type}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatDateTime(ev.occurred_at)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              {eventsQ.isLoading ? (
                <p className="p-4 text-sm text-muted-foreground">Carregando…</p>
              ) : (
                <CrmTimeline events={events} />
              )}
            </TabsContent>

            <TabsContent value="next" className="mt-0 space-y-2">
              {opportunity.next_action ? (
                <div className="rounded-lg border p-3">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Próxima ação
                  </p>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {opportunity.next_action}
                  </p>
                  {opportunity.next_action_at ? (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Prazo: {formatDateTime(opportunity.next_action_at)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhuma ação agendada. Registre um próximo passo para manter o negócio ativo.
                </p>
              )}
              {activities.length > 0 ? (
                <ul className="space-y-2">
                  {activities.map((ev) => (
                    <li key={ev.id} className="flex items-start gap-2 rounded-md border p-2.5">
                      <Activity className="mt-0.5 h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{ev.event_type}</p>
                        {ev.description ? (
                          <p className="text-xs text-muted-foreground">{ev.description}</p>
                        ) : null}
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {formatDateTime(ev.occurred_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null}
            </TabsContent>

            <TabsContent value="notes" className="mt-0 space-y-3">
              <div className="space-y-2 rounded-lg border p-3">
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Adicionar anotação…"
                  rows={3}
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={handleAddNote}
                    disabled={!note.trim() || addNote.isPending}
                  >
                    <MessageSquarePlus className="mr-1.5 h-4 w-4" /> Salvar
                  </Button>
                </div>
              </div>
              {notes.length === 0 ? (
                <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Nenhuma anotação registrada.
                </p>
              ) : (
                <ul className="space-y-2">
                  {notes.map((n) => (
                    <li key={n.id} className="rounded-md border bg-muted/20 p-3">
                      <p className="whitespace-pre-wrap text-sm">{n.description}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatDateTime(n.occurred_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-medium text-foreground" title={value}>
        {value}
      </div>
    </div>
  );
}
