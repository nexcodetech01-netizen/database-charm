import { useMemo, useState } from "react";
import {
  Receipt,
  TrendingUp,
  CalendarDays,
  DollarSign,
  Info,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSaleMetrics } from "../hooks/use-sales";

type RangeKey = "today" | "7d" | "month" | "30d";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "month", label: "Mês atual" },
  { value: "30d", label: "Últimos 30 dias" },
];

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function resolveRange(key: RangeKey): { from: string; to: string } {
  const now = new Date();
  const to = toISO(now);
  if (key === "today") return { from: to, to };
  if (key === "7d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: toISO(from), to };
  }
  if (key === "30d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    return { from: toISO(from), to };
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toISO(from), to };
}

const METRIC_TOOLTIP =
  "Considera apenas vendas com status Pago. Vendas em rascunho, pendentes ou canceladas não entram.";

// Metadata visual para status conhecidos. Status novos vindos do banco são
// renderizados com fallback neutro (label capitalizado, dot cinza).
const STATUS_META: Record<
  string,
  { label: string; dot: string; emphasis?: boolean }
> = {
  paid: { label: "Pago", dot: "bg-success", emphasis: true },
  pending: { label: "Pendente", dot: "bg-warning" },
  draft: { label: "Rascunho", dot: "bg-muted-foreground/60" },
  cancelled: { label: "Cancelado", dot: "bg-destructive" },
  refunded: { label: "Estornado", dot: "bg-destructive/70" },
};

// Ordem preferencial para status conhecidos; desconhecidos vão ao final.
const STATUS_ORDER = ["paid", "pending", "draft", "cancelled", "refunded"];

function statusMeta(status: string) {
  const meta = STATUS_META[status];
  if (meta) return meta;
  const label = status
    .split(/[\s_-]+/)
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(" ");
  return { label, dot: "bg-muted-foreground/40" };
}

export function SaleMetrics({ companyId }: { companyId: string }) {
  const [rangeKey, setRangeKey] = useState<RangeKey>("month");
  const range = useMemo(() => resolveRange(rangeKey), [rangeKey]);
  const { data, isLoading } = useSaleMetrics(companyId, range);

  const items = [
    {
      label: "Vendas do dia",
      value: data ? formatCurrency(data.dayTotal) : undefined,
      badge: data ? `${formatNumber(data.dayCount)} pedidos` : undefined,
      icon: CalendarDays,
      iconTone: "bg-primary/10 text-primary ring-primary/15",
    },
    {
      label: "Vendas do mês",
      value: data ? formatCurrency(data.monthTotal) : undefined,
      badge: data ? `${formatNumber(data.monthCount)} pedidos` : undefined,
      icon: Receipt,
      iconTone: "bg-primary/10 text-primary ring-primary/15",
    },
    {
      label: "Ticket médio",
      value: data ? formatCurrency(data.averageTicket) : undefined,
      badge: undefined,
      icon: TrendingUp,
      iconTone: "bg-accent text-accent-foreground ring-border",
    },
    {
      label: "Total faturado",
      value: data ? formatCurrency(data.paidTotal) : undefined,
      badge: undefined,
      icon: DollarSign,
      iconTone: "bg-success/10 text-success ring-success/20",
    },
  ];


  // Breakdown dinâmico vindo da RPC (GROUP BY status no banco).
  const breakdown = data?.breakdown ?? [];
  const orderedBreakdown = useMemo(() => {
    const arr = [...breakdown];
    arr.sort((a, b) => {
      const ai = STATUS_ORDER.indexOf(a.status);
      const bi = STATUS_ORDER.indexOf(b.status);
      if (ai === -1 && bi === -1) return a.status.localeCompare(b.status);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
    return arr;
  }, [breakdown]);

  const grandTotal = breakdown.reduce((s, b) => s + b.total, 0);

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:flex sm:flex-wrap sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Período
            </span>
            <Select
              value={rangeKey}
              onValueChange={(v) => setRangeKey(v as RangeKey)}
            >
              <SelectTrigger className="h-9 w-[180px] rounded-xl text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground sm:col-auto">
            <Info className="h-3.5 w-3.5 shrink-0" />
            <span>Faturamento e contagem consideram apenas vendas pagas.</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <div
                key={it.label}
                className="rounded-2xl border border-border/70 bg-card p-5 transition-shadow hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-muted-foreground">
                      {it.label}
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Como esta métrica é calculada"
                          className="shrink-0 text-muted-foreground/70 transition hover:text-foreground"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[240px] text-xs">
                        {METRIC_TOOLTIP}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ring-1 ${it.iconTone}`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {isLoading ? (
                    <>
                      <Skeleton className="h-8 w-32" />
                      {it.badge !== undefined ? (
                        <Skeleton className="h-5 w-24 rounded-lg" />
                      ) : null}
                    </>
                  ) : (
                    <>
                      <p className="text-[1.75rem] font-semibold leading-none tracking-tight tabular-nums">
                        {it.value ?? "—"}
                      </p>
                      {it.badge ? (
                        <span className="inline-flex items-center rounded-lg bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums">
                          {it.badge}
                        </span>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>


        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold tracking-tight">
              Comparativo por status
            </h3>
            <span className="text-xs text-muted-foreground">
              {RANGE_OPTIONS.find((o) => o.value === rangeKey)?.label ?? "Período"}
            </span>
          </div>

          <div className="divide-y divide-border">
            {isLoading && orderedBreakdown.length === 0 ? (
              <div className="py-6">
                <Skeleton className="h-4 w-full" />
              </div>
            ) : orderedBreakdown.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Nenhuma venda registrada ainda.
              </p>
            ) : (
              orderedBreakdown.map((b) => {
                const meta = statusMeta(b.status);
                const pct =
                  grandTotal > 0 ? Math.round((b.total / grandTotal) * 100) : 0;
                return (
                  <div
                    key={b.status}
                    className="flex items-center justify-between py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                      <span
                        className={
                          meta.emphasis
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                        }
                      >
                        {meta.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 tabular-nums">
                      <span className="text-muted-foreground">
                        {formatNumber(b.count)} vendas
                      </span>
                      <span
                        className={
                          meta.emphasis ? "font-semibold" : "text-foreground"
                        }
                      >
                        {formatCurrency(b.total)}
                      </span>
                      <span className="w-10 text-right text-xs text-muted-foreground">
                        {pct}%
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
