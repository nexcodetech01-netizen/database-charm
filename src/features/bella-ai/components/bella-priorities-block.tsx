import {
  Flame,
  AlertTriangle,
  PackageMinus,
  Users,
  TrendingUp,
  FileText,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BellaPriorityItem } from "../dashboard";
import type { BellaEventModule, EventPriority } from "../events";

interface Props {
  priorities: BellaPriorityItem[];
  /** Máximo de cards exibidos — evita rolagem infinita na Home. */
  limit?: number;
}

const MODULE_ICON: Record<BellaEventModule, LucideIcon> = {
  finance: AlertTriangle,
  inventory: PackageMinus,
  customers: Users,
  sales: TrendingUp,
  fiscal: FileText,
};

const PRIORITY_META: Record<EventPriority, { label: string; badge: string; tone: string }> = {
  CRITICAL: {
    label: "Alta",
    badge: "bg-danger/10 text-danger",
    tone: "bg-danger/10 text-danger",
  },
  HIGH: {
    label: "Alta",
    badge: "bg-warning/10 text-warning",
    tone: "bg-warning/10 text-warning",
  },
  MEDIUM: {
    label: "Média",
    badge: "bg-primary/10 text-primary",
    tone: "bg-primary/10 text-primary",
  },
  LOW: {
    label: "Baixa",
    badge: "bg-muted text-muted-foreground",
    tone: "bg-muted text-muted-foreground",
  },
};

/**
 * Bloco único de "Prioridades de hoje".
 * Consolida a antiga Central de Prioridades, as Prioridades do dia e a
 * Leitura da Bella em uma só seção — apenas apresentação.
 */
export function BellaPrioritiesBlock({ priorities, limit = 4 }: Props) {
  const visible = priorities.slice(0, limit);

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-danger" />
          <h2 className="text-sm font-semibold tracking-tight">Prioridades de hoje</h2>
        </div>
        <span className="text-[11px] text-muted-foreground">
          {priorities.length === 0
            ? "Nada crítico agora"
            : `${priorities.length} priorizada${priorities.length > 1 ? "s" : ""} por Bella`}
        </span>
      </header>

      {visible.length === 0 ? (
        <div className="rounded-2xl bg-card p-8 text-center text-xs text-muted-foreground shadow-sm ring-1 ring-border/50">
          Nenhum evento crítico no momento. A Bella avisará assim que algo demandar atenção.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {visible.map((item) => {
            const Icon = MODULE_ICON[item.module];
            const meta = PRIORITY_META[item.priority];
            return (
              <article
                key={item.id}
                className="flex items-start gap-3 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/50 transition-colors hover:ring-primary/30"
              >
                <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", meta.tone)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-medium text-foreground">{item.title}</h3>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        meta.badge,
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">{item.description}</p>
                  {item.recommendation && (
                    <p className="text-[11px] italic text-muted-foreground">
                      Sugestão: {item.recommendation}
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
