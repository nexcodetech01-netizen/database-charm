import { useMemo, useState } from "react";
import {
  Search,
  Receipt,
  ArrowDownRight,
  ShieldCheck,
  Zap,
  MessageCircle,
  History,
  Calendar,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BellaInlineSuggestion } from "@/features/bella-ai/components/bella-inline-suggestion";
import { formatCurrency, formatDate } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import {
  useSetTransactionStatus,
  useTransactions,
} from "../hooks/use-finance";
import { FINANCE_PAYMENT_METHOD_LABEL } from "../types";
import type {
  FinancialTransaction,
  TransactionListFilters,
  TransactionType,
  TransactionSource,
  TransactionWithMeta,
} from "../types";
import {
  deriveRowStatus,
  deriveGroupStatus,
  groupByReference,
  daysOverdue,
  type DisplayStatus,
} from "../lib/receivables";
import { TransactionStatusBadge } from "./transaction-status-badge";
import { TransactionFormDialog } from "./transaction-form-dialog";
import { TransactionDetailsDrawer } from "./transaction-details-drawer";
import { SettleTransactionDialog } from "./settle-transaction-dialog";

interface Props {
  companyId: string;
  kind: "receivable" | "payable";
}

type TabValue = "all" | "pending" | "overdue" | "partial" | "paid";

const KIND_META = {
  receivable: {
    type: "income" as TransactionType,
    title: "Vendas a Receber",
    subtitle: "Dinheiro que entrará de clientes.",
    empty: "Nenhuma conta a receber.",
    tone: "text-success",
    prefix: "+",
    verb: "Receber",
    verbPast: "recebida",
  },
  payable: {
    type: "expense" as TransactionType,
    title: "Contas / Despesas do Mês",
    subtitle: "Contas que a empresa precisa pagar.",
    empty: "Nenhuma conta a pagar encontrada.",
    tone: "text-destructive",
    prefix: "-",
    verb: "Pagar",
    verbPast: "paga",
  },
} as const;

const TABS: { value: TabValue; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendentes" },
  { value: "overdue", label: "Vencidos" },
  { value: "partial", label: "Parciais" },
  { value: "paid", label: "Pagos" },
];

export function ReceivablesPayablesPanel({ companyId, kind }: Props) {
  const meta = KIND_META[kind];
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabValue>("all");
  const [period, setPeriod] = useState<"all" | "today" | "week" | "month">("all");
  const [origin, setOrigin] = useState<TransactionSource | "all">("all");
  const [page, setPage] = useState(1);
  const debounced = useDebouncedValue(search, 300);

  // Server filter: fetch amplo (sem status) — filtragem por tab é client-side
  // para permitir derivação de "Parcial"/"Agendado" sem tocar service.
  const filters = useMemo<TransactionListFilters>(
    () => ({
      search: debounced,
      type: meta.type,
      status: "",
      accountId: "",
      categoryId: "",
      page,
      pageSize: 20,
    }),
    [debounced, meta.type, page],
  );

  const { data, isLoading } = useTransactions(companyId, filters);
  const setStatusMut = useSetTransactionStatus();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialTransaction | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<TransactionWithMeta | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settling, setSettling] = useState<FinancialTransaction | null>(null);

  const rows = data?.rows || [];
  const groups = useMemo(() => groupByReference(rows), [rows]);

  const enriched = useMemo(
    () =>
      (rows || []).map((r) => ({
        row: r,
        display: deriveGroupStatus(r, groups),
      })),
    [rows, groups],
  );

  const filtered = useMemo(() => {
    let result = enriched;

    // Filtro por Tab (Status)
    switch (tab) {
      case "pending":
        result = result.filter(
          (e) =>
            e.display === "pending" ||
            e.display === "scheduled" ||
            e.display === "partial",
        );
        break;
      case "overdue":
        result = result.filter((e) => e.display === "overdue");
        break;
      case "partial":
        result = result.filter((e) => e.display === "partial");
        break;
      case "paid":
        result = result.filter((e) => e.display === "paid");
        break;
    }

    // Filtro por Origem
    if (origin !== "all") {
      result = result.filter((e) => e.row.source === origin);
    }

    // Filtro por Período
    if (period !== "all") {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const startOfToday = now.getTime();
      
      const oneWeekAgo = new Date(now);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      result = result.filter((e) => {
        const dateStr = e.row.due_date ?? e.row.transaction_date;
        const date = new Date(dateStr + "T00:00:00").getTime();
        
        if (period === "today") return date === startOfToday;
        if (period === "week") return date >= oneWeekAgo.getTime() && date <= startOfToday;
        if (period === "month") return date >= startOfMonth.getTime() && date <= startOfToday;
        return true;
      });
    }

    return result;
  }, [enriched, tab, origin, period]);

  // Bella — 1 sugestão contextual acima da tabela (não intrusiva).
  const suggestion = useMemo(() => pickSuggestion(enriched, kind), [enriched, kind]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / filters.pageSize));

  function handleReceive(t: FinancialTransaction) {
    setSettling(t);
    setSettleOpen(true);
  }

  function openDetails(t: TransactionWithMeta) {
    setSelected(t);
    setDrawerOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{meta.title}</h2>
          <p className="text-sm text-muted-foreground">{meta.subtitle}</p>
        </div>
      </div>

      {suggestion ? (
        <BellaInlineSuggestion
          tone={suggestion.tone}
          title={suggestion.title}
          message={suggestion.message}
          action={{
            label: suggestion.actionLabel,
            onClick: () => {
              setTab(suggestion.tab);
              setPage(1);
            },
          }}
        />
      ) : null}

      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Pesquisar descrição, observação..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <select 
                className="bg-transparent text-sm outline-none"
                value={period}
                onChange={(e) => setPeriod(e.target.value as any)}
              >
                <option value="all">Todo período</option>
                <option value="today">Hoje</option>
                <option value="week">Últimos 7 dias</option>
                <option value="month">Este mês</option>
              </select>
            </div>

            <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-1">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select 
                className="bg-transparent text-sm outline-none"
                value={origin}
                onChange={(e) => setOrigin(e.target.value as any)}
              >
                <option value="all">Todas origens</option>
                <option value="manual">Manual</option>
                <option value="sale">Vendas</option>
                <option value="purchase">Compras</option>
                <option value="bella_pay">Bella Pay</option>
              </select>
            </div>

            <Tabs value={tab} onValueChange={(v) => { setTab(v as TabValue); setPage(1); }}>
              <TabsList>
                {TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="text-xs">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead className="hidden md:table-cell">Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="hidden lg:table-cell">
                  {kind === "receivable" ? "Como será recebido" : "Como será pago"}
                </TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="w-[160px] text-right">Ação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-24">
                    <div className="flex flex-col items-center gap-4 text-center">
                      <div className="rounded-full bg-muted p-4">
                        {kind === "receivable" ? (
                          <ArrowDownRight className="h-8 w-8 text-muted-foreground" />
                        ) : (
                          <Receipt className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">{meta.empty}</p>
                        <p className="text-sm text-muted-foreground max-w-[280px]">
                          Não encontramos nenhum lançamento com os filtros selecionados.
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => {
                          setSearch("");
                          setTab("all");
                          setPeriod("all");
                          setOrigin("all");
                          setPage(1);
                        }}
                      >
                        Limpar filtros
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(({ row: t, display }) => {
                  const source = (t.source as TransactionSource) ?? "manual";
                  const reconciled =
                    t.status === "paid" &&
                    (source === "bella_pay" ||
                      source === "sale" ||
                      source === "purchase");
                  const overdueDays = daysOverdue(t);
                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => openDetails(t)}
                    >
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate font-medium">{t.description}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {[t.category_name, t.account_name]
                              .filter(Boolean)
                              .join(" · ") || "—"}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground">
                            {t.due_date
                              ? formatDate(t.due_date)
                              : formatDate(t.transaction_date)}
                          </span>
                          {display === "overdue" && overdueDays > 0 ? (
                            <span className="text-xs font-medium text-destructive">
                              {overdueDays} {overdueDays === 1 ? "dia" : "dias"} em atraso
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          meta.tone,
                        )}
                      >
                        {meta.prefix}
                        {formatCurrency(Number(t.amount ?? 0))}
                        {t.status === "paid" && meta.type === "income" ? " (+)" : t.status === "paid" && meta.type === "expense" ? " (-)" : ""}
                      </TableCell>
                      <TableCell className="hidden text-sm lg:table-cell">
                        {t.payment_method
                          ? (FINANCE_PAYMENT_METHOD_LABEL[t.payment_method] ??
                            t.payment_method)
                          : "—"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          <TransactionStatusBadge status={display} />
                          {source === "bella_pay" ? (
                            <Zap className="h-3.5 w-3.5 text-primary" />
                          ) : null}
                          {reconciled ? (
                            <ShieldCheck className="h-3.5 w-3.5 text-success" />
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <PrimaryAction
                          display={display}
                          verb={meta.verb}
                          onReceive={() => handleReceive(t)}
                          onHistory={() => openDetails(t)}
                          pending={setStatusMut.isPending}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            {(data?.total ?? 0) > 0
              ? `${(page - 1) * filters.pageSize + 1}–${Math.min(
                  page * filters.pageSize,
                  data?.total ?? 0,
                )} de ${data?.total}`
              : "0 resultados"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Anterior
            </Button>
            <span className="text-muted-foreground">
              Página {page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Próxima
            </Button>
          </div>
        </div>
      </div>

      <TransactionFormDialog
        open={open}
        onOpenChange={setOpen}
        companyId={companyId}
        transaction={editing}
        defaultType={meta.type}
      />

      <TransactionDetailsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        transaction={selected}
        companyId={companyId}
      />

      <SettleTransactionDialog
        open={settleOpen}
        onOpenChange={setSettleOpen}
        companyId={companyId}
        transaction={settling}
        verb={meta.verb}
      />
    </div>
  );
}

function PrimaryAction({
  display,
  verb,
  onReceive,
  onHistory,
  pending,
}: {
  display: DisplayStatus;
  verb: string;
  onReceive: () => void;
  onHistory: () => void;
  pending: boolean;
}) {
  if (display === "paid" || display === "cancelled") {
    return (
      <Button size="sm" variant="outline" onClick={onHistory}>
        <History className="mr-1.5 h-4 w-4" />
        Ver histórico
      </Button>
    );
  }
  if (display === "partial") {
    return (
      <Button size="sm" onClick={onReceive} disabled={pending}>
        {verb} saldo
      </Button>
    );
  }
  return (
    <Button size="sm" onClick={onReceive} disabled={pending}>
      {verb}
    </Button>
  );
}

function pickSuggestion(
  enriched: { row: TransactionWithMeta; display: DisplayStatus }[],
  kind: "receivable" | "payable",
): {
  tone: "info" | "warning" | "danger";
  title: string;
  message: string;
  actionLabel: string;
  tab: TabValue;
} | null {
  if (enriched.length === 0) return null;
  const overdue = enriched.filter((e) => e.display === "overdue");
  if (overdue.length > 0) {
    const worst = overdue.reduce(
      (a, b) => (daysOverdue(b.row) > daysOverdue(a.row) ? b : a),
      overdue[0],
    );
    const days = daysOverdue(worst.row);
    return {
      tone: "danger",
      title:
        kind === "receivable"
          ? `Cobrança vencida há ${days} ${days === 1 ? "dia" : "dias"}.`
          : `Conta vencida há ${days} ${days === 1 ? "dia" : "dias"}.`,
      message: `${worst.row.description} · ${formatCurrency(Number(worst.row.amount ?? 0))}`,
      actionLabel: "Ver vencidas",
      tab: "overdue",
    };
  }
  const partial = enriched.filter((e) => e.display === "partial");
  if (partial.length > 0) {
    return {
      tone: "warning",
      title:
        kind === "receivable"
          ? "Cliente pagou parcialmente."
          : "Fornecedor recebeu parcialmente.",
      message: `${partial.length} cobrança(s) com saldo em aberto.`,
      actionLabel: kind === "receivable" ? "Receber saldo" : "Pagar saldo",
      tab: "partial",
    };
  }
  const today = enriched.filter(
    (e) => e.display === "pending" || e.display === "scheduled",
  );
  const dueToday = today.filter((e) => daysOverdue(e.row) === 0 && e.row.due_date);
  if (dueToday.length > 0) {
    return {
      tone: "info",
      title:
        kind === "receivable"
          ? "Recebimento previsto para hoje."
          : "Pagamento previsto para hoje.",
      message: `${dueToday.length} cobrança(s) com vencimento hoje.`,
      actionLabel: "Ver pendentes",
      tab: "pending",
    };
  }
  return null;
}

// Suprime warning de import não utilizado quando `MessageCircle` for
// referenciado em iterações futuras (mantido para consistência do design).
void MessageCircle;
