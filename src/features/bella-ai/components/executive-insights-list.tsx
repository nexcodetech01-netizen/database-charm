import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, AlertTriangle, Info } from "lucide-react";
import type { ExecutiveInsight, InsightTone } from "../intelligence/types";

const TONE_META: Record<InsightTone, { icon: typeof Info; tone: string }> = {
  positive: { icon: TrendingUp, tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10" },
  negative: { icon: TrendingDown, tone: "text-danger bg-danger/10" },
  warning:  { icon: AlertTriangle, tone: "text-amber-600 dark:text-amber-400 bg-amber-500/10" },
  neutral:  { icon: Info, tone: "text-muted-foreground bg-muted" },
};

interface Props {
  insights: readonly ExecutiveInsight[] | undefined;
  loading?: boolean;
}

export function ExecutiveInsightsList({ insights, loading }: Props) {
  if (loading) {
    return (
      <ul className="space-y-2">
        {[0, 1, 2].map((i) => (
          <li key={i} className="h-9 animate-pulse rounded-md bg-muted/50" />
        ))}
      </ul>
    );
  }
  if (!insights || insights.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Sem insights relevantes no momento.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {insights.map((i) => {
        const meta = TONE_META[i.tone];
        const Icon = meta.icon;
        return (
          <li
            key={i.id}
            className="flex items-start gap-2 rounded-md border border-border/70 bg-card px-2.5 py-2"
          >
            <div className={cn("grid h-6 w-6 shrink-0 place-items-center rounded-md", meta.tone)}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <p className="text-sm leading-snug text-foreground">{i.message}</p>
          </li>
        );
      })}
    </ul>
  );
}
