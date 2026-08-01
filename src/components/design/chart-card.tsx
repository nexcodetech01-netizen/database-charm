import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { TEXT_TOKENS } from "@/design";
import { Panel } from "./panel";
import { SectionHeader } from "./section-header";

/**
 * ChartCard (UI.1.2) — moldura padrão para gráficos e visualizações.
 * Trata loading e empty state; o conteúdo é sempre injetado por composição.
 */
export interface ChartCardProps {
  title: ReactNode;
  summary?: ReactNode;
  toolbar?: ReactNode;
  children?: ReactNode;
  /** Quando verdadeiro, exibe o empty state no lugar do conteúdo. */
  empty?: boolean;
  emptyMessage?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function ChartCard({
  title,
  summary,
  toolbar,
  children,
  empty = false,
  emptyMessage = "Sem dados para exibir no período.",
  loading = false,
  className,
}: ChartCardProps) {
  return (
    <Panel density="relaxed" stack className={className}>
      <SectionHeader title={title} description={summary} actions={toolbar} />
      <Separator />
      {loading ? (
        <Skeleton data-testid="chart-card-skeleton" className="h-48 w-full" />
      ) : empty ? (
        <div
          data-testid="chart-card-empty"
          className={cn(
            "grid h-48 place-items-center text-center text-muted-foreground",
            TEXT_TOKENS.sm,
          )}
        >
          {emptyMessage}
        </div>
      ) : (
        <div data-testid="chart-card-content">{children}</div>
      )}
    </Panel>
  );
}
