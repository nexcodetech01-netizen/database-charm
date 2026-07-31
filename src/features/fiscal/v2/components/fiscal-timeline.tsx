import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  FileSignature,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { FiscalEventDto } from "../functions/fiscal.functions";
import { parseRejection } from "../lib/rejection-parser";

/**
 * Fiscal v2 — Timeline completa do ciclo NF-e (Sprint 007.3).
 *
 * Cobre todos os estados: draft → validating → signing → sending →
 * authorized/rejected → cancelled. Mensagens dentro de payload.message
 * são renderizadas em destaque; rejeições passam pelo parser SEFAZ.
 */

interface EventStyle {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  dotClass: string;
  textClass: string;
}

const STYLES: Record<string, EventStyle> = {
  created: {
    label: "Documento criado",
    icon: Sparkles,
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
  },
  validated: {
    label: "Validação aprovada",
    icon: CheckCircle2,
    dotClass: "bg-primary",
    textClass: "text-primary",
  },
  signed: {
    label: "XML assinado",
    icon: FileSignature,
    dotClass: "bg-primary",
    textClass: "text-primary",
  },
  sent: {
    label: "Enviado à SEFAZ",
    icon: Send,
    dotClass: "bg-amber-500",
    textClass: "text-amber-600 dark:text-amber-400",
  },
  authorized: {
    label: "Autorizada pela SEFAZ",
    icon: ShieldCheck,
    dotClass: "bg-emerald-500",
    textClass: "text-emerald-600 dark:text-emerald-400",
  },
  rejected: {
    label: "Rejeitada pela SEFAZ",
    icon: XCircle,
    dotClass: "bg-rose-500",
    textClass: "text-rose-600 dark:text-rose-400",
  },
  cancelled: {
    label: "Cancelada",
    icon: Ban,
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground line-through",
  },
  discarded: {
    label: "Tentativa descartada",
    icon: Ban,
    dotClass: "bg-muted-foreground",
    textClass: "text-muted-foreground",
  },
  error: {
    label: "Erro no processamento",
    icon: AlertTriangle,
    dotClass: "bg-rose-500",
    textClass: "text-rose-600 dark:text-rose-400",
  },
};

function styleFor(eventType: string): EventStyle {
  return (
    STYLES[eventType] ?? {
      label: eventType,
      icon: Loader2,
      dotClass: "bg-muted-foreground",
      textClass: "text-muted-foreground",
    }
  );
}

function parsePayload(json: string | null): Record<string, unknown> | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function formatDelta(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function FiscalTimeline({ events }: { events: FiscalEventDto[] }) {
  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum evento registrado ainda. Os eventos serão preenchidos
        automaticamente pelo motor fiscal.
      </p>
    );
  }
  const first = new Date(events[0].createdAt).getTime();
  const last = new Date(events[events.length - 1].createdAt).getTime();
  const totalMs = Math.max(0, last - first);

  return (
    <>
      {events.length > 1 ? (
        <p className="mb-3 text-xs text-muted-foreground">
          Ciclo total:{" "}
          <span className="font-medium text-foreground">
            {formatDelta(totalMs)}
          </span>
          {" · "}
          {events.length} evento(s)
        </p>
      ) : null}
      <ol className="relative border-s border-border ps-4 space-y-4">
        {events.map((ev, idx) => {
          const s = styleFor(ev.eventType);
          const payload = parsePayload(ev.payloadJson);
          const message =
            typeof payload?.message === "string" ? (payload.message as string) : null;
          const code = typeof payload?.code === "string" ? (payload.code as string) : null;
          const protocol =
            typeof payload?.protocol === "string" ? (payload.protocol as string) : null;
          const issues = Array.isArray(payload?.issues)
            ? (payload.issues as Array<{ field: string; message: string }>)
            : null;
          const Icon = s.icon;
          const rej =
            ev.eventType === "rejected"
              ? parseRejection(code, message)
              : null;
          const delta =
            idx > 0
              ? new Date(ev.createdAt).getTime() -
                new Date(events[idx - 1].createdAt).getTime()
              : null;

          return (
            <li key={ev.id} className="relative">
              <span
                className={cn(
                  "absolute -start-[19px] mt-1 grid h-3 w-3 place-items-center rounded-full",
                  s.dotClass,
                )}
              />
              <div className={cn("flex items-center gap-2 text-sm font-medium", s.textClass)}>
                <Icon className="h-3.5 w-3.5" />
                <span>{s.label}</span>
                {code ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                    cód. {code}
                  </span>
                ) : null}
                {delta !== null ? (
                  <span className="ml-auto rounded bg-muted/70 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    +{formatDelta(delta)}
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {format(new Date(ev.createdAt), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
              </div>

              {rej ? (
                <div className="mt-2 rounded-md border border-rose-500/30 bg-rose-500/5 p-2 text-xs">
                  <p className="font-medium text-rose-700 dark:text-rose-300">
                    {rej.title}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">{rej.action}</p>
                  {message && message !== rej.title ? (
                    <p className="mt-1 text-[11px] text-muted-foreground/80">
                      Detalhe SEFAZ: {message}
                    </p>
                  ) : null}
                </div>
              ) : message ? (
                <p className="mt-1 text-xs text-foreground/80">{message}</p>
              ) : null}

              {protocol ? (
                <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                  Protocolo {protocol}
                </p>
              ) : null}

              {issues && issues.length > 0 ? (
                <ul className="mt-2 space-y-0.5 rounded bg-muted p-2 text-[11px]">
                  {issues.slice(0, 6).map((it, i) => (
                    <li key={i} className="text-muted-foreground">
                      <span className="font-medium">{it.field}:</span> {it.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ol>
    </>
  );
}
