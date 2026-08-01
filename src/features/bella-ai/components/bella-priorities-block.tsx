import {
  AlertTriangle,
  FileText,
  Flame,
  PackageMinus,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Section, StatusBadge } from "@/components/design";
import { RADIUS_TOKENS, TEXT_TOKENS, statusToken, type StatusToken } from "@/design";
import { BellaEmptyState } from "./bella-empty-state";
import type { BellaPriorityItem } from "../dashboard";
import type { BellaEventModule, EventPriority } from "../events";

interface Props {
  priorities: BellaPriorityItem[];
  /** Máximo de itens exibidos — evita rolagem infinita na Home. */
  limit?: number;
}

const MODULE_ICON: Record<BellaEventModule, LucideIcon> = {
  finance: AlertTriangle,
  inventory: PackageMinus,
  customers: Users,
  sales: TrendingUp,
  fiscal: FileText,
};

const PRIORITY_META: Record<EventPriority, { label: string; status: StatusToken }> = {
  CRITICAL: { label: "Crítico", status: "critical" },
  HIGH: { label: "Alta", status: "warning" },
  MEDIUM: { label: "Média", status: "info" },
  LOW: { label: "Baixa", status: "neutral" },
};

/**
 * Prioridades de hoje em formato de Timeline (UI.2.2).
 *
 * Apenas apresentação — os itens continuam vindo do snapshot da Bella,
 * sem qualquer alteração de regra, engine ou provider.
 */
export function BellaPrioritiesBlock({ priorities, limit = 4 }: Props) {
  const visible = priorities.slice(0, limit);

  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-status-danger" aria-hidden="true" />
          Prioridades de hoje
        </span>
      }
      description={
        priorities.length === 0
          ? "Nada crítico agora"
          : `${priorities.length} priorizada${priorities.length > 1 ? "s" : ""} por Bella`
      }
      flushBody={visible.length === 0}
    >
      {visible.length === 0 ? (
        <BellaEmptyState
          icon={Flame}
          title="Nenhum evento crítico no momento"
          description="A Bella avisará assim que algo demandar atenção."
        />
      ) : (
        <ol data-testid="bella-priorities-timeline" className="relative space-y-6">
          <span
            aria-hidden="true"
            className="absolute left-[19px] top-2 bottom-2 w-px bg-border"
          />
          {visible.map((item) => {
            const Icon = MODULE_ICON[item.module];
            const meta = PRIORITY_META[item.priority];
            const token = statusToken(meta.status);
            return (
              <li
                key={item.id}
                data-testid="bella-timeline-item"
                data-priority={item.priority}
                className="relative flex min-w-0 gap-4"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative z-10 grid h-10 w-10 shrink-0 place-items-center border border-border bg-card",
                    RADIUS_TOKENS.lg,
                    token.text,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1 space-y-1.5 pb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className={cn("min-w-0 font-medium", TEXT_TOKENS.sm)}>{item.title}</h3>
                    <StatusBadge status={meta.status} withDot>
                      {meta.label}
                    </StatusBadge>
                  </div>
                  <p className={cn("leading-relaxed text-muted-foreground", TEXT_TOKENS.xs)}>
                    {item.description}
                  </p>
                  {item.recommendation ? (
                    <p className={cn("italic text-muted-foreground", TEXT_TOKENS.xs)}>
                      Sugestão: {item.recommendation}
                    </p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}
