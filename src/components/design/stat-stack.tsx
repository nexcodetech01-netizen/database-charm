import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RADIUS_TOKENS,
  SPACING_TOKENS,
  TEXT_TOKENS,
  statusToken,
  type SpacingToken,
  type StatusToken,
} from "@/design";

/**
 * StatStack (UI.1.4) — empilha indicadores pequenos (Receita, Clientes…).
 *
 * Complementa o MetricCard quando o espaço é estreito (sidebars, painéis).
 * Somente apresentação: recebe valores já formatados.
 */
export interface StatStackItem {
  label: ReactNode;
  value?: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  status?: StatusToken;
}

export interface StatStackProps {
  items: StatStackItem[];
  /** Distribui os itens em linha a partir de `sm`. */
  orientation?: "vertical" | "horizontal";
  density?: SpacingToken;
  /** Separadores entre os itens. */
  divided?: boolean;
  loading?: boolean;
  className?: string;
}

export function StatStack({
  items,
  orientation = "vertical",
  density = "normal",
  divided = true,
  loading = false,
  className,
}: StatStackProps) {
  const spacing = SPACING_TOKENS[density];
  return (
    <dl
      data-testid="stat-stack"
      data-orientation={orientation}
      className={cn(
        orientation === "horizontal"
          ? cn("flex flex-col sm:flex-row sm:flex-wrap", spacing.gap)
          : cn("flex flex-col", spacing.gap),
        divided &&
          (orientation === "horizontal"
            ? "sm:divide-x sm:divide-border"
            : "divide-y divide-border"),
        className,
      )}
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        const token = item.status ? statusToken(item.status) : null;
        return (
          <div
            key={index}
            data-testid="stat-stack-item"
            className={cn(
              "flex min-w-0 items-center gap-3",
              orientation === "horizontal"
                ? cn("sm:flex-1", divided && "sm:px-3 sm:first:pl-0 sm:last:pr-0")
                : divided && "pt-3 first:pt-0",
            )}
          >
            {Icon ? (
              <span
                aria-hidden="true"
                data-testid="stat-stack-icon"
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center",
                  RADIUS_TOKENS.lg,
                  token ? token.soft : "bg-accent text-primary",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            ) : null}
            <div className="min-w-0">
              <dt
                className={cn(
                  "truncate font-medium uppercase tracking-wide text-muted-foreground",
                  TEXT_TOKENS.xs,
                )}
              >
                {item.label}
              </dt>
              <dd className={cn("truncate font-semibold tabular-nums", TEXT_TOKENS.base)}>
                {loading ? (
                  <Skeleton data-testid="stat-stack-skeleton" className="h-5 w-20" />
                ) : (
                  (item.value ?? "—")
                )}
              </dd>
              {!loading && item.hint ? (
                <p className={cn("truncate text-muted-foreground", TEXT_TOKENS.xs)}>
                  {item.hint}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </dl>
  );
}
