import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "./page-header";
import { StatStack, type StatStackItem } from "./stat-stack";
import { StatusBadge, type StatusBadgeStatus } from "./status-badge";
import { RADIUS_TOKENS, SPACING_TOKENS } from "@/design";

/**
 * EntityHeader (UI.1.4) — cabeçalho oficial das telas de entidade.
 *
 * Reutiliza {@link PageHeader}, {@link StatusBadge} e {@link StatStack};
 * nenhum estilo é duplicado. Puramente visual.
 */
export interface EntityHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
  /** Status semântico exibido ao lado do título. */
  status?: { label: ReactNode; status: StatusBadgeStatus };
  /** Avatar opcional (iniciais, foto ou nó livre). */
  avatar?: ReactNode;
  /** Métricas rápidas empilhadas abaixo do bloco principal. */
  metrics?: StatStackItem[];
  metricsLoading?: boolean;
  /** Slot livre abaixo de tudo. */
  extra?: ReactNode;
  className?: string;
}

export function EntityHeader({
  title,
  description,
  breadcrumb,
  actions,
  icon,
  status,
  avatar,
  metrics,
  metricsLoading = false,
  extra,
  className,
}: EntityHeaderProps) {
  const heading = (
    <span className="flex min-w-0 flex-wrap items-center gap-2">
      <span className="truncate">{title}</span>
      {status ? (
        <StatusBadge status={status.status}>{status.label}</StatusBadge>
      ) : null}
    </span>
  );

  const titleNode = avatar ? (
    <span className="flex min-w-0 items-center gap-3">
      <span
        data-testid="entity-header-avatar"
        className={cn(
          "grid h-10 w-10 shrink-0 place-items-center overflow-hidden bg-accent text-sm font-semibold text-primary",
          RADIUS_TOKENS.lg,
        )}
      >
        {avatar}
      </span>
      {heading}
    </span>
  ) : (
    heading
  );

  const hasMetrics = Boolean(metrics?.length);

  return (
    <div data-testid="entity-header" className={cn(SPACING_TOKENS.comfortable.stack, className)}>
      <PageHeader
        title={titleNode}
        description={description}
        breadcrumb={breadcrumb}
        actions={actions}
        icon={avatar ? undefined : icon}
        extra={
          hasMetrics || extra ? (
            <div className={SPACING_TOKENS.comfortable.stack}>
              {hasMetrics ? (
                <StatStack
                  items={metrics ?? []}
                  orientation="horizontal"
                  loading={metricsLoading}
                />
              ) : null}
              {extra}
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
