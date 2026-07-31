import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Terminal } from "lucide-react";
import type { ImportExecutionLog } from "../types";

/**
 * Painel de execução. Mostra início, fim, tempo, linhas processadas e erros.
 * Puramente visual.
 */
export function ImportExecutionLogPanel({
  log,
}: {
  log: ImportExecutionLog;
}) {
  const format = (v: string | null) =>
    v ? new Date(v).toLocaleTimeString("pt-BR") : "—";
  const duration =
    log.durationMs === null
      ? "—"
      : log.durationMs < 1000
        ? `${log.durationMs} ms`
        : `${(log.durationMs / 1000).toFixed(1)} s`;

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2 pb-2">
        <Terminal className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-sm">Log de execução</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-5">
        <Metric label="Início" value={format(log.startedAt)} />
        <Metric label="Fim" value={format(log.endedAt)} />
        <Metric label="Tempo" value={duration} />
        <Metric
          label="Linhas processadas"
          value={log.processedRows.toLocaleString("pt-BR")}
        />
        <Metric
          label="Erros"
          value={log.errors.toLocaleString("pt-BR")}
          tone={log.errors > 0 ? "text-red-600 dark:text-red-400" : undefined}
        />
      </CardContent>
    </Card>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className={`mt-0.5 text-sm font-semibold tabular-nums ${tone ?? ""}`}>
        {value}
      </div>
    </div>
  );
}
