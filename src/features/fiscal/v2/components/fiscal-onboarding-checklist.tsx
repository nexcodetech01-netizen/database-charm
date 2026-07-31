import { useNavigate } from "@tanstack/react-router";
import { Check, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useFiscalReadiness, type ReadinessCheck } from "../hooks/use-fiscal-readiness";

/**
 * Sprint 010 — Timeline vertical de configuração.
 * Cada etapa é clicável e leva ao passo correspondente do wizard.
 */
export function FiscalOnboardingChecklist() {
  const readiness = useFiscalReadiness();
  const navigate = useNavigate();

  if (readiness.isLoading) {
    return (
      <section className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando etapas…
        </div>
      </section>
    );
  }

  const go = (c: ReadinessCheck) => {
    navigate({
      to: "/fiscal/configuracao",
      search: c.step ? { step: c.step } : {},
    });
  };

  const items = readiness.checks;

  return (
    <section
      aria-label="Etapas de configuração fiscal"
      className="rounded-xl border border-border/60 bg-card p-6 shadow-sm"
    >
      <header className="mb-5">
        <h3 className="text-base font-semibold tracking-tight">
          Etapas de configuração
        </h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Siga a jornada para deixar o módulo pronto para emitir.
        </p>
      </header>

      <ol className="relative space-y-1">
        {items.map((c, idx) => {
          const isLast = idx === items.length - 1;
          const clickable = !!c.step;
          const dotTone =
            c.status === "ok"
              ? "border-emerald-500 bg-emerald-500 text-white"
              : c.status === "warn"
                ? "border-amber-500 bg-background text-amber-600 dark:text-amber-400"
                : c.status === "error"
                  ? "border-primary bg-background text-primary"
                  : "border-border bg-background text-muted-foreground";

          return (
            <li key={c.id} className="relative">
              {!isLast ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[15px] top-9 bottom-0 w-px",
                    c.status === "ok" ? "bg-emerald-500/40" : "bg-border",
                  )}
                />
              ) : null}

              <button
                type="button"
                onClick={() => go(c)}
                disabled={!clickable}
                aria-label={`${c.label}: ${c.detail}`}
                className={cn(
                  "group relative flex w-full items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors",
                  clickable
                    ? "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    : "cursor-default opacity-90",
                )}
              >
                <span
                  className={cn(
                    "z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 text-xs font-semibold transition-transform group-hover:scale-105",
                    dotTone,
                  )}
                >
                  {c.status === "ok" ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    idx + 1
                  )}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      c.status === "ok" && "text-muted-foreground",
                    )}
                  >
                    {c.label}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                    {c.detail}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
