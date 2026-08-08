import { useState } from "react";
import { CalendarClock, HandCoins, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { useCreditDetailBySale } from "../hooks/use-credit";
import {
  CREDIT_ACCOUNT_STATUS_LABEL,
  CREDIT_PAYMENT_METHOD_OPTIONS,
  type CreditAccountStatus,
} from "../types";
import { ReceivePaymentDialog } from "./receive-payment-dialog";

interface Props {
  saleId: string;
  companyId: string;
  customerId?: string | null;
}

const STATUS_BADGE: Record<CreditAccountStatus, string> = {
  open: "bg-warning/10 text-warning border-warning/20",
  partially_paid: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  settled: "bg-success/10 text-success border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

function methodLabel(v: string) {
  return CREDIT_PAYMENT_METHOD_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export function CreditAccountPanel({ saleId, companyId, customerId }: Props) {
  const { data, isLoading } = useCreditDetailBySale(saleId);
  const [receiveOpen, setReceiveOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Esta venda não possui crediário associado.
      </div>
    );
  }

  const { account, installments, payments } = data;
  const status = (account.status as CreditAccountStatus) ?? "open";
  const balance = Number(account.balance ?? 0);
  const original = Number(account.original_amount ?? 0);
  const downPayment = Number(account.down_payment ?? 0);
  const received = original - balance;
  const progress = original > 0 ? Math.min(100, (received / original) * 100) : 0;
  const canReceive = status === "open" || status === "partially_paid";

  return (
    <div className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi
          label="Valor original"
          value={formatCurrency(original)}
          icon={Wallet}
        />
        <Kpi
          label="Entrada"
          value={formatCurrency(downPayment)}
          hint={downPayment > 0 ? "Registrada no checkout" : "Sem entrada"}
          icon={HandCoins}
        />
        <Kpi
          label="Já recebido"
          value={formatCurrency(received)}
          hint={`${progress.toFixed(0)}% do total`}
          icon={HandCoins}
        />
        <Kpi
          label="Saldo em aberto"
          value={formatCurrency(balance)}
          hint={account.due_date ? `Vence ${formatDate(account.due_date)}` : "Sem vencimento"}
          icon={CalendarClock}
          highlight
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={STATUS_BADGE[status]}>
            {CREDIT_ACCOUNT_STATUS_LABEL[status]}
          </Badge>
          {account.due_date ? (
            <span className="text-xs text-muted-foreground">
              Vencimento: {formatDate(account.due_date)}
            </span>
          ) : null}
          {account.settled_at ? (
            <span className="text-xs text-muted-foreground">
              Quitado em {formatDateTime(account.settled_at)}
            </span>
          ) : null}
        </div>
        {canReceive ? (
          <Button size="sm" onClick={() => setReceiveOpen(true)}>
            <HandCoins className="mr-1.5 h-4 w-4" /> Registrar recebimento
          </Button>
        ) : null}
      </div>

      <div className="rounded-lg border border-border">
        <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Parcelas
        </div>
        {installments.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            Nenhuma parcela registrada.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {installments.map((i) => {
              const amount = Number(i.amount ?? 0);
              const paid = Number(i.paid_amount ?? 0);
              const remaining = Math.max(0, amount - paid);
              return (
                <div
                  key={i.id}
                  className="grid grid-cols-[60px_1fr_140px_140px_120px] gap-3 px-4 py-3 text-sm items-center"
                >
                  <div className="font-mono text-xs text-muted-foreground">
                    #{i.sequence}
                  </div>
                  <div>
                    <div className="font-medium">{formatCurrency(amount)}</div>
                    <div className="text-xs text-muted-foreground">
                      {i.due_date ? `Vence ${formatDate(i.due_date)}` : "Sem vencimento"}
                    </div>
                  </div>
                  <div className="tabular-nums text-xs text-muted-foreground">
                    Pago: {formatCurrency(paid)}
                  </div>
                  <div className="tabular-nums text-xs">
                    Restante:{" "}
                    <strong className="text-foreground">
                      {formatCurrency(remaining)}
                    </strong>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      {i.status === 'open' ? 'Aguardando' : i.status === 'partially_paid' ? 'Parcial' : 'Pago'}
                    </Badge>
                    {(i.status === 'open' || i.status === 'partially_paid') && (
                      <Button 
                        size="xs" 
                        variant="ghost" 
                        className="h-7 px-2 text-[10px]"
                        onClick={() => setReceiveOpen(true)}
                      >
                        Baixar
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Recebimentos ({payments.length})
        </div>
        {payments.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            Nenhum recebimento registrado.
          </div>
        ) : (
          <div className="divide-y divide-border">
            <div className="bg-muted/20 px-4 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Entradas e Recebimentos
            </div>
            {payments.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
              >
                <div>
                  <div className="font-medium tabular-nums">
                    {formatCurrency(Number(p.amount ?? 0))}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateTime(p.paid_at)} · {methodLabel(p.payment_method)}
                    {p.kind === "down_payment" ? " · Entrada" : ""}
                  </div>
                  {p.notes ? (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {p.notes}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ReceivePaymentDialog
        open={receiveOpen}
        onOpenChange={setReceiveOpen}
        companyId={companyId}
        creditAccountId={account.id}
        balance={balance}
        saleId={saleId}
        customerId={customerId ?? account.customer_id}
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
      {hint ? (
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      ) : null}
    </div>
  );
}
