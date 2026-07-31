import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Play,
  Plus,
  Power,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  useAutomationRuns,
  useAutomationTemplates,
  useAutomations,
  useCreateAutomationFromTemplate,
  useDeleteAutomation,
  useRunAutomationTest,
  useToggleAutomation,
} from "../hooks";
import type { AutomationRunStatus } from "../types";

const STATUS_LABEL: Record<AutomationRunStatus, string> = {
  success: "Sucesso",
  error: "Erro",
  skipped: "Ignorada",
  partial: "Parcial",
};

const STATUS_TONE: Record<AutomationRunStatus, string> = {
  success: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  error: "bg-red-500/10 text-red-600 border-red-500/20",
  skipped: "bg-muted text-muted-foreground border-border",
  partial: "bg-amber-500/10 text-amber-600 border-amber-500/20",
};

export function BellaAutomationsPanel({ companyId }: { companyId: string | null }) {
  const automations = useAutomations(companyId);
  const runs = useAutomationRuns(companyId);
  const templates = useAutomationTemplates();
  const toggleM = useToggleAutomation(companyId);
  const deleteM = useDeleteAutomation(companyId);
  const testM = useRunAutomationTest(companyId);
  const createM = useCreateAutomationFromTemplate(companyId);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const metrics = useMemo(() => {
    const list = automations.data ?? [];
    const runsList = runs.data ?? [];
    const active = list.filter((a) => a.enabled).length;
    const successes = runsList.filter((r) => r.status === "success").length;
    const failures = runsList.filter((r) => r.status === "error").length;
    return { total: list.length, active, successes, failures };
  }, [automations.data, runs.data]);

  if (!companyId) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Selecione uma empresa para gerenciar automações.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile icon={Sparkles} label="Automações" value={metrics.total} />
        <KpiTile icon={Power} label="Ativas" value={metrics.active} tone="primary" />
        <KpiTile icon={CheckCircle2} label="Sucessos (100 últ.)" value={metrics.successes} tone="success" />
        <KpiTile icon={AlertTriangle} label="Falhas (100 últ.)" value={metrics.failures} tone="danger" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">Automações</CardTitle>
              <p className="text-xs text-muted-foreground">
                Cada automação escuta um gatilho e dispara uma ou mais Skills da Bella.
              </p>
            </div>
            <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" /> Nova
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Escolher template</DialogTitle>
                  <DialogDescription>
                    Comece por um blueprint pronto. Você pode editar depois.
                  </DialogDescription>
                </DialogHeader>
                <div className="max-h-[60vh] space-y-2 overflow-auto">
                  {(templates.data ?? []).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        createM
                          .mutateAsync(t.id)
                          .then((r) => {
                            toast.success(`"${r.automation.name}" criada`);
                            if (r.issues.length > 0) {
                              toast.warning(
                                `Criada como desabilitada — ajustes pendentes: ${r.issues.length}`,
                              );
                            }
                            setTemplatesOpen(false);
                          })
                          .catch((e) => toast.error(e.message))
                      }
                      className="w-full rounded-lg border border-border p-3 text-left transition hover:border-primary/50 hover:bg-muted/50"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-medium">{t.name}</div>
                        <Badge variant="outline" className="text-[10px] uppercase">
                          {t.category}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>
                      <p className="mt-1 text-[10px] font-mono text-muted-foreground">
                        {t.triggerType} · {t.actions.length} ação(ões)
                      </p>
                    </button>
                  ))}
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setTemplatesOpen(false)}>
                    Cancelar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="space-y-2">
            {automations.isLoading ? (
              <EmptyState icon={Loader2} label="Carregando automações..." spin />
            ) : (automations.data ?? []).length === 0 ? (
              <EmptyState
                icon={Sparkles}
                label="Nenhuma automação ainda. Comece por um template."
              />
            ) : (
              (automations.data ?? []).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-medium">{a.name}</div>
                      {a.lastRunStatus && (
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${STATUS_TONE[a.lastRunStatus]}`}
                        >
                          {STATUS_LABEL[a.lastRunStatus]}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {a.triggerType} · {a.actions.length} ação(ões) ·{" "}
                      {a.runCount} execuções ({a.successCount}✓ / {a.failureCount}✗)
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={a.enabled}
                      onCheckedChange={(v) =>
                        toggleM
                          .mutateAsync({ id: a.id, enabled: v })
                          .then(() => toast.success(v ? "Ativada" : "Desativada"))
                          .catch((e) => toast.error(e.message))
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Executar teste"
                      onClick={() =>
                        testM
                          .mutateAsync({ automationId: a.id, payload: {} })
                          .then((r) =>
                            toast.success(
                              `Executadas ${r.executed}/${r.matched} (${r.successes}✓ ${r.failures}✗)`,
                            ),
                          )
                          .catch((e) => toast.error(e.message))
                      }
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Excluir"
                      onClick={() => {
                        if (!confirm(`Excluir "${a.name}"?`)) return;
                        deleteM
                          .mutateAsync(a.id)
                          .then(() => toast.success("Excluída"))
                          .catch((e) => toast.error(e.message));
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Timeline de execuções */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Últimas execuções
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {runs.isLoading ? (
              <EmptyState icon={Loader2} label="Carregando..." spin />
            ) : (runs.data ?? []).length === 0 ? (
              <EmptyState icon={Activity} label="Sem execuções registradas." />
            ) : (
              (runs.data ?? []).slice(0, 20).map((r) => (
                <div key={r.id} className="rounded-md border border-border p-2 text-xs">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className={`text-[10px] ${STATUS_TONE[r.status]}`}>
                      {STATUS_LABEL[r.status]}
                    </Badge>
                    <span className="text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString("pt-BR")}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                    {r.triggerType} · {r.durationMs ?? 0}ms
                  </div>
                  {r.actionsSummary.length > 0 && (
                    <>
                      <Separator className="my-1.5" />
                      <ul className="space-y-0.5">
                        {r.actionsSummary.map((o, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            {o.ok ? (
                              <CheckCircle2 className="mt-0.5 h-3 w-3 text-emerald-600" />
                            ) : (
                              <AlertTriangle className="mt-0.5 h-3 w-3 text-red-600" />
                            )}
                            <span className="flex-1">
                              <span className="font-medium">{o.label}</span>{" "}
                              <span className="text-muted-foreground">— {o.message}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: "primary" | "success" | "danger";
}) {
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-emerald-600"
        : tone === "danger"
          ? "text-red-600"
          : "text-foreground";
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-4">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`mt-1 text-2xl font-semibold ${toneCls}`}>{value}</div>
        </div>
        <Icon className={`h-5 w-5 ${toneCls}`} />
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon: Icon,
  label,
  spin,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  spin?: boolean;
}) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
      <Icon className={`h-4 w-4 ${spin ? "animate-spin" : ""}`} />
      {label}
    </div>
  );
}
