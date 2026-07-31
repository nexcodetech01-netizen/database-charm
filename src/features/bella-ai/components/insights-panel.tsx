import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";
import { INSIGHTS, type Insight } from "../data";
import { ActionCard } from "./action-card";

interface InsightsPanelProps {
  insights?: Insight[];
}

export function InsightsPanel({ insights = INSIGHTS }: InsightsPanelProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-primary" /> Insights
        </CardTitle>
        <span className="text-[11px] text-muted-foreground">
          {insights.length} insights ativos
        </span>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {insights.map((i) => (
          <ActionCard key={i.id} insight={i} />
        ))}
      </CardContent>
    </Card>
  );
}
