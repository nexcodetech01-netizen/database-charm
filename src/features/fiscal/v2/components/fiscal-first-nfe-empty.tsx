import { FileText, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useFiscalReadiness } from "../hooks/use-fiscal-readiness";

/**
 * Sprint 010 — Empty state premium para primeira NF-e.
 * Ilustração + copy curta + CTA principal.
 */
export function FiscalFirstNfeEmpty({ onIssue }: { onIssue: () => void }) {
  const readiness = useFiscalReadiness();
  const disabled = readiness.blockers > 0;

  return (
    <section className="relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-card via-card to-primary/5 p-10 shadow-sm">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-20 -left-10 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl"
      />

      <div className="relative mx-auto flex max-w-md flex-col items-center text-center">
        <div className="relative">
          <span
            aria-hidden
            className="absolute inset-0 -m-2 rounded-2xl bg-primary/20 blur-xl"
          />
          <span className="relative grid h-16 w-16 place-items-center rounded-2xl border border-primary/20 bg-background text-primary shadow-sm">
            <FileText className="h-7 w-7" strokeWidth={1.5} />
          </span>
        </div>

        <h3 className="mt-5 text-xl font-semibold tracking-tight">
          Sua primeira NF-e
        </h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          Você ainda não realizou nenhuma emissão.
          {disabled
            ? " Conclua a configuração para começar."
            : " Tudo pronto — emita sua primeira nota agora."}
        </p>

        <div className="mt-6">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button size="lg" onClick={onIssue} disabled={disabled}>
                    <Sparkles className="mr-1.5 h-4 w-4" /> Emitir minha primeira NF-e
                  </Button>
                </span>
              </TooltipTrigger>
              {disabled ? (
                <TooltipContent>Conclua a configuração para emitir.</TooltipContent>
              ) : null}
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </section>
  );
}
