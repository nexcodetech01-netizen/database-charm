import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  INSIGHTS,
  INSIGHT_PRIORITY_BADGE,
  INSIGHT_PRIORITY_LABEL,
  type Insight,
} from "../data";

const PRIORITY_WEIGHT = { critical: 0, high: 1, medium: 2, low: 3 } as const;

interface PriorityPanelProps {
  insights?: Insight[];
  limit?: number;
}

export function PriorityPanel({ insights = INSIGHTS, limit = 4 }: PriorityPanelProps) {
  const items = [...insights]
    .filter((i) => i.status === "pending")
    .sort((a, b) => PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority])
    .slice(0, limit);

  return (
    <Card className="border-primary/20">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Flame className="h-4 w-4 text-danger" /> Prioridades de hoje
        </CardTitle>
        <span className="text-[11px] text-muted-foreground">
          {items.length} itens priorizados por Bella
        </span>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {items.map((i) => {
          const Icon = i.icon;
          return (
            <div
              key={i.id}
              className="group flex items-start gap-3 rounded-lg border border-border/70 bg-card p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{i.title}</span>
                  <span
                    className={cn(
                      "rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                      INSIGHT_PRIORITY_BADGE[i.priority],
                    )}
                  >
                    {INSIGHT_PRIORITY_LABEL[i.priority]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{i.description}</p>
              </div>
              <Button variant="ghost" size="sm" className="gap-1 self-center" disabled>
                Ver detalhes <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
