import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { CalendarClock, Check, MessageCircle } from "lucide-react";
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
import { buildPaymentReminder, paymentReminderLink } from "@/features/finance/lib/payment-reminder";

type Bucket = "overdue" | "today" | "next7";
interface Cell {
  total: number;
  count: number;
}
interface DailySummary {
  today: string;
  cells: Partial<Record<`${"income" | "expense"}_${Bucket}`, Cell>>;
  store?: { name: string | null; pix_key: string | null } | null;
  overdue_receivables: { label: string; person: string | null; due: string | null; days_late: number; amount: number }[];
  /** vencidos, de hoje e dos próximos 7 dias (com WhatsApp do cliente) */
  receivables_due?: {
    label: string;
    person: string | null;
    phone: string | null;
    due: string | null;
    days_late: number;
    bucket: Bucket;
    amount: number;
  }[];
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

function useDailySummary(companyId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["finance", "daily-summary", companyId],
    enabled: !!companyId && enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<DailySummary | null> => {
      const { data, error } = await (supabase.rpc as any)("daily_finance_summary", {
        _company_id: companyId,
      });
      if (error) return null; // função ainda não criada ou sem acesso: não mostra
      return data as DailySummary;
    },
  });
}

function dueText(r: { due: string | null; days_late: number }): string {
  if (r.days_late > 0) return `${r.days_late} dia${r.days_late === 1 ? "" : "s"} de atraso`;
  if (r.days_late === 0) return "vence hoje";
  if (!r.due) return "";
  const [, m, d] = r.due.split("-");
  return `vence ${d}/${m}`;
}

/**
 * Resumo financeiro do dia: janela ao abrir o app, uma vez por dia.
 * A receber × A pagar em Vencido / Hoje / Próximos 7 dias, e as listas do
 * que pede ação. Não aparece se não houver nada vencendo.
 */
export function DailyFinanceSummaryDialog({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const [shouldCheck] = useState(() => !!companyId && !alreadyShownToday(companyId));
  const { data } = useDailySummary(companyId, shouldCheck);

  useEffect(() => {
    if (shouldCheck && data && hasAnythingDue(data)) setOpen(true);
  }, [shouldCheck, data]);

  function close() {
    markShown(companyId);
    setOpen(false);
  }

  if (!data) return null;
  return <SummaryDialog data={data} open={open} onClose={close} />;
}

/** Botão "Resumo do dia" — abre o mesmo resumo quando quiser. */
export function DailyFinanceSummaryButton({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false);
  const { data, isFetching, refetch } = useDailySummary(companyId, open);

  return (
    <>
      <Button
        size="sm"
        variant="ghost"
        disabled={open && isFetching && !data}
        onClick={() => {
          setOpen(true);
          void refetch();
        }}
      >
        <CalendarClock className="mr-1.5 h-4 w-4" /> Resumo do dia
      </Button>
      {data ? <SummaryDialog data={data} open={open} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function SummaryDialog({
  data,
  open,
  onClose,
}: {
  data: DailySummary;
  open: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const [reminded, setReminded] = useState<Set<number>>(() => new Set());

  function goTo(tab: "receivables" | "payables") {
    onClose();
    void navigate({ to: "/financeiro", search: { tab } as never });
  }

  const receivables =
    data.receivables_due ??
    data.overdue_receivables.map((r) => ({ ...r, phone: null, bucket: "overdue" as Bucket }));

  function remind(idx: number) {
    const r = receivables[idx];
    const message = buildPaymentReminder({
      customerName: r.person,
      storeName: data.store?.name,
      pixKey: data.store?.pix_key,
      amount: Number(r.amount),
      due: r.due,
      daysLate: r.days_late,
    });
    const link = paymentReminderLink(r.phone, message);
    if (!link) return;
    window.open(link, "_blank", "noopener,noreferrer");
    setReminded((prev) => new Set(prev).add(idx));
  }

  const cell = (kind: "income" | "expense", b: Bucket) => data.cells[`${kind}_${b}`];
  const dateLabel = new Date(`${data.today}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent className="max-h-[90vh] w-[calc(100vw-1rem)] grid-cols-1 gap-5 overflow-y-auto overflow-x-hidden p-4 sm:w-full sm:max-w-xl sm:p-6 [&>*]:min-w-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <CalendarClock className="h-5 w-5 shrink-0" /> Resumo financeiro · {dateLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="overflow-hidden rounded-lg border">
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="w-[24%] px-3 py-2 text-left font-medium" />
                {BUCKETS.map((b) => (
                  <th key={b.key} className="px-2 py-2 text-right font-medium sm:px-3">
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
                  <td className="px-3 py-2.5 text-[13px] font-medium sm:text-sm">{label}</td>
                  {BUCKETS.map((b) => {
                    const c = cell(kind, b.key);
                    const has = (c?.count ?? 0) > 0;
                    return (
                      <td
                        key={b.key}
                        className={cn(
                          "px-2 py-2.5 text-right text-[13px] tabular-nums sm:px-3 sm:text-sm",
                          !has && "text-muted-foreground/70",
                          has && "font-semibold",
                          has && b.key === "overdue" && "text-destructive",
                          has && b.key === "today" && "text-amber-600",
                        )}
                      >
                        <div className="truncate">{formatCurrency(c?.total ?? 0)}</div>
                        {has ? (
                          <div className="text-[11px] font-normal text-muted-foreground">
                            {c?.count} {c?.count === 1 ? "conta" : "contas"}
                          </div>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {receivables.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              A receber · vencidos e próximos 7 dias
            </h3>
            <ul className="divide-y overflow-hidden rounded-lg border">
              {receivables.map((r, idx) => {
                const canRemind = !!r.person && !!paymentReminderLink(r.phone, "x");
                const done = reminded.has(idx);
                return (
                  <li key={idx} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.person ?? "Sem cliente"}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.label}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          r.bucket === "overdue" && "text-destructive",
                        )}
                      >
                        {formatCurrency(Number(r.amount))}
                      </p>
                      <p
                        className={cn(
                          "text-xs",
                          r.bucket === "overdue" && "text-destructive",
                          r.bucket === "today" && "font-medium text-amber-600",
                          r.bucket === "next7" && "text-muted-foreground",
                        )}
                      >
                        {dueText(r)}
                      </p>
                    </div>
                    {r.person ? (
                      <Button
                        size="icon"
                        variant={done ? "ghost" : "outline"}
                        className={cn("h-8 w-8 shrink-0", done && "text-emerald-600")}
                        disabled={!canRemind}
                        aria-label={done ? "Lembrete enviado" : "Enviar lembrete pelo WhatsApp"}
                        title={
                          !canRemind
                            ? "Cliente sem WhatsApp cadastrado"
                            : done
                              ? "Lembrete enviado — clique para abrir de novo"
                              : "Enviar lembrete pelo WhatsApp"
                        }
                        onClick={() => remind(idx)}
                      >
                        {done ? <Check className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
                      </Button>
                    ) : (
                      <span className="w-8 shrink-0" />
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {data.payables_due.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              A pagar · vencido ou hoje
            </h3>
            <ul className="divide-y overflow-hidden rounded-lg border">
              {data.payables_due.map((p, idx) => (
                <li key={idx} className="flex items-center gap-3 px-3 py-2.5">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium">{p.label}</p>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCurrency(Number(p.amount))}
                    </p>
                    <p
                      className={cn(
                        "text-xs",
                        p.days_late > 0 ? "text-destructive" : "font-medium text-amber-600",
                      )}
                    >
                      {p.days_late > 0
                        ? `venceu há ${p.days_late} dia${p.days_late === 1 ? "" : "s"}`
                        : "vence hoje"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {!hasAnythingDue(data) ? (
          <p className="text-sm text-muted-foreground">
            Nada vencido, de hoje ou dos próximos 7 dias.
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => goTo("receivables")}>
            Abrir Financeiro
          </Button>
          <Button onClick={onClose}>Ok, entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
