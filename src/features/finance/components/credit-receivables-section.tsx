import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HandCoins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ReceivePaymentDialog } from "@/features/credit/components/receive-payment-dialog";
import {
  PaymentReceiptDialog,
  type PaymentReceiptInfo,
} from "@/features/sales/components/payment-receipt-dialog";

interface OpenInstallment {
  id: string;
  sequence: number;
  remaining: number;
  dueDate: string | null;
  accountId: string;
  accountBalance: number;
  saleId: string;
  saleNumber: string;
  customerId: string | null;
  customerName: string;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
const ddmm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "sem data");

async function loadOpenInstallments(companyId: string): Promise<OpenInstallment[]> {
  const { data: inst, error } = await supabase
    .from("credit_installments")
    .select("id, sequence, amount, paid_amount, due_date, credit_account_id")
    .eq("company_id", companyId)
    .in("status", ["pending", "partially_paid"])
    .order("due_date", { ascending: true, nullsFirst: true });
  if (error) throw error;
  const accountIds = Array.from(new Set((inst ?? []).map((i) => i.credit_account_id as string)));
  if (accountIds.length === 0) return [];

  const { data: accounts } = await supabase
    .from("credit_accounts")
    .select("id, balance, status, sale_id, customer_id")
    .in("id", accountIds)
    .not("status", "in", "(cancelled,settled)");
  const accById = new Map((accounts ?? []).map((a) => [a.id as string, a]));
  const saleIds = Array.from(new Set((accounts ?? []).map((a) => a.sale_id as string)));
  const customerIds = Array.from(
    new Set((accounts ?? []).map((a) => a.customer_id as string | null).filter((v): v is string => !!v)),
  );
  const [{ data: sales }, { data: customers }] = await Promise.all([
    saleIds.length ? supabase.from("sales").select("id, number").in("id", saleIds) : Promise.resolve({ data: [] }),
    customerIds.length
      ? supabase.from("customers").select("id, name").in("id", customerIds)
      : Promise.resolve({ data: [] }),
  ]);
  const saleNumber = new Map(((sales ?? []) as any[]).map((s) => [s.id, s.number as string]));
  const customerName = new Map(((customers ?? []) as any[]).map((c) => [c.id, c.name as string]));

  return (inst ?? [])
    .map((i) => {
      const acc = accById.get(i.credit_account_id as string);
      if (!acc) return null;
      return {
        id: i.id as string,
        sequence: Number(i.sequence),
        remaining: Math.max(0, Number(i.amount ?? 0) - Number(i.paid_amount ?? 0)),
        dueDate: (i.due_date as string | null) ?? null,
        accountId: acc.id as string,
        accountBalance: Number(acc.balance ?? 0),
        saleId: acc.sale_id as string,
        saleNumber: saleNumber.get(acc.sale_id) ?? "",
        customerId: (acc.customer_id as string | null) ?? null,
        customerName: customerName.get(acc.customer_id) ?? "Cliente",
      } satisfies OpenInstallment;
    })
    .filter((v): v is OpenInstallment => !!v && v.remaining > 0.009);
}

/**
 * Parcelas do crediário em aberto, dentro de "A receber" do Financeiro.
 * Antes o crediário não aparecia aqui (ficava só na conta de cada cliente).
 */
export function CreditReceivablesSection({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [receiving, setReceiving] = useState<OpenInstallment | null>(null);
  const [receipt, setReceipt] = useState<PaymentReceiptInfo | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["finance", "credit-receivables", companyId],
    enabled: !!companyId,
    queryFn: () => loadOpenInstallments(companyId),
  });

  const today = todayISO();
  const totals = useMemo(() => {
    const rows = data ?? [];
    return {
      total: rows.reduce((s, r) => s + r.remaining, 0),
      overdue: rows.filter((r) => r.dueDate && r.dueDate < today).reduce((s, r) => s + r.remaining, 0),
    };
  }, [data, today]);

  if (!isLoading && (data ?? []).length === 0) return null;

  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <HandCoins className="h-4 w-4" /> Crediário em aberto
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {formatCurrency(totals.total)}
            {totals.overdue > 0 ? (
              <span className="text-destructive"> · {formatCurrency(totals.overdue)} vencido</span>
            ) : null}
          </p>
        </div>

        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <ul className="divide-y rounded-md border">
            {(data ?? []).map((r) => {
              const overdue = !!r.dueDate && r.dueDate < today;
              return (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.customerName}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.saleNumber} · {r.sequence}ª parcela ·{" "}
                      <span className={cn(overdue && "font-medium text-destructive")}>
                        {overdue ? `venceu ${ddmm(r.dueDate)}` : `vence ${ddmm(r.dueDate)}`}
                      </span>
                    </p>
                  </div>
                  <span className={cn("shrink-0 tabular-nums font-semibold", overdue && "text-destructive")}>
                    {formatCurrency(r.remaining)}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => setReceiving(r)}>
                    Receber
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>

      {receiving ? (
        <ReceivePaymentDialog
          open
          onOpenChange={(o) => !o && setReceiving(null)}
          companyId={companyId}
          creditAccountId={receiving.accountId}
          balance={receiving.accountBalance}
          saleId={receiving.saleId}
          customerId={receiving.customerId}
          onPaid={(res) => {
            const saleId = receiving.saleId;
            setReceiving(null);
            void qc.invalidateQueries({ queryKey: ["finance"] });
            setReceipt({ saleId, receivedAmount: res.amount, paymentMethod: res.paymentMethod, paidAt: res.paidAt });
          }}
        />
      ) : null}
      <PaymentReceiptDialog
        open={!!receipt}
        onOpenChange={(o) => !o && setReceipt(null)}
        companyId={companyId}
        info={receipt}
      />
    </Card>
  );
}
