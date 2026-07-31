import { lazy, Suspense, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Loader2, Sparkles, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { useFiscalReadiness } from "../hooks/use-fiscal-readiness";
const FiscalDiagnosticsSheet = lazy(() =>
  import("./fiscal-diagnostics-sheet").then((m) => ({
    default: m.FiscalDiagnosticsSheet,
  })),
);

const STEP_ORDER = ["empresa", "certificado", "provedor", "regras", "testes"] as const;
type WizardStep = (typeof STEP_ORDER)[number];

/**
 * Sprint 010 — Hero card enxuto.
 * Mostra apenas: título, progresso, próxima etapa e ações.
 * Detalhes de bloqueios/avisos vivem no drawer de diagnóstico.
 */
export function FiscalOverviewCard() {
  const readiness = useFiscalReadiness();
  const navigate = useNavigate();
  const [diagOpen, setDiagOpen] = useState(false);

  const firstPending = readiness.checks.find(
    (c) => c.status === "error" || c.status === "warn",
  );
  const pendingStep = (firstPending?.step as WizardStep | undefined) ?? null;

  const goToNext = () => {
    if (readiness.ready || !pendingStep) {
      navigate({ to: "/fiscal/configuracao" });
    } else {
      navigate({ to: "/fiscal/configuracao", search: { step: pendingStep } });
    }
  };

  if (readiness.isLoading) {
    return (
      <section className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculando status…
        </div>
      </section>
    );
  }

  const barTone =
    readiness.status === "ok"
      ? "bg-emerald-500"
      : readiness.status === "warn"
        ? "bg-amber-500"
        : "bg-primary";

  const nextLabel = readiness.ready
    ? "Módulo pronto para emissão"
    : (firstPending?.label ?? "Concluir configuração");

  return (
    <>
      <section
        aria-label="Configuração fiscal"
        className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
      >
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0 space-y-3">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="truncate text-base font-semibold tracking-tight">
                Configuração Fiscal
              </h2>
              <span
                className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground"
                aria-live="polite"
              >
                {readiness.ok} de {readiness.total} etapas concluídas
              </span>
            </div>

            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={readiness.percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className={cn("h-full rounded-full transition-all duration-500 ease-out", barTone)}
                style={{ width: `${readiness.percent}%` }}
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              {readiness.ready ? (
                <Sparkles className="h-4 w-4 shrink-0 text-emerald-500" />
              ) : (
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                />
              )}
              <p className="min-w-0 truncate text-sm">
                <span className="text-muted-foreground">Próxima etapa: </span>
                <span className="font-medium">{nextLabel}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:min-w-[200px]">
            <Button onClick={goToNext} className="w-full">
              Continuar
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setDiagOpen(true)}
            >
              <Stethoscope className="mr-1.5 h-3.5 w-3.5" /> Ver diagnóstico
            </Button>
          </div>
        </div>
      </section>

      {diagOpen ? (
        <Suspense fallback={null}>
          <FiscalDiagnosticsSheet open={diagOpen} onOpenChange={setDiagOpen} />
        </Suspense>
      ) : null}
    </>
  );
}
