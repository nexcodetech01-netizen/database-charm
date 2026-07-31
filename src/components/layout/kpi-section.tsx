import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * KPISection — grid responsivo único para blocos de KPIs no NexOS.
 *
 * Mobile: 1 coluna · sm: 2 colunas · lg: N colunas (padrão 4).
 * Garante altura, espaçamento e alinhamento consistentes entre módulos.
 * Cada filho deve ser um {@link KpiCard} (ou variação com a mesma altura).
 */
export interface KpiSectionProps {
  children: ReactNode;
  /** Colunas no breakpoint `lg`. Aceita 2, 3, 4 ou 5 (padrão 4). */
  columns?: 2 | 3 | 4 | 5;
  className?: string;
}

export function KpiSection({ children, columns = 4, className }: KpiSectionProps) {
  const lg =
    columns === 2
      ? "lg:grid-cols-2"
      : columns === 3
        ? "lg:grid-cols-3"
        : columns === 5
          ? "lg:grid-cols-3 xl:grid-cols-5"
          : "lg:grid-cols-4";
  return (
    <section
      aria-label="Indicadores"
      className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2", lg, className)}
    >
      {children}
    </section>
  );
}
