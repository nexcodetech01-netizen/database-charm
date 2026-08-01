import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Panel } from "./panel";
import { SectionHeader } from "./section-header";
import { SPACING_TOKENS, type SpacingToken } from "@/design";

/**
 * Section (UI.1.4) — container oficial do sistema: Header, Body e Footer.
 *
 * Reutiliza {@link Panel} e {@link SectionHeader}; não duplica estilos.
 * Puramente visual.
 */
export interface SectionProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** Substitui completamente o cabeçalho padrão. */
  header?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  density?: SpacingToken;
  /** Remove o padding do corpo (tabelas coladas na borda). */
  flushBody?: boolean;
  className?: string;
  bodyClassName?: string;
}

export function Section({
  title,
  description,
  actions,
  header,
  footer,
  children,
  density = "relaxed",
  flushBody = false,
  className,
  bodyClassName,
}: SectionProps) {
  const spacing = SPACING_TOKENS[density];
  const hasHeader = Boolean(header ?? title ?? description ?? actions);

  return (
    <Panel as="section" density={density} flush className={cn("overflow-hidden", className)}>
      {hasHeader ? (
        <div data-testid="section-header" className={cn(spacing.padding, "pb-0")}>
          {header ?? (
            <SectionHeader
              title={title ?? ""}
              description={description}
              actions={actions}
            />
          )}
        </div>
      ) : null}

      <div
        data-testid="section-body"
        className={cn(!flushBody && spacing.padding, hasHeader && !flushBody && "pt-4", bodyClassName)}
      >
        {children}
      </div>

      {footer ? (
        <div
          data-testid="section-footer"
          className={cn("border-t border-border bg-muted/30", spacing.padding)}
        >
          {footer}
        </div>
      ) : null}
    </Panel>
  );
}
