import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { RADIUS_TOKENS, SHADOW_TOKENS, SPACING_TOKENS, type SpacingToken } from "@/design";

/**
 * Panel (UI.1.2) — container visual padrão do Design System NexOS.
 *
 * Centraliza padding, radius, sombra, background e espaçamento interno.
 * Sem lógica de negócio.
 */
export interface PanelProps {
  children: ReactNode;
  /** Densidade do padding/stack interno. */
  density?: SpacingToken;
  /** Nível de elevação (tokens UI.1.1). */
  elevation?: keyof typeof SHADOW_TOKENS;
  /** Empilha os filhos com o espaçamento da densidade. */
  stack?: boolean;
  /** Remove o padding — útil para tabelas coladas na borda. */
  flush?: boolean;
  as?: "div" | "section" | "article" | "aside";
  className?: string;
}

export function Panel({
  children,
  density = "relaxed",
  elevation = "card",
  stack = false,
  flush = false,
  as: Tag = "div",
  className,
}: PanelProps) {
  const spacing = SPACING_TOKENS[density];
  return (
    <Tag
      data-density={density}
      data-elevation={elevation}
      className={cn(
        "border border-border bg-card text-card-foreground",
        RADIUS_TOKENS.xl,
        SHADOW_TOKENS[elevation],
        !flush && spacing.padding,
        stack && spacing.stack,
        className,
      )}
    >
      {children}
    </Tag>
  );
}
