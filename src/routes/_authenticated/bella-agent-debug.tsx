import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Bug, RefreshCw, PlayCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { PageLayout, KpiSection, KpiCard } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requirePermission } from "@/features/rbac/guards/require-permission";
import { usePermissions } from "@/features/rbac/hooks/use-permissions";
import {
  fetchAgentExecutionLog,
  fetchAgentRuntimeMetrics,
  isBellaAgentEnabled,
  setBellaAgentEnabled,
  type AgentRuntimeTrace,
} from "@/features/bella-ai/agent";
import { handleAgentRuntimeFn } from "@/features/bella-ai/agent/runtime.functions";


/**
 * Painel interno de Debug do Agent Runtime (Fase 5).
 *
 * Somente para diagnóstico: permite alternar a feature flag no
 * navegador, simular mensagens e inspecionar as últimas execuções
 * gravadas em `bella_executions`.
 *
 * Guardado por `bella_ia.view`.
 */
export const Route = createFileRoute("/_authenticated/bella-agent-debug")({
  beforeLoad: requirePermission("bella_ia.view"),
  component: BellaAgentDebugPage,
  head: () => ({
    meta: [
      { title: "Debug do Agent Runtime · Bella IA" },
      { name: "description", content: "Painel interno para diagnóstico do novo Agent Runtime da Bella." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function BellaAgentDebugPage() {
  const { companyId, permissions, isOwner } = usePermissions();
  const [enabled, setEnabled] = useState(isBellaAgentEnabled());
  const [message, setMessage] = useState("saldo do caixa");
  const [trace, setTrace] = useState<AgentRuntimeTrace | null>(null);
  const [responseText, setResponseText] = useState<string>("");
  const [running, setRunning] = useState(false);

  const sinceIso = useMemo(
    () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    [],
  );

  const metricsQuery = useQuery({
    queryKey: ["bella-agent-debug", "metrics", companyId, sinceIso],
    enabled: !!companyId,
    queryFn: () =>
      fetchAgentRuntimeMetrics({ companyId: companyId!, sinceIso }),
  });

  const logQuery = useQuery({
    queryKey: ["bella-agent-debug", "log", companyId, sinceIso],
    enabled: !!companyId,
    queryFn: () =>
      fetchAgentExecutionLog({ companyId: companyId!, sinceIso, limit: 30 }),
  });

  const handleToggle = (next: boolean) => {
    setBellaAgentEnabled(next);
    setEnabled(next);
  };

  const handleSimulate = async () => {
    if (!companyId) return;
    setRunning(true);
    setTrace(null);
    setResponseText("");
    try {
      const result = await handleAgentRuntimeFn({
        data: {
          message,
          ctx: {
            companyId,
            conversationId: null,
          },
        }
      });
      setTrace(result.trace);
      setResponseText(result.response?.message ?? "(fluxo legado assumiria)");
      await Promise.all([metricsQuery.refetch(), logQuery.refetch()]);
    } finally {
      setRunning(false);
    }
  };

  const metrics = metricsQuery.data;

  return (
    <PageLayout
      icon={Bug}
      title="Debug do Agent Runtime"
      description="Diagnóstico do novo pipeline da Bella (Intent → Planner → Skill). Uso interno."
    >
      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Feature flag (este navegador)</CardTitle>
            <div className="flex items-center gap-3">
              <Label htmlFor="agent-flag" className="text-sm">
                BELLA_AGENT_ENABLED
              </Label>
              <Switch id="agent-flag" checked={enabled} onCheckedChange={handleToggle} />
              <Badge variant={enabled ? "default" : "secondary"}>
                {enabled ? "ligado" : "desligado"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            O override é local (localStorage). Quando desligado, toda mensagem cai
            no fluxo legado — nenhuma execução é registrada. Intents suportadas
            nesta fase: <code>customer.find</code>, <code>customer.create</code>,{" "}
            <code>product.find</code>, <code>finance.cash_balance</code>.
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Simular mensagem</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder='ex.: "buscar cliente Maria Silva"'
              />
              <Button onClick={handleSimulate} disabled={running || !companyId}>
                <PlayCircle className="mr-2 h-4 w-4" />
                Executar
              </Button>
            </div>
            {trace && (
              <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
                <TraceLine label="Habilitado" value={String(trace.enabled)} />
                <TraceLine label="Intent" value={trace.intent?.id ?? "—"} />
                <TraceLine
                  label="Confidence"
                  value={trace.intent ? trace.intent.confidence.toFixed(2) : "—"}
                />
                <TraceLine label="Tempo (ms)" value={String(trace.executionTimeMs)} />
                <TraceLine
                  label="Fallback"
                  value={
                    trace.fallback
                      ? `sim${trace.fallbackReason ? ` (${trace.fallbackReason})` : ""}`
                      : "não"
                  }
                />
                <TraceLine label="Resposta" value={responseText} />
              </div>
            )}
          </CardContent>
        </Card>

        <KpiSection>
          <KpiCard
            label="Execuções (24h)"
            value={metrics?.totalExecutions ?? 0}
            hint="Total gravado em bella_executions"
          />
          <KpiCard
            label="Sucesso"
            value={metrics ? `${Math.round(metrics.successRate * 100)}%` : "—"}
            hint={`${metrics?.successful ?? 0} skills executadas`}
          />
          <KpiCard
            label="Fallbacks"
            value={metrics?.fallbacks ?? 0}
            hint="Caíram no fluxo legado"
          />
          <KpiCard
            label="Tempo médio"
            value={metrics ? `${metrics.avgExecutionMs} ms` : "—"}
          />
        </KpiSection>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Skills mais usadas</CardTitle>
            </CardHeader>
            <CardContent>
              <TopList items={metrics?.topSkills.map((s) => ({ label: s.skillId, count: s.count })) ?? []} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Intents mais usadas</CardTitle>
            </CardHeader>
            <CardContent>
              <TopList items={metrics?.topIntents.map((i) => ({ label: i.intent, count: i.count })) ?? []} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Últimas execuções</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                metricsQuery.refetch();
                logQuery.refetch();
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Atualizar
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Intent</TableHead>
                  <TableHead>Skill</TableHead>
                  <TableHead>Resultado</TableHead>
                  <TableHead className="text-right">ms</TableHead>
                  <TableHead>Erro / motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(logQuery.data ?? []).map((row) => {
                  const isFallback = (row.errorMessage ?? "").startsWith("fallback:");
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(row.startedAt).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{row.intent ?? "—"}</TableCell>
                      <TableCell className="text-xs">{row.skillId ?? "—"}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            row.success ? "default" : isFallback ? "secondary" : "destructive"
                          }
                        >
                          {row.success
                            ? row.resultCode ?? "success"
                            : isFallback
                              ? "fallback"
                              : row.resultCode ?? "error"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {row.executionTimeMs ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.errorMessage ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {logQuery.data && logQuery.data.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      Nenhuma execução nas últimas 24h.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </PageLayout>
  );
}

function TraceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-28 font-medium text-foreground">{label}:</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  );
}

function TopList({ items }: { items: Array<{ label: string; count: number }> }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem dados no período.</p>;
  }
  return (
    <ul className="space-y-1 text-sm">
      {items.map((it) => (
        <li key={it.label} className="flex items-center justify-between">
          <span className="font-mono text-xs">{it.label}</span>
          <Badge variant="outline">{it.count}</Badge>
        </li>
      ))}
    </ul>
  );
}
