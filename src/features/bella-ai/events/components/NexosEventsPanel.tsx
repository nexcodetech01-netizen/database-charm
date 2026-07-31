/**
 * NexosEventsPanel — "Eventos Inteligentes" na Home da Bella.
 * Mostra últimos eventos, ações tomadas e pendências, em tempo real
 * (assinatura direta do EventHistory in-memory).
 */
import { Activity, AlertTriangle, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useNexosEventMetrics, useNexosEvents } from "../hooks/useNexosEvents";
import type { NexosEventPriority, NexosEventStatus } from "../types";

const PRIORITY_STYLES: Record<NexosEventPriority, string> = {
  LOW: "bg-muted text-muted-foreground",
  NORMAL: "bg-primary/10 text-primary",
  HIGH: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  CRITICAL: "bg-destructive/15 text-destructive",
};

function statusIcon(status?: NexosEventStatus) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    case "error":
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case "processing":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
    case "skipped":
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

interface NexosEventsPanelProps {
  companyId: string;
  limit?: number;
}

export function NexosEventsPanel({ companyId, limit = 20 }: NexosEventsPanelProps) {
  const events = useNexosEvents({ companyId, limit });
  const metrics = useNexosEventMetrics({ companyId });
  const pending = events.filter((e) => e.status === "pending" || e.status === "processing");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Eventos Inteligentes
            </CardTitle>
            <CardDescription>
              Detecção em tempo real de fatos operacionais e reações da Bella.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Última hora: {metrics.perHour}</Badge>
            <Badge variant="outline">Processados: {metrics.processed}</Badge>
            <Badge variant="outline">Fila: {metrics.queued}</Badge>
            {metrics.failures > 0 && (
              <Badge variant="destructive">Falhas: {metrics.failures}</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhum evento capturado ainda. Assim que o ERP emitir fatos operacionais eles
            aparecerão aqui automaticamente.
          </div>
        ) : (
          <ScrollArea className="h-[320px] pr-3">
            <ul className="space-y-2">
              {events.map((evt) => (
                <li
                  key={evt.id}
                  className="flex items-start justify-between gap-3 rounded-md border bg-card p-3"
                >
                  <div className="flex min-w-0 items-start gap-3">
                    {statusIcon(evt.status)}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{evt.type}</span>
                        <Badge className={cn("border-0 text-[10px]", PRIORITY_STYLES[evt.priority])}>
                          {evt.priority}
                        </Badge>
                        <span className="text-xs text-muted-foreground">{evt.module}</span>
                      </div>
                      {evt.source && (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          origem: {evt.source}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted-foreground">
                    {new Date(evt.createdAt).toLocaleTimeString("pt-BR")}
                  </div>
                </li>
              ))}
            </ul>
          </ScrollArea>
        )}
        {pending.length > 0 && (
          <div className="mt-3 text-xs text-muted-foreground">
            {pending.length} pendente(s) sendo processado(s).
          </div>
        )}
      </CardContent>
    </Card>
  );
}
