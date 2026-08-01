import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Panel } from "./panel";
import { SPACING_TOKENS } from "@/design";

/**
 * LoadingSurface (UI.3.1) — superfície oficial de carregamento do NexOS.
 *
 * Substitui os blocos de `Skeleton` improvisados espalhados pelas telas.
 * Puramente visual: não conhece hooks, serviços, rotas ou dados.
 */
export type LoadingSurfaceVariant = "page" | "detail" | "form" | "table" | "cards";

export interface LoadingSurfaceProps {
  variant?: LoadingSurfaceVariant;
  /** Linhas/itens repetidos (tabela, formulário, cards). */
  rows?: number;
  /** Quantidade de métricas no topo (page/detail). */
  metrics?: number;
  className?: string;
}

function HeaderSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-64" />
      <Skeleton className="h-4 w-44" />
    </div>
  );
}

function MetricsSkeleton({ count }: { count: number }) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", SPACING_TOKENS.comfortable.gap)}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

function RowsSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

export function LoadingSurface({
  variant = "page",
  rows = 6,
  metrics = 4,
  className,
}: LoadingSurfaceProps) {
  const stack = SPACING_TOKENS.relaxed.stack;

  if (variant === "cards") {
    return (
      <div data-testid="loading-surface" data-variant={variant} className={cn(stack, className)}>
        <MetricsSkeleton count={metrics} />
      </div>
    );
  }

  if (variant === "table") {
    return (
      <div data-testid="loading-surface" data-variant={variant} className={className}>
        <Panel>
          <RowsSkeleton count={rows} />
        </Panel>
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div data-testid="loading-surface" data-variant={variant} className={cn(stack, className)}>
        <HeaderSkeleton />
        <Panel stack>
          <Skeleton className="h-5 w-40" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: rows }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </Panel>
      </div>
    );
  }

  if (variant === "detail") {
    return (
      <div data-testid="loading-surface" data-variant={variant} className={cn(stack, className)}>
        <HeaderSkeleton />
        <MetricsSkeleton count={metrics} />
        <Panel>
          <div className="grid gap-6 lg:grid-cols-[minmax(224px,288px)_minmax(0,1fr)]">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <RowsSkeleton count={rows} />
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div data-testid="loading-surface" data-variant={variant} className={cn(stack, className)}>
      <HeaderSkeleton />
      <MetricsSkeleton count={metrics} />
      <Panel>
        <RowsSkeleton count={rows} />
      </Panel>
    </div>
  );
}
