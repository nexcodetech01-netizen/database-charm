import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sugestão inline da Bella IA.
 *
 * Cartão discreto exibido em contexto (produto, venda, compra, financeiro,
 * marketing) que transforma dados que o sistema já tem em UMA sugestão
 * acionável. Nunca interrompe: nada de modal, popover ou toast.
 *
 * Toda sugestão termina em UMA ação:
 *  - `action.to`      → navega para uma rota do NexOS
 *  - `action.onClick` → executa uma ação local (adicionar produto, aplicar preço)
 *  - se nenhuma for informada, cai no fallback "Perguntar para Bella" com
 *    contexto pré-preenchido via `contextPrompt`.
 */
export interface BellaInlineAction {
  label: string;
  to?: string;
  onClick?: () => void;
}

export interface BellaInlineSuggestionProps {
  /** Título curto ("Margem abaixo do ideal"). */
  title: string;
  /** Detalhe humano em 1 frase. */
  message: string;
  /** Ação primária. Se ausente, usa fallback de conversa contextual. */
  action?: BellaInlineAction;
  /** Contexto textual enviado à Bella no fallback. */
  contextPrompt?: string;
  /** Severidade visual. */
  tone?: "info" | "warning" | "danger";
  className?: string;
}

const TONE: Record<NonNullable<BellaInlineSuggestionProps["tone"]>, string> = {
  info: "border-primary/20 bg-primary/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  danger: "border-destructive/30 bg-destructive/5",
};

const ICON_TONE: Record<NonNullable<BellaInlineSuggestionProps["tone"]>, string> = {
  info: "bg-primary/10 text-primary",
  warning: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  danger: "bg-destructive/15 text-destructive",
};

export function BellaInlineSuggestion({
  title,
  message,
  action,
  contextPrompt,
  tone = "info",
  className,
}: BellaInlineSuggestionProps) {
  const ctaClass =
    "inline-flex shrink-0 items-center gap-1 rounded-md bg-background/70 px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-background";

  let cta: React.ReactNode;
  if (action?.to) {
    cta = (
      <Link to={action.to} className={ctaClass}>
        {action.label}
        <ArrowRight className="h-3 w-3" />
      </Link>
    );
  } else if (action?.onClick) {
    cta = (
      <button type="button" onClick={action.onClick} className={ctaClass}>
        {action.label}
        <ArrowRight className="h-3 w-3" />
      </button>
    );
  } else {
    cta = (
      <Link
        to="/bella"
        onClick={() => {
          if (typeof window !== "undefined" && contextPrompt) {
            window.sessionStorage.setItem("nexos:bella:pending-context", contextPrompt);
          }
        }}
        className={ctaClass}
      >
        Perguntar para Bella
        <ArrowRight className="h-3 w-3" />
      </Link>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-lg border p-3 text-sm",
        TONE[tone],
        className,
      )}
    >
      <div
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-md",
          ICON_TONE[tone],
        )}
      >
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{message}</p>
      </div>
      {cta}
    </div>
  );
}
