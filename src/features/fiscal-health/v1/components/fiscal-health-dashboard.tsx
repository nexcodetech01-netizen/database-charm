import { AlertCircle, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useFiscalHealth, useFiscalHealthHistory, useRecordFiscalHealthSnapshot } from "../hooks/use-fiscal-health";
import { FiscalHealthStatusBadge, healthBarColor } from "./fiscal-health-status-badge";

function fmtBRL(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function KpiTile({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-5">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function FiscalHealthDashboard() {
  const { data, isLoading, error } = useFiscalHealth();
  const history = useFiscalHealthHistory();
  const snapshot = useRecordFiscalHealthSnapshot();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground">
        Não foi possível carregar a saúde fiscal. {error instanceof Error ? error.message : ""}
      </div>
    );
  }

  const pct = data.percentUsed ?? 0;
  const barPct = Math.min(100, Math.max(0, pct));

  return (
    <div className="space-y-6">
      {/* Painel principal — status geral + barra */}
      <div className="rounded-2xl border border-border/60 bg-card p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Regime tributário</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{data.regimeLabel}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Exercício iniciado em {new Date(data.fiscalYearStart + "T00:00:00").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
              {" · "}mês {data.monthsElapsed} de 12
            </p>
          </div>
          <div className="flex items-center gap-2">
            <FiscalHealthStatusBadge status={data.status} />
            <Button
              variant="outline" size="sm"
              onClick={() => snapshot.mutate()}
              disabled={snapshot.isPending}
            >
              {snapshot.isPending ? "Salvando…" : "Salvar snapshot"}
            </Button>
          </div>
        </div>

        {data.hasAnnualLimit && data.annualLimit ? (
          <div className="space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">
                {fmtBRL(data.ytdRevenue)} de {fmtBRL(data.annualLimit)}
              </span>
              <span className="text-lg font-semibold tracking-tight tabular-nums">{fmtPct(data.percentUsed)}</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", healthBarColor(data.status))}
                style={{ width: `${barPct}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-muted/30 border border-border/60 p-3 text-sm text-muted-foreground">
            Este regime não possui teto de faturamento obrigatório. Configure um limite personalizado para acompanhar sua meta anual.
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile label="Faturamento acumulado" value={fmtBRL(data.ytdRevenue)} />
        <KpiTile
          label="Restante disponível"
          value={data.remaining != null ? fmtBRL(data.remaining) : "—"}
          hint={data.hasAnnualLimit ? "Até o teto anual" : "Sem teto"}
        />
        <KpiTile label="Média mensal" value={fmtBRL(data.monthlyAverage)} hint={`Em ${data.monthsElapsed} meses`} />
        <KpiTile
          label="Projeção até dezembro"
          value={fmtBRL(data.projectionYearEnd)}
          hint={data.projectedBreachMonthLabel ? `Limite em ${data.projectedBreachMonthLabel}` : "Ritmo atual"}
        />
      </div>

      {/* Bella CFO */}
      {data.advisorMessages.length > 0 ? (
        <div className="rounded-2xl border border-border/60 bg-card p-6">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-base font-semibold tracking-tight">Bella CFO</h3>
          </div>
          <ul className="space-y-2">
            {data.advisorMessages.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                {i === 0 && (data.status === "red" || data.status === "orange") ? (
                  <AlertCircle className="h-4 w-4 mt-0.5 text-rose-500 shrink-0" />
                ) : (
                  <TrendingUp className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                )}
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Faturamento mensal */}
      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Faturamento mensal</h3>
            <p className="text-sm text-muted-foreground">Evolução no exercício em curso.</p>
          </div>
        </div>
        <MonthlyBars series={data.monthlySeries} average={data.monthlyAverage} />
      </div>

      {/* Histórico snapshots */}
      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Histórico</h3>
            <p className="text-sm text-muted-foreground">Snapshots mensais salvos.</p>
          </div>
        </div>
        {history.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (history.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum snapshot salvo ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-medium">Mês</th>
                  <th className="py-2 pr-4 font-medium">Regime</th>
                  <th className="py-2 pr-4 font-medium text-right">Faturamento</th>
                  <th className="py-2 pr-4 font-medium text-right">% Usado</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.data!.map((h) => (
                  <tr key={h.id} className="border-t border-border/60">
                    <td className="py-2 pr-4">{new Date(h.snapshotMonth + "T00:00:00").toLocaleDateString("pt-BR", { month: "short", year: "numeric" })}</td>
                    <td className="py-2 pr-4 capitalize">{h.taxRegime}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{fmtBRL(h.ytdRevenue)}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{fmtPct(h.percentUsed)}</td>
                    <td className="py-2 pr-4"><FiscalHealthStatusBadge status={h.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MonthlyBars({ series, average }: { series: Array<{ month: string; revenue: number }>; average: number }) {
  if (series.length === 0) return <p className="text-sm text-muted-foreground">Sem dados no exercício.</p>;
  const max = Math.max(average, ...series.map((s) => s.revenue), 1);
  return (
    <div>
      <div className="flex items-end gap-2 h-40">
        {series.map((s) => {
          const h = Math.max(2, (s.revenue / max) * 100);
          return (
            <div key={s.month} className="flex-1 flex flex-col items-center justify-end">
              <div
                className="w-full bg-primary/80 rounded-sm hover:bg-primary transition-colors"
                style={{ height: `${h}%` }}
                title={s.revenue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2 text-[10px] uppercase text-muted-foreground">
        {series.map((s) => (
          <div key={s.month} className="flex-1 text-center">{s.month.slice(5)}</div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Linha de projeção mensal: {average.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
      </p>
    </div>
  );
}
