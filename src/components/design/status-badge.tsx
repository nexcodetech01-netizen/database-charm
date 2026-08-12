import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { statusToken, type StatusToken } from "@/design";
import { RADIUS_TOKENS, TEXT_TOKENS, INTERACTION_TOKENS } from "@/design";

/**
 * StatusBadge (UI.1.2) — badge semântico do Design System NexOS.
 *
 * Puramente visual: nenhuma regra de negócio, hook ou serviço.
 * Usa exclusivamente os tokens de status da Sprint UI.1.1 — nunca
 * `emerald`, `green`, `red`, `amber` ou similares.
 */
export type StatusBadgeStatus = StatusToken;

export type StatusBadgeAppearance = "soft" | "solid" | "outline";

export interface StatusBadgeProps {
  status?: string | null;
  children?: ReactNode;
  label?: ReactNode;
  appearance?: StatusBadgeAppearance;
  /** Exibe um ponto colorido antes do texto. */
  withDot?: boolean;
  className?: string;
}

export function StatusBadge({
  status = "neutral",
  children,
  label,
  appearance = "soft",
  withDot = true,
  className,
}: StatusBadgeProps) {
  const token = statusToken(status);
  const tone =
    appearance === "solid"
      ? token.solid
      : appearance === "outline"
        ? cn("border bg-transparent", token.border, token.text)
        : cn("border-none bg-accent/20", token.soft, token.text);

  return (
    <span
      data-status={status ?? "neutral"}
      data-appearance={appearance}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 font-medium",
        RADIUS_TOKENS.lg,
        TEXT_TOKENS.xs,
        INTERACTION_TOKENS.hover,
        tone,
        className,
      )}
    >
      {withDot ? (
        <span
          aria-hidden="true"
          className={cn("h-1.5 w-1.5 rounded-full", token.dot)}
        />
      ) : null}
      {children ?? label ?? status}
    </span>
  );
}
