import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Clock, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INSIGHT_PRIORITY_BADGE,
  INSIGHT_PRIORITY_LABEL,
  INSIGHT_ORIGIN_LABEL,
  INSIGHT_CATEGORY_LABEL,
  INSIGHT_STATUS_LABEL,
  type Insight,
} from "../data";

interface ActionCardProps {
  insight: Insight;
  onExecute?: (insight: Insight) => void;
  onIgnore?: (insight: Insight) => void;
  onSnooze?: (insight: Insight) => void;
  className?: string;
}

export function ActionCard({
  insight,
  onExecute,
  onIgnore,
  onSnooze,
  className,
}: ActionCardProps) {
  const Icon = insight.icon;
  return (
    <Card className={cn("border-border/70 transition-colors hover:border-primary/30", className)}>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground">{insight.title}</span>
              <span
                className={cn(
                  "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                  INSIGHT_PRIORITY_BADGE[insight.priority],
                )}
              >
                {INSIGHT_PRIORITY_LABEL[insight.priority]}
              </span>
              <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                {INSIGHT_ORIGIN_LABEL[insight.origin]}
              </span>
              <span className="rounded-full border border-border bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                {INSIGHT_CATEGORY_LABEL[insight.category]}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{insight.description}</p>
          </div>
        </div>

        <div className="rounded-md border border-dashed border-border/70 bg-muted/40 p-2.5">
          <div className="flex items-start gap-2">
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <div className="min-w-0 space-y-0.5">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Ação recomendada
              </div>
              <div className="text-xs font-medium text-foreground">
                {insight.recommendedAction.label}
              </div>
              {insight.recommendedAction.hint ? (
                <div className="text-[11px] text-muted-foreground">
                  {insight.recommendedAction.hint}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-2">
          <span className="text-[11px] text-muted-foreground">
            {INSIGHT_STATUS_LABEL[insight.status]} · {insight.date}
          </span>
          <div className="flex flex-wrap gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="gap-1"
              onClick={() => onSnooze?.(insight)}
            >
              <Clock className="h-3.5 w-3.5" /> Adiar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="gap-1"
              onClick={() => onIgnore?.(insight)}
            >
              <X className="h-3.5 w-3.5" /> Ignorar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => onExecute?.(insight)}
            >
              <Play className="h-3.5 w-3.5" /> Executar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
