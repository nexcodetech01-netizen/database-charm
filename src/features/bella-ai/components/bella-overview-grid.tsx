import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  OVERVIEW_SIGNALS,
  SIGNAL_GROUP_META,
  type OverviewSignal,
  type OverviewSignalTone,
  type SignalGroup,
} from "../workspace/data";

const TONE_MAP: Record<OverviewSignalTone, { icon: string }> = {
  neutral: { icon: "bg-primary/10 text-primary" },
  positive: { icon: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  warning: { icon: "bg-warning/10 text-warning" },
  danger: { icon: "bg-danger/10 text-danger" },
};

const GROUP_ORDER: SignalGroup[] = ["critical", "attention", "opportunity"];

export function BellaOverviewGrid() {
  const grouped = GROUP_ORDER.map((group) => ({
    group,
    items: OVERVIEW_SIGNALS.filter((s) => s.group === group),
  }));

  return (
    <div className="space-y-6">
      {grouped.map(({ group, items }) => {
        const meta = SIGNAL_GROUP_META[group];
        return (
          <section key={group} className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={cn("h-2 w-2 rounded-full", meta.accent)} />
              <div className="flex items-baseline gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    meta.badge,
                  )}
                >
                  {meta.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {meta.description}
                </span>
              </div>
              <span className="ml-auto text-[11px] text-muted-foreground">
                {items.length} sinal(is)
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((s) => (
                <SignalCard key={s.key} signal={s} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SignalCard({ signal }: { signal: OverviewSignal }) {
  const { icon: Icon, title, description, tone, hint } = signal;
  const t = TONE_MAP[tone];
  return (
    <Card className="border-border/70">
      <CardContent className="space-y-3 p-4">
        <div className={cn("grid h-9 w-9 place-items-center rounded-lg", t.icon)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <div className="text-sm font-medium text-foreground">{title}</div>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <p className="text-[11px] text-muted-foreground/80">{hint}</p>
      </CardContent>
    </Card>
  );
}
