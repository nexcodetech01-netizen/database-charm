import { Card, CardContent } from "@/components/ui/card";
import { Sparkles, PiggyBank, TrendingUp, AlertTriangle, Lightbulb, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeroKpi {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
}

const HERO_KPIS: HeroKpi[] = [
  { key: "savings", label: "Economia estimada", value: "R$ 0,00", icon: PiggyBank, tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { key: "revenue", label: "Receita potencial", value: "R$ 0,00", icon: TrendingUp, tone: "bg-primary/10 text-primary" },
  { key: "alerts", label: "Alertas críticos", value: "0", icon: AlertTriangle, tone: "bg-danger/10 text-danger" },
  { key: "opps", label: "Oportunidades encontradas", value: "0", icon: Lightbulb, tone: "bg-warning/10 text-warning" },
];

export function BellaHero() {
  return (
    <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
      />
      <CardContent className="relative space-y-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Resumo executivo
              </h2>
              <p className="text-sm text-muted-foreground">
                Principais recomendações geradas pela Bella IA.
              </p>
            </div>
          </div>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
            atualizado agora
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HERO_KPIS.map(({ key, label, value, icon: Icon, tone }) => (
            <div
              key={key}
              className="flex items-center gap-3 rounded-xl border border-border/70 bg-card/80 p-3 backdrop-blur"
            >
              <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-lg", tone)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {label}
                </div>
                <div className="truncate text-lg font-semibold tracking-tight">
                  {value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
