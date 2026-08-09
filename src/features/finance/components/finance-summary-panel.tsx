import { ArrowDownRight, ArrowUpRight, CalendarClock, Landmark, Wallet, Pencil } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useFinanceOverview, useAccounts } from "../hooks/use-finance";
import { MonthlyIncomeExpenseChart } from "./finance-charts";
import { useState } from "react";
import { AccountFormDialog } from "./account-form-dialog";

export function FinanceSummaryPanel({ companyId }: { companyId: string }) {
  const { data, isLoading } = useFinanceOverview(companyId);
  const { data: accounts, isLoading: isLoadingAccounts } = useAccounts(companyId);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustingAccount, setAdjustingAccount] = useState<any>(null);

  const activeAccounts = accounts?.filter(a => a.status === 'active') || [];
  const bankAccount = activeAccounts.find(a => a.type === 'bank' || a.type === 'digital_wallet');
  const cashAccount = activeAccounts.find(a => a.type === 'cash');
  // FORÇADO: Substituído por 116.83 para teste de limpeza de cache conforme pedido.
  const totalBalance = 116.83;
  // const totalBalance = (accounts || []).filter((a: any) => a.is_active || a.status === 'active').reduce((sum: number, a: any) => sum + (Number(a.current_balance) || 0), 0);


  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <CardBalance 
          label="Caixa Disponível (Total)" 
          value={totalBalance}
          icon={Wallet}
          loading={isLoadingAccounts}
          highlight
          description="Soma de todas as contas ativas"
        />
        <CardBalance 
          label="Banco PJ" 
          value={bankAccount?.current_balance ?? 0}
          icon={Landmark}
          loading={isLoadingAccounts}
          onAdjust={() => {
            setAdjustingAccount(bankAccount);
            setAdjustOpen(true);
          }}
        />
        <CardBalance 
          label="Caixa Físico (Dinheiro)" 
          value={cashAccount?.current_balance ?? 0}
          icon={Wallet}
          loading={isLoadingAccounts}
          onAdjust={() => {
            setAdjustingAccount(cashAccount);
            setAdjustOpen(true);
          }}
        />
      </div>

      <AccountFormDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        companyId={companyId}
        account={adjustingAccount}
      />

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-success" />
          <div>
            <h3 className="text-sm font-semibold">Contas a receber por vencimento</h3>
            <p className="text-xs text-muted-foreground">
              Títulos em aberto (não pagos e não cancelados) segmentados pela data de vencimento.
            </p>
          </div>
        </div>
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MiniStat
              label="Vencidas"
              value={formatCurrency(data?.receivableOverdue ?? 0)}
              tone="text-destructive"
            />
            <MiniStat
              label="A vencer (até 30 dias)"
              value={formatCurrency(data?.receivableDue30 ?? 0)}
              tone="text-warning"
            />
            <MiniStat
              label="A vencer (> 30 dias)"
              value={formatCurrency(data?.receivableDue60Plus ?? 0)}
              tone="text-success"
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Section
          title="Próximos recebimentos"
          empty="Sem contas a receber programadas."
          icon={<ArrowDownRight className="h-4 w-4 text-success" />}
          loading={isLoading}
          items={data?.upcomingIncome ?? []}
          tone="text-success"
        />
        <Section
          title="Próximos pagamentos"
          empty="Sem contas a pagar programadas."
          icon={<ArrowUpRight className="h-4 w-4 text-destructive" />}
          loading={isLoading}
          items={data?.upcomingExpense ?? []}
          tone="text-destructive"
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4">
          <h3 className="text-sm font-semibold">Resumo financeiro do mês</h3>
          <p className="text-xs text-muted-foreground">Baseado em movimentações efetivamente pagas no período.</p>
        </div>
        {isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <MiniStat
              label="Receita Bruta"
              value={formatCurrency(data?.grossRevenue ?? 0)}
              tone="text-foreground"
            />
            <MiniStat
              label="Taxas e Estornos"
              value={formatCurrency(data?.taxesAndDeductions ?? 0)}
              tone="text-destructive"
            />
            <MiniStat
              label="Receita Líquida"
              value={formatCurrency((data?.grossRevenue ?? 0) - (data?.taxesAndDeductions ?? 0))}
              tone="text-success"
            />
            <MiniStat
              label="Despesas"
              value={formatCurrency(data?.monthExpense ?? 0)}
              tone="text-destructive"
            />
            <MiniStat
              label="Lucro"
              value={formatCurrency(data?.monthProfit ?? 0)}
              tone="text-primary"
            />
          </div>
        )}
      </div>

      <MonthlyIncomeExpenseChart companyId={companyId} />
    </div>
  );
}

function Section({
  title,
  icon,
  loading,
  items,
  empty,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  loading: boolean;
  items: { id: string; description: string; date: string; amount: number }[];
  empty: string;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-muted/50"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{it.description}</p>
                <p className="text-xs text-muted-foreground">{formatDate(it.date)}</p>
              </div>
              <span className={`tabular-nums font-medium ${tone}`}>
                {formatCurrency(it.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CardBalance({ 
  label, 
  value, 
  icon: Icon, 
  loading,
  onAdjust,
  highlight,
  description
}: { 
  label: string; 
  value: number; 
  icon: any; 
  loading: boolean;
  onAdjust?: () => void;
  highlight?: boolean;
  description?: string;
}) {
  return (
    <div className={`rounded-xl border border-border p-5 ${highlight ? 'bg-primary/5 border-primary/20 ring-1 ring-primary/10' : 'bg-card'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className={`h-4 w-4 ${highlight ? 'text-primary' : ''}`} />
          <span className={`text-sm font-medium ${highlight ? 'text-foreground' : ''}`}>{label}</span>
        </div>
        {onAdjust && (
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 px-2 text-[10px] text-muted-foreground hover:text-primary"
            onClick={onAdjust}
          >
            <Pencil className="mr-1 h-3 w-3" />
            Ajustar
          </Button>
        )}
      </div>
      <div className="mt-2">
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <div>
            <p className={`text-2xl font-bold tabular-nums ${highlight ? 'text-primary' : ''}`}>
              {formatCurrency(value)}
            </p>
            {description && <p className="text-[10px] text-muted-foreground mt-1">{description}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  );
}
