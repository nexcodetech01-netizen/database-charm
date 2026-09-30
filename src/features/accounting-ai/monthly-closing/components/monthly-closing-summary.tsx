import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Info, Users, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { useFinancialCategories } from "@/features/finance/hooks/use-finance";
import { useMonthlySummary, useWithdrawalCapacity } from "../hooks/use-monthly-summary";
import { partnerNamesFrom, planWithdrawals, RESERVE_RATE } from "../lib/withdrawal-split";

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  if (!year || !m) return month;
  const label = new Date(year, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function Line({
  label,
  value,
  sign,
  strong,
  hint,
}: {
  label: string;
  value: number;
  sign?: "+" | "−" | "=";
  strong?: boolean;
  hint?: string;
}) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", strong && "border-t pt-3")}>
      <div className="min-w-0">
        <span className={cn("text-sm", strong ? "font-semibold" : "text-muted-foreground")}>
          {sign ? <span className="mr-1.5 inline-block w-3 text-center">{sign}</span> : null}
          {label}
        </span>
        {hint ? <p className="ml-[1.125rem] text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <span
        className={cn(
          "tabular-nums",
          strong ? "text-lg font-bold" : "text-sm",
          strong && value < 0 && "text-destructive",
          strong && value > 0 && "text-emerald-600",
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}

/**
 * Fechamento mensal simples: resultado do mês, retiradas por sócia,
 * quanto ainda dá para retirar e o que falta arrumar para confiar nos números.
 */
export function MonthlyClosingSummary({ companyId }: { companyId: string }) {
  const [month, setMonth] = useState(currentMonth);
  const isCurrentMonth = month === currentMonth();

  const summaryQ = useMonthlySummary(companyId, month);
  const capacityQ = useWithdrawalCapacity(companyId, isCurrentMonth);
  const { data: categories } = useFinancialCategories(companyId);

  const partnerNames = useMemo(
    () => partnerNamesFrom((categories ?? []).map((c) => c.name)),
    [categories],
  );

  const summary = summaryQ.data;
  const capacity = capacityQ.data;
  const plan = useMemo(
    () =>
      planWithdrawals({
        partnerNames,
        withdrawals: summary?.withdrawals ?? [],
        safeAmount: isCurrentMonth ? (capacity?.safe_amount ?? null) : null,
        cashBalance: capacity?.cash_balance ?? 0,
      }),
    [partnerNames, summary, capacity, isCurrentMonth],
  );

  const pending = summary?.pending;
  const hasPending =
    !!pending && (pending.uncategorized_expenses_count > 0 || pending.items_without_cost > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="closing-month">Mês</Label>
          <Input
            id="closing-month"
            type="month"
            value={month}
            max={currentMonth()}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
            className="w-48"
          />
        </div>
        <p className="pb-2 text-sm text-muted-foreground">{monthLabel(month)}</p>
      </div>

      {summaryQ.isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Não foi possível carregar o fechamento: {(summaryQ.error as Error)?.message}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Resultado do mês */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resultado do mês</CardTitle>
          </CardHeader>
          <CardContent>
            {!summary ? (
              <Skeleton className="h-40 w-full" />
            ) : (
              <>
                <Line
                  label="Vendas"
                  value={summary.revenue}
                  sign="+"
                  hint={`${summary.sales_count} venda${summary.sales_count === 1 ? "" : "s"} paga${summary.sales_count === 1 ? "" : "s"}`}
                />
                {summary.refunds > 0 ? (
                  <Line label="Devoluções" value={summary.refunds} sign="−" />
                ) : null}
                <Line
                  label="Custo dos produtos vendidos"
                  value={summary.cogs}
                  sign="−"
                  hint="O que as peças vendidas custaram para vocês"
                />
                <Line label="Despesas da loja" value={summary.expenses_total} sign="−" />
                {summary.expenses.length > 0 ? (
                  <ul className="ml-[1.125rem] space-y-0.5 pb-1">
                    {summary.expenses.map((e) => (
                      <li key={e.category} className="flex justify-between text-xs text-muted-foreground">
                        <span>{e.category}</span>
                        <span className="tabular-nums">{formatCurrency(e.total)}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <Line label="Lucro do mês" value={summary.profit} sign="=" strong />
                {summary.merchandise_purchased > 0 ? (
                  <p className="mt-3 flex gap-1.5 text-xs text-muted-foreground">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Vocês compraram {formatCurrency(summary.merchandise_purchased)} em mercadoria. Isso
                    vira estoque e só entra no custo quando a peça é vendida.
                  </p>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>

        {/* Retiradas */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" /> Retiradas das sócias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!summary ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Já retirado em {monthLabel(month).toLowerCase()}
                </p>
                {plan.partners.map((p) => (
                  <Line key={p.name} label={p.name} value={p.withdrawn} />
                ))}
                <Line label="Total retirado" value={summary.withdrawals_total} strong />
              </div>
            )}

            {isCurrentMonth ? (
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
                  <Wallet className="h-4 w-4" /> Quanto dá pra retirar agora
                </p>
                {!capacity ? (
                  <Skeleton className="h-24 w-full" />
                ) : (
                  <>
                    <Line label="Dinheiro nas contas" value={capacity.cash_balance} sign="+" />
                    <Line label="Contas a pagar (30 dias)" value={capacity.payables_30d} sign="−" />
                    <Line
                      label="Reposição do estoque vendido"
                      value={capacity.restock_cost_30d}
                      sign="−"
                      hint="Custo do que vendeu nos últimos 30 dias"
                    />
                    <Line
                      label={`Reserva (${Math.round(RESERVE_RATE * 100)}% do saldo)`}
                      value={plan.reserve}
                      sign="−"
                    />
                    <Line label="Disponível para retirada" value={plan.availableTotal} sign="=" strong />
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {plan.partners.map((p) => (
                        <div key={p.name} className="rounded-md border bg-background p-2 text-center">
                          <p className="text-xs text-muted-foreground">{p.name} pode retirar</p>
                          <p className="text-lg font-bold tabular-nums">{formatCurrency(p.available)}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                O cálculo de quanto dá pra retirar vale só para o mês atual.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pendências */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pra confiar nesses números</CardTitle>
        </CardHeader>
        <CardContent>
          {!summary ? (
            <Skeleton className="h-10 w-full" />
          ) : !hasPending ? (
            <p className="flex items-center gap-2 text-sm text-emerald-600">
              <CheckCircle2 className="h-4 w-4" /> Tudo classificado neste mês.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {pending!.uncategorized_expenses_count > 0 ? (
                <li className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <span>
                    {pending!.uncategorized_expenses_count} despesa(s) sem categoria (
                    {formatCurrency(pending!.uncategorized_expenses_total)}), contadas como despesa da
                    loja. Se alguma for retirada ou mercadoria, o lucro está errado.{" "}
                    <Link to="/financeiro" className="font-medium underline">
                      Classificar no Financeiro
                    </Link>
                  </span>
                </li>
              ) : null}
              {pending!.items_without_cost > 0 ? (
                <li className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <span>
                    {pending!.items_without_cost} item(ns) vendido(s) sem custo cadastrado. O custo
                    dos produtos vendidos está menor que o real e o lucro, maior.{" "}
                    <Link to="/produtos" className="font-medium underline">
                      Revisar custos em Produtos
                    </Link>
                  </span>
                </li>
              ) : null}
            </ul>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Os saldos das contas precisam bater com o dinheiro de verdade (banco e gaveta). Confira de
            tempos em tempos em Financeiro → Contas.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
