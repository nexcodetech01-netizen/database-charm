import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  PackageMinus,
  CalendarClock,
  Wallet,
  ArrowRight,
  Flame,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Priority = "critical" | "high" | "medium";

interface PriorityItem {
  id: string;
  icon: LucideIcon;
  title: string;
  description: string;
  priority: Priority;
  tone: string;
}

const PRIORITY_META: Record<Priority, { label: string; badge: string }> = {
  critical: {
    label: "Crítico",
    badge: "border-danger/30 bg-danger/10 text-danger",
  },
  high: {
    label: "Alto",
    badge: "border-warning/30 bg-warning/10 text-warning",
  },
  medium: {
    label: "Médio",
    badge: "border-primary/30 bg-primary/10 text-primary",
  },
};

const PRIORITIES: PriorityItem[] = [
  {
    id: "inadimplentes",
    icon: AlertTriangle,
    title: "Cobrar 8 clientes inadimplentes",
    description: "R$ 4.320 em cobranças em atraso há mais de 5 dias.",
    priority: "critical",
    tone: "bg-danger/10 text-danger",
  },
  {
    id: "estoque",
    icon: PackageMinus,
    title: "5 produtos abaixo do estoque mínimo",
    description: "Reposição sugerida antes do fim de semana.",
    priority: "high",
    tone: "bg-warning/10 text-warning",
  },
  {
    id: "prolabore",
    icon: CalendarClock,
    title: "Pró-labore vence em 2 dias",
    description: "Programar transferência para os sócios.",
    priority: "high",
    tone: "bg-primary/10 text-primary",
  },
  {
    id: "caixa",
    icon: Wallet,
    title: "Fechar caixa de hoje",
    description: "Sessão aberta há 6h aguardando conferência.",
    priority: "medium",
    tone: "bg-primary/10 text-primary",
  },
];

const MAX_VISIBLE = 4;

export function BellaPrioritiesToday() {
  const visible = PRIORITIES.slice(0, MAX_VISIBLE);
  const hasMore = PRIORITIES.length > MAX_VISIBLE;

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-4 w-4 text-danger" /> Prioridades de hoje
        </CardTitle>
        <span className="text-[11px] text-muted-foreground">
          {PRIORITIES.length} itens priorizados por Bella
        </span>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {visible.map(({ id, icon: Icon, title, description, priority, tone }) => {
            const meta = PRIORITY_META[priority];
            return (
              <div
                key={id}
                className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", tone)}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{title}</span>
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                        meta.badge,
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <Button variant="ghost" size="sm" className="gap-1 self-center" disabled>
                  Ver detalhes <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
        {hasMore && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className="gap-1" disabled>
              Ver todas <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
