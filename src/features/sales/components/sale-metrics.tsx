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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSaleMetrics } from "../hooks/use-sales";

const METRIC_TOOLTIP =
  "Considera apenas vendas com status Pago. Vendas em rascunho, pendentes ou canceladas não entram.";

export function SaleMetrics({ 
  companyId, 
  range 
}: { 
  companyId: string;
  range: { from: string; to: string };
}) {
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
      label: "Faturamento",
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
      label: "A Receber",
      value: data ? formatCurrency(data.paidTotal) : undefined,
      badge: undefined,
      icon: DollarSign,
      iconTone: "bg-success/10 text-success ring-success/20",
    },
  ];

  return (
    <TooltipProvider delayDuration={150}>
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
    </TooltipProvider>
  );
}
