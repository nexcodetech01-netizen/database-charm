import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type Bucket = "overdue" | "today" | "next7";
interface Cell {
  total: number;
  count: number;
}
interface DailySummary {
  today: string;
  cells: Partial<Record<`${"income" | "expense"}_${Bucket}`, Cell>>;
  overdue_receivables: { label: string; person: string | null; due: string | null; days_late: number; amount: number }[];
  payables_due: { label: string; due: string | null; days_late: number; amount: number }[];
}

const STORAGE_PREFIX = "nexos:daily-finance-summary:";
const BUCKETS: { key: Bucket; label: string }[] = [
  { key: "overdue", label: "Vencido" },
  { key: "today", label: "Hoje" },
  { key: "next7", label: "Próx. 7 dias" },
];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function alreadyShownToday(companyId: string): boolean {
  try {
    return localStorage.getItem(STORAGE_PREFIX + companyId) === todayKey();
  } catch {
    return false;
  }
}

function markShown(companyId: string) {
  try {
    localStorage.setItem(STORAGE_PREFIX + companyId, todayKey());
  } catch {
    /* navegador sem armazenamento: pode mostrar de novo */
  }
}

/** true se há alguma conta vencida, de hoje ou dos próximos 7 dias. */
export function hasAnythingDue(summary: Pick<DailySummary, "cells"> | null | undefined): boolean {
  return Object.values(summary?.cells ?? {}).some((c) => (c?.count ?? 0) > 0);
}

/**
 * Resumo financeiro do dia: janela ao abrir o app, uma vez por dia.
 * A receber × A pagar em Vencido / Hoje / Próximos 7 dias, e as listas do
 * que pede ação. Não aparece se não houver nada vencendo.
 */
export function DailyFinanceSummaryDialog({ companyId }: { companyId: string }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const shouldCheck = !!companyId && !alreadyShownToday(companyId);

  const { data } = useQuery({
    queryKey: ["finance", "daily-summary", companyId],
    enabled: shouldCheck,
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<DailySummary | null> => {
      const { data, error } = await (supabase.rpc as any)("daily_finance_summary", {
        _company_id: companyId,
      });
      if (error) return null; // função ainda não criada ou sem acesso: não mostra
      return data as DailySummary;
    },
  });

  useEffect(() => {
    if (shouldCheck && data && hasAnythingDue(data)) setOpen(true);
  }, [shouldCheck, data]);

  function close() {
    markShown(companyId);
    setOpen(false);
  }

  function goTo(tab: "receivables" | "payables") {
    close();
    void navigate({ to: "/financeiro", search: { tab } as never });
  }

  if (!data) return null;

  const cell = (kind: "income" | "expense", b: Bucket) => data.cells[`${kind}_${b}`];
  const dateLabel = new Date(`${data.today}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5" /> Resumo financeiro · {dateLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-3 py-2 text-left font-medium" />
                {BUCKETS.map((b) => (
                  <th key={b.key} className="px-3 py-2 text-right font-medium">
                    {b.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["income", "A receber", "receivables"],
                  ["expense", "A pagar", "payables"],
                ] as const
              ).map(([kind, label, tab]) => (
                <tr
                  key={kind}
                  className="cursor-pointer border-b last:border-0 hover:bg-muted/30"
                  onClick={() => goTo(tab)}
                  title="Abrir no Financeiro"
                >
                  <td className="px-3 py-2 font-medium">{label}</td>
                  {BUCKETS.map((b) => {
                    const c = cell(kind, b.key);
                    const has = (c?.count ?? 0) > 0;
                    return (
                      <td
                        key={b.key}
                        className={cn(
                          "px-3 py-2 text-right tabular-nums",
                          !has && "text-muted-foreground",
                          has && b.key === "overdue" && "font-semibold text-destructive",
                          has && b.key === "today" && "font-semibold text-amber-600",
                        )}
                      >
                        {formatCurrency(c?.total ?? 0)}
                        {has ? <span className="ml-1 text-xs font-normal">({c!.count})</span> : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data.overdue_receivables.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Vencidos a receber
            </p>
            <ul className="divide-y rounded-md border text-sm">
              {data.overdue_receivables.map((r, idx) => (
                <li key={idx} className="flex items-center justify-between gap-3 px-3 py-1.5">
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{r.person ?? "Sem cliente"}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {r.label} · {r.days_late} dia{r.days_late === 1 ? "" : "s"}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums text-destructive">
                    {formatCurrency(Number(r.amount))}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {data.payables_due.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              A pagar (vencido ou hoje)
            </p>
            <ul className="divide-y rounded-md border text-sm">
              {data.payables_due.map((p, idx) => (
                <li key={idx} className="flex items-center justify-between gap-3 px-3 py-1.5">
                  <span className="min-w-0 truncate">
                    {p.label}
                    <span className="text-muted-foreground">
                      {" "}
                      · {p.days_late > 0 ? `venceu há ${p.days_late} dia${p.days_late === 1 ? "" : "s"}` : "vence hoje"}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatCurrency(Number(p.amount))}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => goTo("receivables")}>
            Abrir Financeiro
          </Button>
          <Button onClick={close}>Ok, entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
