import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  CalendarDays,
  ExternalLink,
  Flame,
  GripVertical,
  ListPlus,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Tag,
  Target,
  User2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Opportunity, PipelineStage } from "../types";

interface KanbanBoardProps {
  stages: PipelineStage[];
  opportunities: Opportunity[];
  onMove: (opportunityId: string, stageId: string) => void;
  onOpportunityClick: (opp: Opportunity) => void;
  onAddOpportunity: (stageId: string) => void;
  onEditOpportunity?: (opp: Opportunity) => void;
  onQuickAction?: (action: "whatsapp" | "task", opp: Opportunity) => void;
}

export function OpportunityKanban({
  stages,
  opportunities,
  onMove,
  onOpportunityClick,
  onAddOpportunity,
  onEditOpportunity,
  onQuickAction,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const grouped = useMemo(() => {
    const map = new Map<string, Opportunity[]>();
    stages.forEach((s) => map.set(s.id, []));
    opportunities.forEach((o) => {
      if (o.stage_id && map.has(o.stage_id)) map.get(o.stage_id)!.push(o);
    });
    return map;
  }, [stages, opportunities]);

  const active = activeId ? opportunities.find((o) => o.id === activeId) : null;

  const handleStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const oppId = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const opp = opportunities.find((o) => o.id === oppId);
    if (!opp || opp.stage_id === overId) return;
    onMove(oppId, overId);
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleStart} onDragEnd={handleEnd}>
      <div className="flex w-full gap-3 overflow-x-auto pb-2">
        {stages.map((stage) => {
          const items = grouped.get(stage.id) ?? [];
          const total = items.reduce((s, o) => s + Number(o.estimated_value ?? 0), 0);
          return (
            <StageColumn
              key={stage.id}
              stage={stage}
              items={items}
              total={total}
              onCardClick={onOpportunityClick}
              onEdit={onEditOpportunity}
              onQuickAction={onQuickAction}
              onAdd={() => onAddOpportunity(stage.id)}
            />
          );
        })}
      </div>
      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {active ? <OpportunityCard opp={active} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function StageColumn({
  stage,
  items,
  total,
  onCardClick,
  onEdit,
  onQuickAction,
  onAdd,
}: {
  stage: PipelineStage;
  items: Opportunity[];
  total: number;
  onCardClick: (o: Opportunity) => void;
  onEdit?: (o: Opportunity) => void;
  onQuickAction?: (action: "whatsapp" | "task", opp: Opportunity) => void;
  onAdd: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });
  const color = stage.color ?? "hsl(var(--primary))";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[300px] max-w-[320px] flex-1 flex-col rounded-xl border border-border/60 bg-muted/30 transition-all",
        isOver && "border-primary/60 bg-primary/5 ring-2 ring-primary/30",
      )}
    >
      {/* Column header with color band */}
      <div className="relative overflow-hidden rounded-t-xl border-b bg-background/70 px-3 pt-3 pb-2.5">
        <span
          className="absolute inset-x-0 top-0 h-[3px]"
          style={{ background: color }}
          aria-hidden
        />
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: color }}
              aria-hidden
            />
            <span className="truncate text-sm font-semibold tracking-tight">
              {stage.name}
            </span>
            <Badge
              variant="secondary"
              className="h-5 shrink-0 rounded-md px-1.5 text-[10px] font-semibold"
            >
              {items.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={onAdd}
            aria-label="Adicionar oportunidade"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-1 text-[11px] font-medium text-muted-foreground">
          Valor total{" "}
          <span className="text-foreground">{formatCurrency(total)}</span>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-2">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-background/40 px-3 py-8 text-center">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-medium text-foreground">
              Nenhuma oportunidade aqui
            </p>
            <p className="text-[11px] text-muted-foreground">
              Arraste cards para esta etapa ou crie um novo lead.
            </p>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onAdd}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Novo lead
            </Button>
          </div>
        ) : (
          items.map((opp) => (
            <DraggableCard
              key={opp.id}
              opp={opp}
              onClick={() => onCardClick(opp)}
              onEdit={onEdit}
              onQuickAction={onQuickAction}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  opp,
  onClick,
  onEdit,
  onQuickAction,
}: {
  opp: Opportunity;
  onClick: () => void;
  onEdit?: (o: Opportunity) => void;
  onQuickAction?: (action: "whatsapp" | "task", opp: Opportunity) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: opp.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative rounded-lg border border-border/60 bg-card shadow-sm transition hover:border-primary/50 hover:shadow-md",
        isDragging && "opacity-40",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1.5 cursor-grab touch-none rounded p-1 text-muted-foreground opacity-0 transition hover:bg-muted group-hover:opacity-100 active:cursor-grabbing"
        aria-label="Arrastar"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <div className="absolute right-1 top-1.5 opacity-0 transition group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              aria-label="Ações"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onClick}>
              <ExternalLink className="mr-2 h-3.5 w-3.5" /> Abrir
            </DropdownMenuItem>
            {onEdit ? (
              <DropdownMenuItem onClick={() => onEdit(opp)}>
                <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onQuickAction?.("whatsapp", opp)}>
              <MessageCircle className="mr-2 h-3.5 w-3.5" /> WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onQuickAction?.("task", opp)}>
              <ListPlus className="mr-2 h-3.5 w-3.5" /> Criar tarefa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <button onClick={onClick} className="w-full text-left">
        <OpportunityCard opp={opp} />
      </button>
    </div>
  );
}

function initials(text: string | null | undefined) {
  if (!text) return "?";
  const parts = text.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

/** Priority derived from estimated value (visual only — no schema change). */
function priorityFrom(value: number): {
  label: string;
  tone: string;
} | null {
  if (value >= 20000) return { label: "Alta", tone: "bg-red-500/10 text-red-600 dark:text-red-400" };
  if (value >= 5000) return { label: "Média", tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" };
  if (value > 0) return { label: "Baixa", tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
  return null;
}

const STATUS_LABEL: Record<string, { label: string; tone: string }> = {
  open: { label: "Aberta", tone: "bg-primary/10 text-primary" },
  won: { label: "Ganha", tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  lost: { label: "Perdida", tone: "bg-red-500/10 text-red-600 dark:text-red-400" },
};

function OpportunityCard({ opp, dragging }: { opp: Opportunity; dragging?: boolean }) {
  const prob = Number(opp.probability ?? 0);
  const value = Number(opp.estimated_value ?? 0);
  const expectedClose = opp.expected_close_date ? new Date(opp.expected_close_date) : null;
  const priority = priorityFrom(value);
  const statusMeta = STATUS_LABEL[opp.status ?? "open"];

  return (
    <div className={cn("space-y-2.5 p-3 pl-6 pr-8", dragging && "rounded-lg border bg-card shadow-lg")}>
      <div className="flex items-start gap-2.5">
        <div
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
          aria-hidden
        >
          {initials(opp.title)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight text-foreground">
            {opp.title}
          </div>
          {opp.description ? (
            <div className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
              <Building2 className="h-3 w-3" />
              <span className="truncate">{opp.description}</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{formatCurrency(value)}</span>
        <div className="flex items-center gap-1.5">
          {priority ? (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                priority.tone,
              )}
            >
              <Flame className="h-2.5 w-2.5" /> {priority.label}
            </span>
          ) : null}
          <span className="text-[11px] font-medium text-muted-foreground">{prob}%</span>
        </div>
      </div>

      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(100, Math.max(0, prob))}%` }}
        />
      </div>

      {(opp.assignee || opp.lead_source) && (
        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          {opp.assignee ? (
            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
              <User2 className="h-2.5 w-2.5" />
              {opp.assignee}
            </span>
          ) : null}
          {opp.lead_source ? (
            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 font-medium text-muted-foreground">
              <Tag className="h-2.5 w-2.5" />
              {opp.lead_source}
            </span>
          ) : null}
          {statusMeta ? (
            <span
              className={cn(
                "ml-auto inline-flex items-center rounded px-1.5 py-0.5 font-semibold",
                statusMeta.tone,
              )}
            >
              {statusMeta.label}
            </span>
          ) : null}
        </div>
      )}

      {(opp.next_action || expectedClose) && (
        <div className="flex items-center justify-between gap-2 border-t pt-2 text-[11px] text-muted-foreground">
          {opp.next_action ? (
            <span className="flex min-w-0 items-center gap-1 truncate" title={opp.next_action}>
              <Target className="h-3 w-3 shrink-0" />
              <span className="truncate">{opp.next_action}</span>
            </span>
          ) : (
            <span />
          )}
          {expectedClose ? (
            <span className="flex shrink-0 items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {format(expectedClose, "dd MMM", { locale: ptBR })}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
