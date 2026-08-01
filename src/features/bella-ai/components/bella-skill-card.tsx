import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Loader2, TriangleAlert, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/design";
import { INTERACTION_TOKENS, RADIUS_TOKENS, TEXT_TOKENS, statusToken } from "@/design";

/**
 * BellaSkillCard (UI.2.2) — apresentação de uma skill executada.
 *
 * Somente visual: recebe nome amigável, resultado, tempo e status já
 * resolvidos. Nenhuma skill é registrada, alterada ou executada aqui.
 */
export type BellaSkillCardStatus = "success" | "running" | "error";

const STATUS_META: Record<
  BellaSkillCardStatus,
  { label: string; token: "success" | "processing" | "danger"; icon: LucideIcon }
> = {
  success: { label: "Concluída", token: "success", icon: CheckCircle2 },
  running: { label: "Executando", token: "processing", icon: Loader2 },
  error: { label: "Falhou", token: "danger", icon: TriangleAlert },
};

export interface BellaSkillCardProps {
  name: ReactNode;
  result?: ReactNode;
  /** Duração em milissegundos, se conhecida. */
  durationMs?: number;
  status?: BellaSkillCardStatus;
  icon?: LucideIcon;
  className?: string;
}

export function formatSkillDuration(ms: number | undefined): string | null {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return null;
  return ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(1)} s`;
}

export function BellaSkillCard({
  name,
  result,
  durationMs,
  status = "success",
  icon,
  className,
}: BellaSkillCardProps) {
  const meta = STATUS_META[status];
  const Icon = icon ?? Wrench;
  const token = statusToken(meta.token);
  const duration = formatSkillDuration(durationMs);

  return (
    <article
      data-testid="bella-skill-card"
      data-status={status}
      className={cn(
        "flex min-w-0 items-start gap-3 border border-border/70 bg-muted/20 p-3",
        RADIUS_TOKENS.lg,
        INTERACTION_TOKENS.hover,
        "hover:border-primary/30",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("grid h-8 w-8 shrink-0 place-items-center", RADIUS_TOKENS.lg, token.soft)}
      >
        <Icon className={cn("h-4 w-4", status === "running" && "animate-spin")} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            data-testid="bella-skill-name"
            className={cn("min-w-0 truncate font-medium", TEXT_TOKENS.sm)}
          >
            {name}
          </p>
          <StatusBadge status={meta.token}>{meta.label}</StatusBadge>
          {duration ? (
            <span
              data-testid="bella-skill-duration"
              className={cn("tabular-nums text-muted-foreground", TEXT_TOKENS.xs)}
            >
              {duration}
            </span>
          ) : null}
        </div>
        {result ? (
          <p
            data-testid="bella-skill-result"
            className={cn("mt-1 text-muted-foreground", TEXT_TOKENS.xs)}
          >
            {result}
          </p>
        ) : null}
      </div>
    </article>
  );
}
