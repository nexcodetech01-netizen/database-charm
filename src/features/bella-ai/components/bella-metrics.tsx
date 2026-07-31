import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Bell, Sparkles, ListChecks } from "lucide-react";
import type { BellaDashboardMetrics } from "../types";

interface Props {
  metrics: BellaDashboardMetrics | undefined;
  isLoading?: boolean;
}

const cards = [
  { key: "insightsAvailable", label: "Insights disponíveis", icon: Lightbulb, tone: "text-primary" },
  { key: "activeAlerts", label: "Alertas", icon: Bell, tone: "text-warning" },
  { key: "pendingRecommendations", label: "Recomendações", icon: Sparkles, tone: "text-primary" },
  { key: "suggestedTasks", label: "Tarefas sugeridas", icon: ListChecks, tone: "text-success" },
] as const;

export function BellaMetrics({ metrics, isLoading }: Props) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ key, label, icon: Icon, tone }) => (
        <Card key={key} className="border-border/70">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
            <Icon className={`h-4 w-4 ${tone}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight">
              {isLoading ? "—" : (metrics?.[key] ?? 0)}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Atualizado em tempo real</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
