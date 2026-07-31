import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { AccountingSummary } from "../types";
import { buildExecutiveBrief } from "../lib/brief";

/** Resumo da Bella — texto executivo montado só com dados reais. */
export interface BellaBriefCardProps {
  summary?: AccountingSummary;
  loading?: boolean;
}

export function BellaBriefCard({ summary, loading }: BellaBriefCardProps) {
  const brief = buildExecutiveBrief(summary);

  return (
    <Card className="rounded-2xl border-primary/25 bg-primary/5">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold">Resumo da Bella</p>
        </div>

        {loading ? (
          <div className="space-y-2 pt-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          <div className="space-y-1 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{brief.greeting}</p>
            {brief.empty ? (
              <p>Ainda não há dados suficientes nos motores do NexOS para este período.</p>
            ) : (
              brief.lines.map((line) => <p key={line}>{line}</p>)
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
