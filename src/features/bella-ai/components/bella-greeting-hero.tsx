import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Panel } from "@/components/design";
import { RADIUS_TOKENS, TEXT_TOKENS, SPACING_TOKENS, statusToken } from "@/design";

/**
 * BellaGreetingHero (UI.2.2) — saudação + resumo executivo em linguagem natural.
 *
 * Puramente apresentacional: recebe textos já prontos (BellaDailyBrief).
 * Nenhuma regra de negócio, skill, provider ou serviço é acionado aqui.
 */
export interface BellaGreetingHeroProps {
  greeting: string;
  /** Nome do usuário/empresa exibido após a saudação. */
  name?: string;
  /** Linha de abertura do resumo (ex.: "Hoje você possui:"). */
  intro?: ReactNode;
  /** Marcadores do resumo executivo, já em linguagem natural. */
  highlights: string[];
  closing?: ReactNode;
  side?: ReactNode;
  className?: string;
}

export function BellaGreetingHero({
  greeting,
  name,
  intro = "Hoje você possui:",
  highlights,
  closing,
  side,
  className,
}: BellaGreetingHeroProps) {
  const token = statusToken("info");
  const visible = highlights.filter(Boolean);

  return (
    <Panel
      as="section"
      elevation="floating"
      className={cn("grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center", className)}
    >
      <div data-testid="bella-greeting-hero" className="min-w-0">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className={cn("grid h-10 w-10 shrink-0 place-items-center", RADIUS_TOKENS.lg, token.soft)}
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <h2
            data-testid="bella-greeting-title"
            className="min-w-0 truncate text-2xl font-semibold tracking-tight sm:text-3xl"
          >
            {greeting}
            {name ? `, ${name}` : ""}
          </h2>
        </div>

        <div className={cn("mt-4", SPACING_TOKENS.normal.stack)}>
          {visible.length > 0 ? (
            <>
              <p className={cn("text-muted-foreground", TEXT_TOKENS.sm)}>{intro}</p>
              <ul data-testid="bella-greeting-highlights" className="space-y-1.5">
                {visible.map((line) => (
                  <li
                    key={line}
                    className={cn("flex items-start gap-2 text-foreground", TEXT_TOKENS.sm)}
                  >
                    <span
                      aria-hidden="true"
                      className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", token.dot)}
                    />
                    <span className="min-w-0">{line}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p
              data-testid="bella-greeting-empty"
              className={cn("text-muted-foreground", TEXT_TOKENS.sm)}
            >
              Nada exige sua atenção agora. A Bella avisa assim que algo mudar.
            </p>
          )}
          {closing ? (
            <p className={cn("text-muted-foreground", TEXT_TOKENS.xs)}>{closing}</p>
          ) : null}
        </div>
      </div>

      {side ? <div className="min-w-0 lg:w-72">{side}</div> : null}
    </Panel>
  );
}
