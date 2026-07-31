import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ListChecks, Play, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { SUGGESTED_TASKS, TASK_TONE_MAP, type SuggestedTask } from "../workspace/data";

type Priority = "critical" | "high" | "medium" | "low";

const PRIORITY_META: Record<Priority, { label: string; badge: string }> = {
  critical: { label: "Crítico", badge: "border-danger/30 bg-danger/10 text-danger" },
  high: { label: "Alto", badge: "border-warning/30 bg-warning/10 text-warning" },
  medium: { label: "Médio", badge: "border-primary/30 bg-primary/10 text-primary" },
  low: { label: "Baixo", badge: "border-border bg-muted text-muted-foreground" },
};

const TONE_TO_PRIORITY: Record<SuggestedTask["tone"], Priority> = {
  danger: "critical",
  warning: "high",
  neutral: "medium",
  positive: "low",
};

const DEADLINES: Record<string, string> = {
  "review-stock": "Até amanhã",
  "collect-overdue": "Hoje",
  "supplier-order": "Esta semana",
  "reactivation-campaign": "Próximos 7 dias",
};

export function BellaSuggestedTasks() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ListChecks className="h-4 w-4 text-primary" /> Tarefas sugeridas
        </CardTitle>
        <span className="text-[11px] text-muted-foreground">
          {SUGGESTED_TASKS.length} sugestões
        </span>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {SUGGESTED_TASKS.map(({ id, title, description, icon: Icon, tone, meta }) => {
          const priority = TONE_TO_PRIORITY[tone];
          const pMeta = PRIORITY_META[priority];
          const deadline = DEADLINES[id] ?? "Sem prazo";
          return (
            <div
              key={id}
              className="flex flex-col gap-3 rounded-lg border border-border/70 bg-card p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              <div className="flex items-start gap-3">
                <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", TASK_TONE_MAP[tone])}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground">{title}</span>
                    <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                      {meta}
                    </span>
                    <span
                      className={cn(
                        "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                        pMeta.badge,
                      )}
                    >
                      {pMeta.label}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-border/60 pt-2">
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" /> {deadline}
                </span>
                <Button size="sm" variant="outline" className="gap-1.5" disabled>
                  <Play className="h-3.5 w-3.5" /> Executar
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
