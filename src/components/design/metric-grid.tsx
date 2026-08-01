import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SPACING_TOKENS, type SpacingToken } from "@/design";

/**
 * MetricGrid (UI.1.4) — grid oficial para {@link MetricCard}.
 *
 * Puramente visual: responsividade automática (1 → 2 → N colunas).
 * Sem hooks, serviços, rotas ou regra de negócio.
 */
export interface MetricGridProps {
  children?: ReactNode;
  /** Colunas no breakpoint largo. 2, 3, 4 ou 5 (padrão 4). */
  columns?: 2 | 3 | 4 | 5;
  /** Densidade do espaçamento entre cards. */
  density?: SpacingToken;
  /** Rótulo acessível do grupo. */
  label?: string;
  className?: string;
}

const COLUMN_CLASS: Record<NonNullable<MetricGridProps["columns"]>, string> = {
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
  5: "lg:grid-cols-3 xl:grid-cols-5",
};

export function MetricGrid({
  children,
  columns = 4,
  density = "comfortable",
  label = "Indicadores",
  className,
}: MetricGridProps) {
  return (
    <section
      aria-label={label}
      data-testid="metric-grid"
      data-columns={columns}
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2",
        SPACING_TOKENS[density].gap,
        COLUMN_CLASS[columns],
        className,
      )}
    >
      {children}
    </section>
  );
}
