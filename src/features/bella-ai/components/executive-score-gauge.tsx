import { cn } from "@/lib/utils";
import type { ExecutiveScore, ScoreBand } from "../intelligence/types";

interface Props {
  score: ExecutiveScore | undefined;
  loading?: boolean;
  className?: string;
}

const BAND_META: Record<ScoreBand, { label: string; tone: string; ring: string }> = {
  excelente: {
    label: "Excelente",
    tone: "text-emerald-600 dark:text-emerald-400",
    ring: "ring-emerald-500/30 bg-emerald-500/10",
  },
  bom: {
    label: "Bom",
    tone: "text-primary",
    ring: "ring-primary/30 bg-primary/10",
  },
  atencao: {
    label: "Atenção",
    tone: "text-amber-600 dark:text-amber-400",
    ring: "ring-amber-500/30 bg-amber-500/10",
  },
  critico: {
    label: "Crítico",
    tone: "text-danger",
    ring: "ring-danger/30 bg-danger/10",
  },
};

export function ExecutiveScoreGauge({ score, loading, className }: Props) {
  const value = score?.score ?? 0;
  const band = score?.band ?? "atencao";
  const meta = BAND_META[band];

  return (
    <div className={cn("flex items-center gap-4", className)}>
      <div
        className={cn(
          "grid h-20 w-20 shrink-0 place-items-center rounded-full ring-2 ring-inset",
          meta.ring,
        )}
        aria-label={`Score executivo ${value}`}
      >
        <div className="text-center">
          <div className={cn("text-2xl font-bold leading-none", meta.tone)}>
            {loading ? "…" : value}
          </div>
          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            /100
          </div>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Saúde da empresa
        </div>
        <div className={cn("text-lg font-semibold tracking-tight", meta.tone)}>
          {meta.label}
        </div>
        {score && (
          <div className="mt-1 grid grid-cols-4 gap-2 text-[10px] text-muted-foreground">
            <span>Vendas <strong className="text-foreground">{score.breakdown.sales}</strong></span>
            <span>Financeiro <strong className="text-foreground">{score.breakdown.finance}</strong></span>
            <span>Estoque <strong className="text-foreground">{score.breakdown.stock}</strong></span>
            <span>Clientes <strong className="text-foreground">{score.breakdown.customers}</strong></span>
          </div>
        )}
      </div>
    </div>
  );
}
