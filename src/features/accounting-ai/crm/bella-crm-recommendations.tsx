import { Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BellaCrmActions } from "./bella-crm-actions";
import type { BellaCrmRecommendation } from "./types";

export interface BellaCrmRecommendationsProps {
  recommendations: readonly BellaCrmRecommendation[];
  loading?: boolean;
  className?: string;
}

/** Recomendações de relacionamento — reaproveitam os insights existentes. */
export function BellaCrmRecommendations({
  recommendations,
  loading = false,
  className,
}: BellaCrmRecommendationsProps) {
  return (
    <div className={cn("space-y-2", className)} data-testid="bella-crm-recommendations">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold">Recomendações da Bella</p>
      </div>

      {loading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : recommendations.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma recomendação de clientes no momento.
        </p>
      ) : (
        <ul className="space-y-2">
          {recommendations.map((rec) => (
            <li
              key={rec.id}
              className="space-y-1.5 rounded-xl border border-border/60 p-3"
              data-testid={`bella-crm-recommendation-${rec.id}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold leading-tight">{rec.title}</p>
                <Badge variant="outline" className="rounded-lg font-normal">
                  {rec.category}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{rec.description}</p>
              <p className="text-xs text-muted-foreground">{rec.recommendation}</p>
              <BellaCrmActions size="xs" links={[rec.link]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
