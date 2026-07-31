import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/format";
import { useCustomerCreditSummary } from "../hooks/use-credit";
import { CREDIT_ACCOUNT_STATUS_LABEL, type CreditAccountStatus } from "../types";

interface Props {
  customerId: string;
}

/**
 * Card resumido de crediário para o Cliente 360.
 * Mostra saldo total em aberto, contas ativas, atrasos e últimas vendas.
 */
export function CustomerCreditCard({ customerId }: Props) {
  const { data, isLoading } = useCustomerCreditSummary(customerId);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card p-5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-3 h-16 w-full" />
      </div>
    );
  }

  const totals = data?.totals;
  const rows = data?.rows ?? [];
  const hasCredit = rows.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Crediário</h3>
        </div>
        {totals && totals.overdueAccounts > 0 ? (
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            <AlertTriangle className="mr-1 h-3 w-3" />
            {totals.overdueAccounts} em atraso
          </Badge>
        ) : null}
      </div>

      {!hasCredit ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Este cliente ainda não possui compras no crediário.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-3 gap-3">
            <MiniStat
              label="Saldo em aberto"
              value={formatCurrency(totals?.balance ?? 0)}
              highlight
            />
            <MiniStat
              label="Contas ativas"
              value={String(totals?.openAccounts ?? 0)}
            />
            <MiniStat
              label="Já recebido"
              value={formatCurrency(totals?.received ?? 0)}
            />
          </div>

          {totals && totals.overdueAmount > 0 ? (
            <div className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
              Total em atraso:{" "}
              <strong>{formatCurrency(totals.overdueAmount)}</strong>
            </div>
          ) : null}

          <div className="mt-4 space-y-2">
            {rows.slice(0, 5).map((r) => {
              const status = (r.status ?? "open") as CreditAccountStatus;
              const nextDue = r.next_due_date ?? r.due_date;
              const overdue =
                nextDue &&
                (status === "open" || status === "partially_paid") &&
                new Date(nextDue + "T23:59:59") < new Date();
              return (
                <Button
                  key={r.credit_account_id ?? r.sale_id ?? nextDue ?? ""}
                  asChild
                  variant="ghost"
                  className="h-auto w-full justify-between px-2 py-2 text-left"
                >
                  <Link
                    to="/vendas/$saleId"
                    params={{ saleId: r.sale_id ?? "" }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium tabular-nums">
                          {formatCurrency(Number(r.balance ?? 0))}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {CREDIT_ACCOUNT_STATUS_LABEL[status]}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {nextDue ? `Vence ${formatDate(nextDue)}` : "Sem vencimento"}
                        {overdue ? " · em atraso" : ""}
                      </div>
                    </div>
                    <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </Button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-md border p-2 ${
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-muted/30"
      }`}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
