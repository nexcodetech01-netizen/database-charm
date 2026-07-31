/**
 * Dashboard de Saúde da Plataforma.
 *
 * Consolida em uma única tela:
 *  - status dos jobs agendados (pg_cron)
 *  - histórico de execuções (`job_runs`)
 *  - fila de mortos das integrações (`integration_dead_letters`)
 *
 * Somente leitura: nenhuma regra de negócio é executada aqui.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw, Timer } from "lucide-react";
import { requirePermission } from "@/features/rbac";
import { PageLayout, KpiSection, KpiCard, EmptyState, ListSkeleton } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useJobRuns,
  useScheduledJobs,
  useDeadLetters,
  summarizeRuns,
} from "@/features/observability/hooks/use-platform-health";

export const Route = createFileRoute("/_authenticated/saude-plataforma")({
  beforeLoad: requirePermission("settings.view"),
  head: () => ({
    meta: [
      { title: "Saúde da Plataforma | NexOS" },
      {
        name: "description",
        content:
          "Monitoramento de jobs automáticos, execuções e falhas de integração do NexOS.",
      },
      { property: "og:title", content: "Saúde da Plataforma | NexOS" },
      {
        property: "og:description",
        content: "Jobs agendados, histórico de execuções e fila de falhas das integrações.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlatformHealthPage,
});

function formatDateTime(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function formatDuration(ms: number | null) {
  if (!ms) return "—";
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function StatusBadge({ status }: { status: string | null }) {
  if (status === "success") return <Badge variant="secondary">Sucesso</Badge>;
  if (status === "error") return <Badge variant="destructive">Erro</Badge>;
  if (status === "running") return <Badge variant="outline">Executando</Badge>;
  return <Badge variant="outline">—</Badge>;
}

function PlatformHealthPage() {
  const runsQuery = useJobRuns(100);
  const scheduleQuery = useScheduledJobs();
  const dlqQuery = useDeadLetters(25);

  const runs = useMemo(() => runsQuery.data ?? [], [runsQuery.data]);
  const summaries = useMemo(() => summarizeRuns(runs), [runs]);
  const schedules = scheduleQuery.data ?? [];
  const deadLetters = dlqQuery.data ?? [];

  const errors24h = runs.filter(
    (r) => r.status === "error" && Date.now() - new Date(r.started_at).getTime() < 86_400_000,
  ).length;
  const pendingDlq = deadLetters.filter((d) => d.status === "pending").length;
  const activeSchedules = schedules.filter((s) => s.active).length;

  const refreshAll = () => {
    void runsQuery.refetch();
    void scheduleQuery.refetch();
    void dlqQuery.refetch();
  };

  return (
    <PageLayout
      title="Saúde da Plataforma"
      description="Jobs automáticos, execuções recentes e falhas de integração."
      icon={Activity}
      actions={
        <Button variant="outline" size="sm" onClick={refreshAll}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar
        </Button>
      }
      kpis={
        <KpiSection>
          <KpiCard
            label="Jobs agendados"
            value={String(activeSchedules)}
            icon={Clock}
            hint={`${schedules.length} registrados no agendador`}
          />
          <KpiCard
            label="Execuções (últimas 100)"
            value={String(runs.length)}
            icon={CheckCircle2}
            hint={`${summaries.length} jobs distintos`}
          />
          <KpiCard
            label="Erros em 24h"
            value={String(errors24h)}
            icon={AlertTriangle}
            hint="Execuções finalizadas com falha"
          />
          <KpiCard
            label="Fila de falhas"
            value={String(pendingDlq)}
            icon={Timer}
            hint="Itens pendentes de reprocessamento"
          />
        </KpiSection>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Jobs agendados</CardTitle>
        </CardHeader>
        <CardContent>
          {scheduleQuery.isLoading ? (
            <ListSkeleton />
          ) : schedules.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Nenhum job agendado"
              description="Execute a função schedule_nexos_jobs() informando a URL base e o CRON_JOB_SECRET para ativar as rotinas automáticas."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Frequência</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((job) => (
                  <TableRow key={job.job_name}>
                    <TableCell className="font-medium">{job.job_name}</TableCell>
                    <TableCell className="font-mono text-xs">{job.schedule}</TableCell>
                    <TableCell>
                      <Badge variant={job.active ? "secondary" : "outline"}>
                        {job.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumo por job</CardTitle>
        </CardHeader>
        <CardContent>
          {runsQuery.isLoading ? (
            <ListSkeleton />
          ) : summaries.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Sem execuções registradas"
              description="As execuções aparecerão aqui assim que os jobs automáticos forem disparados."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Última execução</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Sucesso</TableHead>
                  <TableHead className="text-right">Duração média</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map((s) => (
                  <TableRow key={s.jobName}>
                    <TableCell className="font-medium">{s.jobName}</TableCell>
                    <TableCell>{formatDateTime(s.lastRunAt)}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.lastStatus} />
                    </TableCell>
                    <TableCell className="text-right">{s.successRate}%</TableCell>
                    <TableCell className="text-right">{formatDuration(s.avgDurationMs)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Execuções recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma execução registrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Job</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Detalhe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.slice(0, 20).map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">{run.job_name}</TableCell>
                    <TableCell>{formatDateTime(run.started_at)}</TableCell>
                    <TableCell>{formatDuration(run.duration_ms)}</TableCell>
                    <TableCell>
                      <StatusBadge status={run.status} />
                    </TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">
                      {run.error_message ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fila de falhas das integrações</CardTitle>
        </CardHeader>
        <CardContent>
          {deadLetters.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma falha registrada nas integrações.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Origem</TableHead>
                  <TableHead>Tópico</TableHead>
                  <TableHead>Referência</TableHead>
                  <TableHead className="text-right">Tentativas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deadLetters.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.source}</TableCell>
                    <TableCell>{item.topic ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{item.reference ?? "—"}</TableCell>
                    <TableCell className="text-right">{item.attempts}</TableCell>
                    <TableCell>
                      <Badge variant={item.status === "pending" ? "outline" : "secondary"}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                      {item.error_message ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageLayout>
  );
}
