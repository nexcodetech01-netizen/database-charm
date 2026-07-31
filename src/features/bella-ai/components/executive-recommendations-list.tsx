import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type {
  ExecutiveRecommendation,
  RecommendationPriority,
} from "../intelligence/types";

const PRIORITY_META: Record<
  RecommendationPriority,
  { label: string; className: string }
> = {
  high:   { label: "Alta",  className: "bg-danger/10 text-danger" },
  medium: { label: "Média", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  low:    { label: "Baixa", className: "bg-muted text-muted-foreground" },
};

interface Props {
  recommendations: readonly ExecutiveRecommendation[] | undefined;
  loading?: boolean;
  emptyLabel?: string;
}

export function ExecutiveRecommendationsList({
  recommendations,
  loading,
  emptyLabel = "Nenhuma ação recomendada agora — bom trabalho!",
}: Props) {
  if (loading) {
    return (
      <ul className="space-y-2">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-16 animate-pulse rounded-md bg-muted/50" />
        ))}
      </ul>
    );
  }
  if (!recommendations || recommendations.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {recommendations.map((r) => {
        const meta = PRIORITY_META[r.priority];
        const content = (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className={cn("h-5 rounded-md px-1.5 text-[10px]", meta.className)}>
                  {meta.label}
                </Badge>
                <p className="truncate text-sm font-medium text-foreground">
                  {r.title}
                </p>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{r.reason}</p>
              <p className="mt-1 text-xs text-foreground/80">
                <span className="font-medium">Sugestão: </span>
                {r.suggestedAction}
              </p>
            </div>
            {r.targetRoute && (
              <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            )}
          </div>
        );
        return (
          <li
            key={r.id}
            className="rounded-md border border-border/70 bg-card p-2.5 transition hover:border-border hover:shadow-sm"
          >
            {r.targetRoute ? (
              <Link to={r.targetRoute} className="block">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}
