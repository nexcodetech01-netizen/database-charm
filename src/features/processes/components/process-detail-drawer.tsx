import { AlertCircle, CheckCircle2, Clock, Info, Terminal } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { ProcessRecord, ProcessTimelineEvent } from "../types";
import { ProcessCategoryBadge } from "./process-category-badge";
import { ProcessStatusBadge } from "./process-status-badge";

export interface ProcessDetailDrawerProps {
  process: ProcessRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR");
}

function formatDuration(ms: number | null) {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms} ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return `${m}m ${rest.toString().padStart(2, "0")}s`;
}

export function ProcessDetailDrawer({
  process,
  open,
  onOpenChange,
}: ProcessDetailDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        {process ? (
          <div className="flex h-full flex-col">
            <SheetHeader className="space-y-3 pb-4">
              <div className="flex items-center gap-2">
                <ProcessCategoryBadge category={process.category} />
                <ProcessStatusBadge status={process.status} />
              </div>
              <SheetTitle className="text-lg">{process.name}</SheetTitle>
              <SheetDescription>{process.origin}</SheetDescription>
            </SheetHeader>

            <Separator />

            <ScrollArea className="flex-1">
              <div className="space-y-6 py-4 pr-2">
                <ResumoBlock process={process} />

                <TimelineBlock timeline={process.timeline ?? []} />

                <LogsBlock logs={process.logs ?? []} />

                {process.errors && process.errors.length > 0 ? (
                  <ErrorsBlock errors={process.errors} />
                ) : null}
              </div>
            </ScrollArea>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ResumoBlock({ process }: { process: ProcessRecord }) {
  return (
    <section aria-labelledby="detail-resumo" className="space-y-3">
      <h3 id="detail-resumo" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Resumo
      </h3>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Iniciado" value={formatDate(process.startedAt)} />
        <Field label="Finalizado" value={formatDate(process.finishedAt)} />
        <Field label="Tempo" value={formatDuration(process.durationMs)} />
        <Field label="Usuário" value={process.userName} />
        <Field
          label="Processado"
          value={
            process.total != null
              ? `${process.processed.toLocaleString("pt-BR")} / ${process.total.toLocaleString("pt-BR")}`
              : process.processed.toLocaleString("pt-BR")
          }
        />
        <Field label="ID" value={<span className="font-mono text-xs">{process.id}</span>} />
      </dl>
      {process.summary ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {process.summary}
        </p>
      ) : null}
    </section>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm font-medium text-foreground">{value}</dd>
    </div>
  );
}

function TimelineBlock({ timeline }: { timeline: ProcessTimelineEvent[] }) {
  return (
    <section aria-labelledby="detail-timeline" className="space-y-3">
      <h3 id="detail-timeline" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> Linha do tempo
      </h3>
      {timeline.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Nenhum evento registrado ainda.
        </p>
      ) : (
        <ol className="space-y-3 border-l border-border pl-4">
          {timeline.map((event) => {
            const Icon =
              event.intent === "success"
                ? CheckCircle2
                : event.intent === "error"
                  ? AlertCircle
                  : Info;
            return (
              <li key={event.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[22px] top-0.5 grid h-4 w-4 place-items-center rounded-full bg-background",
                    event.intent === "success" && "text-emerald-500",
                    event.intent === "error" && "text-red-500",
                    event.intent === "warning" && "text-amber-500",
                    (!event.intent || event.intent === "info") && "text-primary",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <p className="text-sm font-medium text-foreground">{event.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(event.at).toLocaleString("pt-BR")}
                </p>
                {event.detail ? (
                  <p className="mt-1 text-xs text-muted-foreground">{event.detail}</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function LogsBlock({ logs }: { logs: ProcessRecord["logs"] }) {
  return (
    <section aria-labelledby="detail-logs" className="space-y-3">
      <h3 id="detail-logs" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Terminal className="h-3.5 w-3.5" /> Logs
      </h3>
      {!logs || logs.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
          Sem logs registrados.
        </p>
      ) : (
        <pre className="max-h-64 overflow-auto rounded-md bg-muted/60 p-3 text-[11px] leading-relaxed">
          {logs.map((line) => (
            <div key={line.id} className={cn(
              "font-mono",
              line.level === "error" && "text-red-500",
              line.level === "warning" && "text-amber-500",
            )}>
              <span className="text-muted-foreground">
                [{new Date(line.at).toLocaleTimeString("pt-BR")}]
              </span>{" "}
              {line.message}
            </div>
          ))}
        </pre>
      )}
    </section>
  );
}

function ErrorsBlock({ errors }: { errors: string[] }) {
  return (
    <section aria-labelledby="detail-errors" className="space-y-3">
      <h3 id="detail-errors" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-red-500">
        <AlertCircle className="h-3.5 w-3.5" /> Erros
      </h3>
      <ul className="space-y-2">
        {errors.map((err, i) => (
          <li
            key={i}
            className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400"
          >
            {err}
          </li>
        ))}
      </ul>
    </section>
  );
}
