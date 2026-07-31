import { EmptyState } from "@/components/layout/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { History } from "lucide-react";
import { HISTORY_MOCK } from "../workspace/data";

export function BellaHistoryTimeline() {
  if (HISTORY_MOCK.length === 0) {
    return (
      <EmptyState
        icon={History}
        title="Sem histórico ainda"
        description="Todas as perguntas, respostas e tokens consumidos aparecerão aqui quando Bella IA estiver ativa."
      />
    );
  }
  return (
    <div className="space-y-3">
      {HISTORY_MOCK.map((h) => (
        <Card key={h.id} className="border-border/70">
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>
                {h.user} · {h.origin}
              </span>
              <span>
                {h.time} · {h.tokens} tokens
              </span>
            </div>
            <div className="text-sm font-medium">{h.question}</div>
            <p className="text-xs text-muted-foreground">{h.answer}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
