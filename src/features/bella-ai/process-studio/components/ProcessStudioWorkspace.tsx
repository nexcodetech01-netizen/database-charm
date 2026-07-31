/**
 * ProcessStudioWorkspace — editor visual do Bella Process Studio.
 *
 * Layout 70/30:
 *   - Esquerda: canvas linear (sortable) com os nós do fluxo selecionado.
 *   - Direita: propriedades do nó, simulador, versionamento e logs.
 *
 * O canvas usa @dnd-kit/sortable — não é um grafo BPMN completo, mas
 * cumpre "drag-and-drop" mantendo o modelo linear compatível com o
 * BellaWorkflowEngine (que executa steps sequenciais).
 */
import { useMemo, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Play,
  CheckCircle2,
  Archive,
  History,
  Rocket,
  Trash2,
  GripVertical,
  Zap,
  MessageSquare,
  Clock,
  Bell,
  GitBranch,
  Users,
  Webhook,
  Workflow,
  FileText,
  ShieldCheck,
  HelpCircle,
  Repeat,
  Split,
  CircleDot,
  CircleCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useProcessStudioActions,
  useProcessStudioFlows,
} from "../hooks/use-process-studio";
import { createNode } from "../FlowBuilder";
import type {
  FlowDefinition,
  FlowNode,
  FlowNodeKind,
  FlowSimulationResult,
  FlowStatus,
  FlowValidationResult,
} from "../types";

const NODE_LIBRARY: Array<{ kind: FlowNodeKind; label: string; icon: typeof Zap }> = [
  { kind: "event", label: "Evento", icon: Zap },
  { kind: "condition", label: "Condição", icon: GitBranch },
  { kind: "if", label: "If", icon: Split },
  { kind: "else", label: "Else", icon: Split },
  { kind: "loop", label: "Loop", icon: Repeat },
  { kind: "delay", label: "Aguardar", icon: Clock },
  { kind: "webhook", label: "Webhook", icon: Webhook },
  { kind: "whatsapp", label: "WhatsApp", icon: MessageSquare },
  { kind: "skill", label: "Skill", icon: Rocket },
  { kind: "workflow", label: "Workflow", icon: Workflow },
  { kind: "automation", label: "Automação", icon: Zap },
  { kind: "approval", label: "Aprovação", icon: ShieldCheck },
  { kind: "decision", label: "Decisão", icon: Split },
  { kind: "humanTask", label: "Tarefa humana", icon: Users },
  { kind: "question", label: "Pergunta", icon: HelpCircle },
  { kind: "confirmation", label: "Confirmação", icon: CheckCircle2 },
  { kind: "notification", label: "Notificação", icon: Bell },
];

function nodeIcon(kind: FlowNodeKind) {
  if (kind === "start") return CircleDot;
  if (kind === "end") return CircleCheck;
  return NODE_LIBRARY.find((n) => n.kind === kind)?.icon ?? FileText;
}

const STATUS_TONE: Record<FlowStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  test: "bg-warning/10 text-warning",
  published: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  archived: "bg-muted text-muted-foreground/70",
};

export interface ProcessStudioWorkspaceProps {
  companyId: string;
  actorId: string | null;
}

export function ProcessStudioWorkspace({
  companyId,
  actorId,
}: ProcessStudioWorkspaceProps) {
  const flows = useProcessStudioFlows(companyId);
  const actions = useProcessStudioActions(companyId, actorId);
  const [selectedId, setSelectedId] = useState<string | null>(flows[0]?.id ?? null);
  const selected = flows.find((f) => f.id === selectedId) ?? flows[0] ?? null;
  const [validation, setValidation] = useState<FlowValidationResult | null>(null);
  const [simulation, setSimulation] = useState<FlowSimulationResult | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const activeNode = useMemo(
    () => selected?.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [selected, selectedNodeId],
  );

  function handleCreate() {
    const name = window.prompt("Nome do novo processo?");
    if (!name) return;
    const f = actions.create(name);
    setSelectedId(f.id);
    toast.success("Processo criado.");
  }

  function handleTemplate(key: string) {
    const f = actions.createFromTemplate(key);
    setSelectedId(f.id);
    toast.success(`Template "${f.name}" aplicado.`);
  }

  function handleAddNode(kind: FlowNodeKind) {
    if (!selected) return;
    const label = NODE_LIBRARY.find((n) => n.kind === kind)?.label ?? kind;
    const nodes = insertBeforeEnd(selected.nodes, createNode(kind, label));
    actions.update(selected.id, { nodes });
  }

  function handleRemoveNode(nodeId: string) {
    if (!selected) return;
    const node = selected.nodes.find((n) => n.id === nodeId);
    if (!node || node.kind === "start" || node.kind === "end") return;
    actions.update(selected.id, {
      nodes: selected.nodes.filter((n) => n.id !== nodeId),
    });
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  }

  function handleReorder(nodes: FlowNode[]) {
    if (!selected) return;
    actions.update(selected.id, { nodes });
  }

  function handleValidate() {
    if (!selected) return;
    const res = actions.validate(selected.id);
    setValidation(res);
    if (res.ok) toast.success("Fluxo válido.");
    else toast.error(`${res.issues.length} problema(s) encontrado(s).`);
  }

  function handleSimulate() {
    if (!selected) return;
    const res = actions.simulate(selected.id);
    setSimulation(res);
    toast.info(`Simulação: ${res.steps.length} passos, ~${res.totalEstimatedMs}ms.`);
  }

  function handlePublish() {
    if (!selected) return;
    try {
      const res = actions.publish(selected.id);
      toast.success(`Publicado como ${res.workflowId}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao publicar.");
    }
  }

  function handleArchive() {
    if (!selected) return;
    actions.archive(selected.id);
    toast.success("Processo arquivado.");
  }

  function handleUpdateNodeConfig(patch: Record<string, unknown>) {
    if (!selected || !activeNode) return;
    const nodes = selected.nodes.map((n) =>
      n.id === activeNode.id ? { ...n, config: { ...n.config, ...patch } } : n,
    );
    actions.update(selected.id, { nodes });
  }

  function handleUpdateNodeLabel(label: string) {
    if (!selected || !activeNode) return;
    const nodes = selected.nodes.map((n) =>
      n.id === activeNode.id ? { ...n, label } : n,
    );
    actions.update(selected.id, { nodes });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_360px] gap-4">
      {/* Lista de processos + templates */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Processos</CardTitle>
              <Button size="sm" variant="ghost" onClick={handleCreate}>
                <Plus className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-1">
            {flows.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhum processo. Crie um do zero ou use um template.
              </p>
            ) : (
              flows.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(f.id);
                    setSelectedNodeId(null);
                    setValidation(null);
                    setSimulation(null);
                  }}
                  className={cn(
                    "w-full text-left rounded-lg border p-2 hover:bg-accent transition-colors",
                    selected?.id === f.id && "bg-accent border-primary/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{f.name}</span>
                    <Badge className={cn("text-[10px]", STATUS_TONE[f.status])}>
                      {f.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    v{f.version} · {f.nodes.length} nós
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Templates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {actions.templates.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTemplate(t.key)}
                className="w-full text-left rounded-lg border p-2 hover:bg-accent transition-colors"
              >
                <p className="text-sm font-medium">{t.name}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-2">
                  {t.description}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Canvas */}
      <div className="space-y-4">
        {selected ? (
          <>
            <Card>
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{selected.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {selected.description || "Sem descrição."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={cn(STATUS_TONE[selected.status])}>
                      {selected.status} · v{selected.version}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={handleValidate}>
                      <CheckCircle2 className="size-4 mr-1" /> Validar
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleSimulate}>
                      <Play className="size-4 mr-1" /> Simular
                    </Button>
                    <Button size="sm" onClick={handlePublish}>
                      <Rocket className="size-4 mr-1" /> Publicar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleArchive}>
                      <Archive className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-4">
                  {NODE_LIBRARY.map((n) => (
                    <Button
                      key={n.kind}
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddNode(n.kind)}
                    >
                      <n.icon className="size-3.5 mr-1" />
                      {n.label}
                    </Button>
                  ))}
                </div>
                <FlowCanvas
                  flow={selected}
                  activeNodeId={selectedNodeId}
                  onSelect={setSelectedNodeId}
                  onRemove={handleRemoveNode}
                  onReorder={handleReorder}
                />
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              Selecione ou crie um processo à esquerda.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Painel lateral */}
      <div className="space-y-4">
        {selected && (
          <Tabs defaultValue="node">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="node">Nó</TabsTrigger>
              <TabsTrigger value="sim">Simulação</TabsTrigger>
              <TabsTrigger value="ver">Versões</TabsTrigger>
              <TabsTrigger value="log">Logs</TabsTrigger>
            </TabsList>
            <TabsContent value="node">
              <NodeInspector
                node={activeNode}
                onLabelChange={handleUpdateNodeLabel}
                onConfigChange={handleUpdateNodeConfig}
              />
            </TabsContent>
            <TabsContent value="sim">
              <SimulationPanel simulation={simulation} validation={validation} />
            </TabsContent>
            <TabsContent value="ver">
              <VersionsPanel
                flow={selected}
                onRollback={(v) => {
                  actions.rollback(selected.id, v);
                  toast.success(`Rollback para v${v}.`);
                }}
                listVersions={actions.listVersions}
              />
            </TabsContent>
            <TabsContent value="log">
              <LogsPanel flow={selected} listLogs={actions.listLogs} />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

// ─── Canvas ──────────────────────────────────────────────────────────────────

function insertBeforeEnd(nodes: readonly FlowNode[], node: FlowNode): FlowNode[] {
  const arr = [...nodes];
  const endIdx = arr.findIndex((n) => n.kind === "end");
  if (endIdx === -1) return [...arr, node];
  arr.splice(endIdx, 0, node);
  return arr;
}

function FlowCanvas({
  flow,
  activeNodeId,
  onSelect,
  onRemove,
  onReorder,
}: {
  flow: FlowDefinition;
  activeNodeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onReorder: (nodes: FlowNode[]) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  function onDragEnd(e: DragEndEvent) {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIdx = flow.nodes.findIndex((n) => n.id === e.active.id);
    const newIdx = flow.nodes.findIndex((n) => n.id === e.over!.id);
    if (oldIdx < 0 || newIdx < 0) return;
    onReorder(arrayMove([...flow.nodes], oldIdx, newIdx));
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={flow.nodes.map((n) => n.id)} strategy={verticalListSortingStrategy}>
        <ol className="space-y-2">
          {flow.nodes.map((n, i) => (
            <SortableNode
              key={n.id}
              node={n}
              index={i}
              active={n.id === activeNodeId}
              onSelect={() => onSelect(n.id)}
              onRemove={() => onRemove(n.id)}
            />
          ))}
        </ol>
      </SortableContext>
    </DndContext>
  );
}

function SortableNode({
  node,
  index,
  active,
  onSelect,
  onRemove,
}: {
  node: FlowNode;
  index: number;
  active: boolean;
  onSelect: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: node.id,
  });
  const Icon = nodeIcon(node.kind);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-3 hover:border-primary/40",
        active && "border-primary bg-accent",
      )}
    >
      <button
        type="button"
        className="text-muted-foreground cursor-grab"
        {...attributes}
        {...listeners}
        aria-label="Reordenar"
      >
        <GripVertical className="size-4" />
      </button>
      <Icon className="size-4 text-primary" />
      <button type="button" onClick={onSelect} className="flex-1 text-left">
        <p className="text-sm font-medium">
          {index + 1}. {node.label}
        </p>
        <p className="text-[11px] text-muted-foreground">{node.kind}</p>
      </button>
      {node.kind !== "start" && node.kind !== "end" && (
        <Button size="icon" variant="ghost" onClick={onRemove} aria-label="Remover">
          <Trash2 className="size-4 text-muted-foreground" />
        </Button>
      )}
    </li>
  );
}

// ─── Inspector ───────────────────────────────────────────────────────────────

function NodeInspector({
  node,
  onLabelChange,
  onConfigChange,
}: {
  node: FlowNode | null;
  onLabelChange: (label: string) => void;
  onConfigChange: (patch: Record<string, unknown>) => void;
}) {
  if (!node) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          Selecione um nó para editar.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Propriedades</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="text-xs text-muted-foreground">Rótulo</label>
          <Input
            value={node.label}
            onChange={(e) => onLabelChange(e.target.value)}
            disabled={node.kind === "start" || node.kind === "end"}
          />
        </div>
        {node.kind === "skill" && (
          <div>
            <label className="text-xs text-muted-foreground">Skill ID</label>
            <Input
              value={String(node.config.skillId ?? "")}
              onChange={(e) => onConfigChange({ skillId: e.target.value })}
              placeholder="ex.: customer.create"
            />
          </div>
        )}
        {node.kind === "workflow" && (
          <div>
            <label className="text-xs text-muted-foreground">Workflow ID</label>
            <Input
              value={String(node.config.workflowId ?? "")}
              onChange={(e) => onConfigChange({ workflowId: e.target.value })}
            />
          </div>
        )}
        {node.kind === "delay" && (
          <div>
            <label className="text-xs text-muted-foreground">Aguardar (ms)</label>
            <Input
              type="number"
              value={Number(node.config.ms ?? 0)}
              onChange={(e) => onConfigChange({ ms: Number(e.target.value) })}
            />
          </div>
        )}
        {(node.kind === "notification" ||
          node.kind === "whatsapp" ||
          node.kind === "confirmation" ||
          node.kind === "approval") && (
          <div>
            <label className="text-xs text-muted-foreground">Mensagem</label>
            <Textarea
              rows={3}
              value={String(node.config.message ?? "")}
              onChange={(e) => onConfigChange({ message: e.target.value })}
            />
          </div>
        )}
        {(node.kind === "question" || node.kind === "humanTask") && (
          <div>
            <label className="text-xs text-muted-foreground">Pergunta / instrução</label>
            <Textarea
              rows={3}
              value={String(node.config.prompt ?? "")}
              onChange={(e) => onConfigChange({ prompt: e.target.value })}
            />
          </div>
        )}
        {(node.kind === "condition" || node.kind === "if") && (
          <div>
            <label className="text-xs text-muted-foreground">Expressão</label>
            <Input
              value={String(node.config.expression ?? "")}
              onChange={(e) => onConfigChange({ expression: e.target.value })}
              placeholder="ex.: order.total > 500"
            />
          </div>
        )}
        {node.kind === "event" && (
          <div>
            <label className="text-xs text-muted-foreground">Evento</label>
            <Select
              value={String(node.config.event ?? "")}
              onValueChange={(v) => onConfigChange({ event: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Escolha um evento" />
              </SelectTrigger>
              <SelectContent>
                {[
                  "sale.confirmed",
                  "quote.sent",
                  "customer.created",
                  "cart.abandoned",
                  "stock.critical",
                  "finance.entry.created",
                  "whatsapp.message.received",
                ].map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {node.kind === "webhook" && (
          <div>
            <label className="text-xs text-muted-foreground">URL</label>
            <Input
              value={String(node.config.url ?? "")}
              onChange={(e) => onConfigChange({ url: e.target.value })}
              placeholder="https://..."
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Simulation / versions / logs ────────────────────────────────────────────

function SimulationPanel({
  simulation,
  validation,
}: {
  simulation: FlowSimulationResult | null;
  validation: FlowValidationResult | null;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Simulação (dry-run)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {validation && !validation.ok && (
          <div className="rounded-md border border-danger/40 bg-danger/5 p-2 text-xs">
            {validation.issues.map((i, idx) => (
              <p key={idx} className="text-danger">
                • {i.message}
              </p>
            ))}
          </div>
        )}
        {!simulation ? (
          <p className="text-xs text-muted-foreground">
            Clique em "Simular" para executar o fluxo sem efeitos reais.
          </p>
        ) : (
          <ScrollArea className="h-[320px] pr-2">
            <ol className="space-y-1">
              {simulation.steps.map((s, i) => (
                <li key={s.nodeId} className="rounded border p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">
                      {i + 1}. {s.label}
                    </span>
                    <span className="text-muted-foreground">~{s.estimatedMs}ms</span>
                  </div>
                  <p className="text-muted-foreground">{s.action}</p>
                  {s.note && <p className="text-warning">{s.note}</p>}
                </li>
              ))}
            </ol>
            <Separator className="my-2" />
            <p className="text-xs text-muted-foreground">
              Total estimado: {simulation.totalEstimatedMs}ms
            </p>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

function VersionsPanel({
  flow,
  onRollback,
  listVersions,
}: {
  flow: FlowDefinition;
  onRollback: (v: number) => void;
  listVersions: (id: string) => ReadonlyArray<{
    version: number;
    createdAt: number;
    note?: string;
  }>;
}) {
  const versions = listVersions(flow.id);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Histórico de versões</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {versions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sem versões registradas.</p>
        ) : (
          versions
            .slice()
            .reverse()
            .map((v) => (
              <div
                key={v.version}
                className="flex items-center justify-between rounded border p-2 text-xs"
              >
                <div>
                  <p className="font-medium">v{v.version}</p>
                  <p className="text-muted-foreground">
                    {new Date(v.createdAt).toLocaleString("pt-BR")} · {v.note ?? "—"}
                  </p>
                </div>
                {v.version !== flow.version && (
                  <Button size="sm" variant="outline" onClick={() => onRollback(v.version)}>
                    <History className="size-3 mr-1" /> Rollback
                  </Button>
                )}
              </div>
            ))
        )}
      </CardContent>
    </Card>
  );
}

function LogsPanel({
  flow,
  listLogs,
}: {
  flow: FlowDefinition;
  listLogs: (id?: string) => ReadonlyArray<{
    at: number;
    event: string;
    version?: number;
    detail?: string;
  }>;
}) {
  const logs = listLogs(flow.id);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Logs</CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum log ainda.</p>
        ) : (
          <ScrollArea className="h-[320px] pr-2">
            <ul className="space-y-1">
              {logs
                .slice()
                .reverse()
                .map((l, i) => (
                  <li key={i} className="text-xs border-b py-1">
                    <span className="text-muted-foreground">
                      {new Date(l.at).toLocaleTimeString("pt-BR")}
                    </span>{" "}
                    <span className="font-medium">{l.event}</span>
                    {l.version ? <span> · v{l.version}</span> : null}
                    {l.detail ? (
                      <span className="text-muted-foreground"> · {l.detail}</span>
                    ) : null}
                  </li>
                ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
