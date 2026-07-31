import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/layout/empty-state";
import { Button } from "@/components/ui/button";
import { Lightbulb, Sparkles } from "lucide-react";
import {
  INSIGHTS_MOCK,
  INSIGHT_PRIORITY_LABELS,
  INSIGHT_PRIORITY_TONE,
  INSIGHT_ORIGIN_LABELS,
} from "../workspace/data";
import { cn } from "@/lib/utils";

export function BellaInsightsGrid() {
  if (INSIGHTS_MOCK.length === 0) {
    return (
      <EmptyState
        icon={Lightbulb}
        title="Nenhum insight gerado ainda"
        description="Quando Bella IA estiver conectada, os insights sobre estoque, vendas, clientes e financeiro aparecerão aqui."
      />
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {INSIGHTS_MOCK.map((i) => (
        <Card key={i.id} className="border-border/70">
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span
                className={cn(
                  "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                  INSIGHT_PRIORITY_TONE[i.priority],
                )}
              >
                {INSIGHT_PRIORITY_LABELS[i.priority]}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {INSIGHT_ORIGIN_LABELS[i.origin]} · {i.generatedAt}
              </span>
            </div>
            <div>
              <div className="text-sm font-semibold text-foreground">{i.title}</div>
              <p className="mt-1 text-xs text-muted-foreground">{i.description}</p>
            </div>
            <div className="flex items-center justify-between border-t border-border/60 pt-3">
              <span className="text-[11px] text-muted-foreground">Ação sugerida</span>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                {i.suggestedAction}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
