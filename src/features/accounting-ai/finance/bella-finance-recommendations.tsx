import { Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BellaFinanceActions } from "./bella-finance-actions";
import type { BellaFinanceRecommendation } from "./types";

export interface BellaFinanceRecommendationsProps {
  recommendations: readonly BellaFinanceRecommendation[];
  loading?: boolean;
  className?: string;
}

/** Top recomendações financeiras — reaproveita o Insight Engine existente. */
export function BellaFinanceRecommendations({
  recommendations,
  loading = false,
  className,
}: BellaFinanceRecommendationsProps) {
  return (
    <div className={cn("space-y-2", className)} data-testid="bella-finance-recommendations">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold">Recomendações da Bella</p>
      </div>

      {loading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : recommendations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Sem recomendações financeiras para este período.
        </p>
      ) : (
        <ul className="space-y-2">
          {recommendations.map((item) => (
            <li
              key={item.id}
              className="space-y-1.5 rounded-xl border border-border/60 p-3"
              data-testid={`bella-finance-recommendation-${item.id}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold leading-tight">{item.title}</p>
                <Badge variant="secondary" className="rounded-lg font-normal">
                  {item.priority}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{item.description}</p>
              <p className="text-xs text-muted-foreground">{item.recommendation}</p>
              <BellaFinanceActions size="xs" links={[item.link]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
