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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
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

        {receivables.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              A receber · vencidos e próximos 7 dias
            </p>
            <ul className="divide-y rounded-md border text-sm">
              {receivables.map((r, idx) => {
                const canRemind = !!r.person && !!paymentReminderLink(r.phone, "x");
                const done = reminded.has(idx);
                return (
                  <li key={idx} className="flex items-center justify-between gap-2 px-3 py-1.5">
                    <span className="min-w-0 truncate">
                      <span className="font-medium">{r.person ?? "Sem cliente"}</span>
                      <span className="text-muted-foreground"> · {r.label} · </span>
                      <span
                        className={cn(
                          r.bucket === "overdue" && "text-destructive",
                          r.bucket === "today" && "text-amber-600",
                          r.bucket === "next7" && "text-muted-foreground",
                        )}
                      >
                        {dueText(r)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          "font-semibold tabular-nums",
                          r.bucket === "overdue" && "text-destructive",
                        )}
                      >
                        {formatCurrency(Number(r.amount))}
                      </span>
                      {r.person ? (
                        <Button
                          size="sm"
                          variant={done ? "ghost" : "outline"}
                          className="h-7 px-2 text-xs"
                          disabled={!canRemind}
                          title={
                            canRemind
                              ? "Abrir o WhatsApp com o lembrete pronto"
                              : "Cliente sem WhatsApp cadastrado"
                          }
                          onClick={() => remind(idx)}
                        >
                          {done ? (
                            <Check className="mr-1 h-3.5 w-3.5" />
                          ) : (
                            <MessageCircle className="mr-1 h-3.5 w-3.5" />
                          )}
                          {done ? "Enviado" : "Lembrar"}
                        </Button>
                      ) : null}
                    </span>
                  </li>
                );
              })}
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

        {!hasAnythingDue(data) ? (
          <p className="text-sm text-muted-foreground">Nada vencido, de hoje ou dos próximos 7 dias.</p>
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
