import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, ChevronRight, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { useFiscalReadiness, type ReadinessCheck } from "../hooks/use-fiscal-readiness";
import { useFiscalProviderConfig } from "../hooks/use-fiscal";
import { FiscalEnvironmentBadge } from "./fiscal-environment";
import { testProviderConnection } from "../functions/fiscal.functions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Sprint 008 — Diagnóstico fiscal em drawer lateral.
 * Detalha bloqueios, avisos, score e ações recomendadas sem ocupar
 * espaço permanente no dashboard.
 */
export function FiscalDiagnosticsSheet({ open, onOpenChange }: Props) {
  const readiness = useFiscalReadiness();
  const provider = useFiscalProviderConfig();
  const navigate = useNavigate();
  const runHealth = useServerFn(testProviderConnection);
  const [testing, setTesting] = useState(false);

  const percentTone =
    readiness.status === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : readiness.status === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";
  const barTone =
    readiness.status === "ok"
      ? "bg-emerald-500"
      : readiness.status === "warn"
        ? "bg-amber-500"
        : "bg-rose-500";

  const blockers = readiness.checks.filter((c) => c.status === "error");
  const warnings = readiness.checks.filter((c) => c.status === "warn");
  const okItems = readiness.checks.filter((c) => c.status === "ok");

  const runHealthCheck = async () => {
    setTesting(true);
    try {
      const r = await runHealth();
      const map = { ok: toast.success, warning: toast.warning, error: toast.error } as const;
      map[r.status](r.message);
      provider.refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao testar conexão.");
    } finally {
      setTesting(false);
    }
  };

  const resolve = (c: ReadinessCheck) => {
    onOpenChange(false);
    navigate({
      to: "/fiscal/configuracao",
      search: c.step ? { step: c.step } : {},
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Diagnóstico fiscal</SheetTitle>
          <SheetDescription>
            Bloqueios, avisos e recomendações para deixar o módulo pronto para emitir.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center justify-between rounded-lg border border-border/60 px-4 py-2.5">
          <span className="text-sm font-medium">Ambiente atual</span>
          <FiscalEnvironmentBadge environment={readiness.environment} />
        </div>

        <div className="mt-3 rounded-lg border border-border/60 bg-muted/30 p-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium">Conformidade</span>
            <span className={cn("text-2xl font-semibold", percentTone)}>{readiness.percent}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full transition-all", barTone)}
              style={{ width: `${readiness.percent}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {okItems.length} de {readiness.total} etapas concluídas
            {blockers.length > 0 ? ` · ${blockers.length} bloqueio(s)` : ""}
            {warnings.length > 0 ? ` · ${warnings.length} pendente(s)` : ""}
          </p>
        </div>

        <Section title="Bloqueios" count={blockers.length} tone="error">
          {blockers.length === 0 ? (
            <EmptyLine tone="ok" text="Sem bloqueios. Pronto para próximos passos." />
          ) : (
            blockers.map((c) => <CheckRow key={c.id} check={c} onResolve={() => resolve(c)} />)
          )}
        </Section>

        <Section title="Pendências" count={warnings.length} tone="warn">
          {warnings.length === 0 ? (
            <EmptyLine tone="ok" text="Nada pendente." />
          ) : (
            warnings.map((c) => <CheckRow key={c.id} check={c} onResolve={() => resolve(c)} />)
          )}
        </Section>

        <Section title="Concluído" count={okItems.length} tone="ok">
          {okItems.map((c) => (
            <CheckRow key={c.id} check={c} onResolve={() => resolve(c)} />
          ))}
        </Section>

        <div className="mt-6 flex gap-2">
          <Button variant="outline" className="flex-1" onClick={runHealthCheck} disabled={testing}>
            {testing ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Testando…
              </>
            ) : (
              "Testar provedor"
            )}
          </Button>
          <Button onClick={() => onOpenChange(false)} className="flex-1">
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: "ok" | "warn" | "error";
  children: React.ReactNode;
}) {
  const toneCls =
    tone === "ok"
      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
        : "bg-rose-500/10 text-rose-600 dark:text-rose-400";
  return (
    <section className="mt-5">
      <header className="mb-2 flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        <Badge
          variant="outline"
          className={cn("border-transparent px-1.5 py-0 text-[10px]", toneCls)}
        >
          {count}
        </Badge>
      </header>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  );
}

function CheckRow({ check, onResolve }: { check: ReadinessCheck; onResolve: () => void }) {
  const Icon =
    check.status === "ok" ? CheckCircle2 : check.status === "warn" ? AlertTriangle : XCircle;
  const iconCls =
    check.status === "ok"
      ? "text-emerald-500"
      : check.status === "warn"
        ? "text-amber-500"
        : "text-rose-500";
  return (
    <li>
      <button
        type="button"
        onClick={onResolve}
        disabled={!check.step}
        className={cn(
          "group flex w-full items-start gap-3 rounded-md border border-border/50 bg-card p-3 text-left transition",
          check.step ? "hover:bg-muted/40" : "cursor-default opacity-90",
        )}
      >
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconCls)} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{check.label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{check.detail}</p>
        </div>
        {check.step && check.status !== "ok" ? (
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50 group-hover:text-foreground" />
        ) : null}
      </button>
    </li>
  );
}

function EmptyLine({ tone, text }: { tone: "ok"; text: string }) {
  return (
    <li className="flex items-center gap-2 rounded-md bg-emerald-500/5 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="h-3.5 w-3.5" /> {text}
    </li>
  );
}
