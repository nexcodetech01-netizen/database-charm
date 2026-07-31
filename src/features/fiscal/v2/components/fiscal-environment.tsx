/**
 * Sprint 007 RC1 — Sinalização única de ambiente fiscal.
 *
 * Fonte de verdade visual para "homologação vs produção":
 *  - `FiscalEnvironmentBadge` — badge compacto (dashboard, listas, detalhes)
 *  - `FiscalEnvironmentBanner` — faixa no topo das telas do módulo
 *  - `ProductionConfirmDialog` — confirmação obrigatória ao entrar em produção
 *
 * Nenhum componente aqui faz fetch próprio além do readiness já cacheado.
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

import { useFiscalReadiness } from "../hooks/use-fiscal-readiness";
import type { NfeEnvironment } from "../types/environment";

export const FISCAL_ENVIRONMENT_LABEL: Record<NfeEnvironment, string> = {
  homologation: "Homologação",
  production: "Produção",
};

const BADGE_TONE: Record<NfeEnvironment, string> = {
  homologation: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  production: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

const DOT: Record<NfeEnvironment, string> = {
  homologation: "🟡",
  production: "🟢",
};

export function FiscalEnvironmentBadge({
  environment,
  withPrefix = false,
  className,
}: {
  environment: NfeEnvironment;
  /** Prefixa com a palavra "Ambiente" (usado no dashboard). */
  withPrefix?: boolean;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 text-[11px] font-semibold", BADGE_TONE[environment], className)}
      title={
        environment === "production"
          ? "Ambiente de PRODUÇÃO — NF-es com validade fiscal."
          : "Ambiente de HOMOLOGAÇÃO — NF-es apenas para testes."
      }
    >
      {withPrefix ? <span className="font-normal opacity-70">Ambiente</span> : null}
      <span aria-hidden>{DOT[environment]}</span>
      {FISCAL_ENVIRONMENT_LABEL[environment]}
    </Badge>
  );
}

/**
 * Faixa fixa no topo das telas do módulo Fiscal.
 * Usa o ambiente efetivo calculado pelo readiness (settings → provider).
 */
export function FiscalEnvironmentBanner({
  environment,
  className,
}: {
  /** Sobrescreve o ambiente detectado (opcional). */
  environment?: NfeEnvironment;
  className?: string;
}) {
  const readiness = useFiscalReadiness();
  const env = environment ?? readiness.environment;

  // Nunca renderiza a faixa antes do ambiente persistido chegar: exibir
  // "homologação" por fallback contradiz o ambiente usado na emissão.
  if (!environment && !readiness.environmentResolved) return null;

  const prod = env === "production";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-start gap-2 rounded-lg border px-4 py-2.5 text-sm",
        prod
          ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-300"
          : "border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300",
        className,
      )}
    >
      <span aria-hidden className="leading-5">
        {DOT[env]}
      </span>
      <p className="leading-5">
        {prod ? (
          <span className="font-medium">Ambiente de PRODUÇÃO.</span>
        ) : (
          <>
            <span className="font-medium">Você está em ambiente de HOMOLOGAÇÃO.</span>{" "}
            <span className="opacity-90">
              As NF-es emitidas possuem apenas validade para testes.
            </span>
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Confirmação obrigatória antes de trocar qualquer seletor de ambiente
 * de homologação para produção.
 */
export function ProductionConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Você está entrando em PRODUÇÃO</AlertDialogTitle>
          <AlertDialogDescription>
            Todas as NF-es emitidas terão validade fiscal. Deseja continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Continuar em produção
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
