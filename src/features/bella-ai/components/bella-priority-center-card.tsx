import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Flame, AlertTriangle, PackageMinus, Users, TrendingUp, FileText, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BellaPriorityItem } from "../dashboard";
import type { BellaEventModule, EventPriority } from "../events";

interface BellaPriorityCenterCardProps {
  priorities: BellaPriorityItem[];
}

const MODULE_ICON: Record<BellaEventModule, LucideIcon> = {
  finance: AlertTriangle,
  inventory: PackageMinus,
  customers: Users,
  sales: TrendingUp,
  fiscal: FileText,
};

const PRIORITY_META: Record<
  EventPriority,
  { label: string; badge: string; tone: string }
> = {
  CRITICAL: {
    label: "Crítico",
    badge: "border-danger/30 bg-danger/10 text-danger",
    tone: "bg-danger/10 text-danger",
  },
  HIGH: {
    label: "Alto",
    badge: "border-warning/30 bg-warning/10 text-warning",
    tone: "bg-warning/10 text-warning",
  },
  MEDIUM: {
    label: "Médio",
    badge: "border-primary/30 bg-primary/10 text-primary",
    tone: "bg-primary/10 text-primary",
  },
  LOW: {
    label: "Baixo",
    badge: "border-border bg-muted text-muted-foreground",
    tone: "bg-muted text-muted-foreground",
  },
};

/**
 * Central de Prioridades — Home.
 * Exibe até 4 prioridades derivadas do `BellaPriorityCenter`.
 */
export function BellaPriorityCenterCard({ priorities }: BellaPriorityCenterCardProps) {
  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-4 w-4 text-danger" /> Central de Prioridades
        </CardTitle>
        <span className="text-[11px] text-muted-foreground">
          {priorities.length === 0
            ? "Sem prioridades ativas"
            : `${priorities.length} priorizada${priorities.length > 1 ? "s" : ""} por Bella`}
        </span>
      </CardHeader>
      <CardContent>
        {priorities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 p-6 text-center text-xs text-muted-foreground">
            Nenhum evento crítico no momento. A Bella avisará assim que algo demandar atenção.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {priorities.map((item) => {
              const Icon = MODULE_ICON[item.module];
              const meta = PRIORITY_META[item.priority];
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-lg border border-border/70 bg-card p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
                >
                  <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", meta.tone)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{item.title}</span>
                      <span
                        className={cn(
                          "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                          meta.badge,
                        )}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                    {item.recommendation && (
                      <p className="text-[11px] italic text-muted-foreground">
                        Sugestão: {item.recommendation}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
