import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SPACING_TOKENS, type SpacingToken } from "@/design";

/**
 * FormLayout (UI.1.4) — estrutura oficial de formulários: largura, grid,
 * espaçamento, agrupamento e sidebar opcional.
 *
 * Somente estrutura visual: não valida, não submete, não conhece campos.
 */
export type FormLayoutWidth = "sm" | "md" | "lg" | "full";

const WIDTH_CLASS: Record<FormLayoutWidth, string> = {
  sm: "max-w-xl",
  md: "max-w-3xl",
  lg: "max-w-5xl",
  full: "max-w-none",
};

export interface FormLayoutProps {
  children: ReactNode;
  /** Coluna lateral (resumo, ajuda, metadados). */
  sidebar?: ReactNode;
  footer?: ReactNode;
  width?: FormLayoutWidth;
  density?: SpacingToken;
  className?: string;
}

export function FormLayout({
  children,
  sidebar,
  footer,
  width = "lg",
  density = "relaxed",
  className,
}: FormLayoutProps) {
  const spacing = SPACING_TOKENS[density];
  return (
    <div
      data-testid="form-layout"
      data-width={width}
      className={cn("w-full", WIDTH_CLASS[width], spacing.stack, className)}
    >
      <div
        className={cn(
          sidebar
            ? cn("grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]", spacing.gap)
            : "",
        )}
      >
        <div className={cn("min-w-0", spacing.stack)}>{children}</div>
        {sidebar ? (
          <aside data-testid="form-layout-sidebar" className={cn("min-w-0", spacing.stack)}>
            {sidebar}
          </aside>
        ) : null}
      </div>
      {footer ? (
        <div
          data-testid="form-layout-footer"
          className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4"
        >
          {footer}
        </div>
      ) : null}
    </div>
  );
}

/**
 * FormGroup — agrupamento de campos dentro do FormLayout.
 */
export interface FormGroupProps {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  /** Colunas do grid de campos (padrão 2 a partir de `sm`). */
  columns?: 1 | 2 | 3;
  density?: SpacingToken;
  className?: string;
}

const GROUP_COLUMNS: Record<NonNullable<FormGroupProps["columns"]>, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
};

export function FormGroup({
  title,
  description,
  children,
  columns = 2,
  density = "comfortable",
  className,
}: FormGroupProps) {
  const spacing = SPACING_TOKENS[density];
  return (
    <section
      data-testid="form-group"
      data-columns={columns}
      className={cn(spacing.stack, className)}
    >
      {title || description ? (
        <div className="space-y-1">
          {title ? (
            <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
          ) : null}
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}
      <div className={cn("grid", GROUP_COLUMNS[columns], spacing.gap)}>{children}</div>
    </section>
  );
}
