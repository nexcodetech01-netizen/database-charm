import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * Standard loading state for pages/sections. Prefer <Skeleton /> for lists
 * and cards; use LoadingState only when a spinner is more appropriate
 * (initial route load, async action in progress).
 */
export function LoadingState({
  label = "Carregando…",
  className,
}: {
  label?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

/**
 * Standard error state — surfaces a short message and, when possible,
 * a retry action. Never expose raw error stacks to the user.
 */
export function ErrorState({
  title = "Algo deu errado",
  description = "Não conseguimos carregar as informações. Tente novamente em instantes.",
  onRetry,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-destructive/40 bg-destructive/5 px-6 py-12 text-center",
        className,
      )}
      role="alert"
    >
      <div className="mb-3 grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={onRetry}
        >
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Página inteira de erro de carregamento (detalhe/edição). Usada quando a
 * busca falha — para não confundir com "não encontrado".
 */
export function LoadErrorPage({
  what,
  onRetry,
}: {
  /** ex.: "este cliente" */
  what: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
      <ErrorState
        title={`Não foi possível abrir ${what}`}
        description="O registro pode existir normalmente — o sistema só não conseguiu carregá-lo agora. Verifique a internet e tente de novo."
        onRetry={onRetry}
      />
    </div>
  );
}
