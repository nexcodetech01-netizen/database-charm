import { Button } from "@/components/ui/button";
import { ListChecks, Play, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section, StatusBadge } from "@/components/design";
import { RADIUS_TOKENS, TEXT_TOKENS, statusToken, type StatusToken } from "@/design";
import { SUGGESTED_TASKS, type SuggestedTask } from "../workspace/data";

const TONE_TO_STATUS: Record<SuggestedTask["tone"], { status: StatusToken; label: string }> = {
  danger: { status: "critical", label: "Crítico" },
  warning: { status: "warning", label: "Alto" },
  neutral: { status: "info", label: "Médio" },
  positive: { status: "success", label: "Baixo" },
};

const DEADLINES: Record<string, string> = {
  "review-stock": "Até amanhã",
  "collect-overdue": "Hoje",
  "supplier-order": "Esta semana",
  "reactivation-campaign": "Próximos 7 dias",
};

export function BellaSuggestedTasks() {
  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-primary" aria-hidden="true" /> Tarefas sugeridas
        </span>
      }
      description={`${SUGGESTED_TASKS.length} sugestões`}
    >
      <div data-testid="bella-suggested-tasks" className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SUGGESTED_TASKS.map(({ id, title, description, icon: Icon, tone, meta }) => {
          const priority = TONE_TO_STATUS[tone];
          const token = statusToken(priority.status);
          const deadline = DEADLINES[id] ?? "Sem prazo";
          return (
            <article
              key={id}
              data-testid="bella-task-card"
              className={cn(
                "flex flex-col gap-3 border border-border bg-card p-4 transition-colors hover:border-primary/30",
                RADIUS_TOKENS.xl,
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className={cn("grid h-9 w-9 shrink-0 place-items-center", RADIUS_TOKENS.lg, token.soft)}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={cn("font-medium", TEXT_TOKENS.sm)}>{title}</span>
                    <StatusBadge status="neutral">{meta}</StatusBadge>
                    <StatusBadge status={priority.status} withDot>
                      {priority.label}
                    </StatusBadge>
                  </div>
                  <p className={cn("text-muted-foreground", TEXT_TOKENS.xs)}>{description}</p>
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-3">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 text-muted-foreground",
                    TEXT_TOKENS.xs,
                  )}
                >
                  <Clock className="h-3 w-3" aria-hidden="true" /> {deadline}
                </span>
                <Button size="sm" variant="outline" className="gap-1.5" disabled>
                  <Play className="h-3.5 w-3.5" /> Executar
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
