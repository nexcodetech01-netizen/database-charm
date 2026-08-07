import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle2,
  Ban,
  Receipt,
  Zap,
  ShoppingCart,
  Landmark,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatDate } from "@/lib/format";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import {
  useAccounts,
  useDeleteTransaction,
  useFinancialCategories,
  useSetTransactionStatus,
  useTransactions,
} from "../hooks/use-finance";
import {
  TRANSACTION_STATUS_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  type FinancialTransaction,
  type TransactionListFilters,
  type TransactionType,
  type TransactionSource,
  type TransactionWithMeta,
} from "../types";
import { TransactionStatusBadge } from "./transaction-status-badge";
import { TransactionFormDialog } from "./transaction-form-dialog";
import { TransactionDetailsDrawer } from "./transaction-details-drawer";
import { SettleTransactionDialog } from "./settle-transaction-dialog";

const DEFAULT: TransactionListFilters = {
  search: "",
  type: "",
  status: "",
  accountId: "",
  categoryId: "",
  page: 1,
  pageSize: 20,
};

const TYPE_ICON: Record<TransactionType, typeof ArrowDownRight> = {
  income: ArrowDownRight,
  expense: ArrowUpRight,
  transfer: ArrowLeftRight,
};

const TYPE_TONE: Record<TransactionType, string> = {
  income: "text-success",
  expense: "text-destructive",
  transfer: "text-muted-foreground",
};

const SOURCE_ICON: Record<
  TransactionSource,
  React.ComponentType<{ className?: string }>
> = {
  manual: ReceiptText,
  sale: ShoppingCart,
  purchase: Landmark,
  bella_pay: Zap,
  transfer: ArrowLeftRight,
};

const SOURCE_OPTIONS: { value: TransactionSource; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "sale", label: "Venda" },
  { value: "purchase", label: "Compra" },
  { value: "bella_pay", label: "Bella Pay" },
  { value: "transfer", label: "Transferência" },
];

export function TransactionsPanel({ companyId }: { companyId: string }) {
  const [filters, setFilters] = useState<TransactionListFilters>(DEFAULT);
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const effective = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  const { data, isLoading } = useTransactions(companyId, effective);
  const { data: accounts } = useAccounts(companyId);
  const { data: categories } = useFinancialCategories(companyId);
  const setStatusMut = useSetTransactionStatus();
  const deleteMut = useDeleteTransaction();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialTransaction | null>(null);
  const [defaultType, setDefaultType] = useState<TransactionType>("income");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<TransactionWithMeta | null>(null);
  const [settleOpen, setSettleOpen] = useState(false);
  const [settling, setSettling] = useState<FinancialTransaction | null>(null);

  function handleNew(type: TransactionType) {
    setEditing(null);
    setDefaultType(type);
    setOpen(true);
  }
  function handleEdit(t: FinancialTransaction) {
    setEditing(t);
    setOpen(true);
  }
  function openDetails(t: TransactionWithMeta) {
    setSelected(t);
    setDrawerOpen(true);
  }
  async function handleStatus(t: FinancialTransaction, status: string, label: string) {
    try {
      await setStatusMut.mutateAsync({ id: t.id, status });
      toast.success(`Movimentação ${label}`);
    } catch (err) {
      toast.error("Não foi possível atualizar", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }
  async function handleDelete(t: FinancialTransaction) {
    if (!confirm(`Excluir "${t.description}"?`)) return;
    try {
      await deleteMut.mutateAsync(t.id);
      toast.success("Movimentação excluída");
    } catch (err) {
      toast.error("Não foi possível excluir", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / filters.pageSize));
  const allRows = data?.rows ?? [];
  const rows = sourceFilter ? allRows.filter((r) => r.source === sourceFilter) : allRows;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Movimentações</h2>
          <p className="text-sm text-muted-foreground">
            Receitas, despesas e transferências entre contas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => handleNew("transfer")}>
            <ArrowLeftRight className="mr-1.5 h-4 w-4" /> Transferência
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleNew("expense")}>
            <ArrowUpRight className="mr-1.5 h-4 w-4" /> Despesa
          </Button>
          <Button size="sm" onClick={() => handleNew("income")}>
            <Plus className="mr-1.5 h-4 w-4" /> Receita
          </Button>
        </div>
      </div>

      {/* Barra de filtros unificada */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Pesquisar descrição, observação, referência..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value, page: 1 })}
            />
          </div>
          <QuickSelect
            value={filters.status}
            onChange={(v) => setFilters({ ...filters, status: v, page: 1 })}
            placeholder="Status"
            options={TRANSACTION_STATUS_OPTIONS}
            className="w-[140px]"
          />
          <QuickSelect
            value={filters.type}
            onChange={(v) => setFilters({ ...filters, type: v, page: 1 })}
            placeholder="Tipo"
            options={TRANSACTION_TYPE_OPTIONS}
            className="w-[140px]"
          />
          <QuickSelect
            value={filters.categoryId}
            onChange={(v) => setFilters({ ...filters, categoryId: v, page: 1 })}
            placeholder="Categoria"
            options={(categories ?? []).map((c) => ({ value: c.id, label: c.name }))}
            className="w-[170px]"
          />
          <QuickSelect
            value={filters.accountId}
            onChange={(v) => setFilters({ ...filters, accountId: v, page: 1 })}
            placeholder="Conta"
            options={(accounts ?? []).map((a) => ({ value: a.id, label: a.name }))}
            className="w-[170px]"
          />
          <QuickSelect
            value={sourceFilter}
            onChange={setSourceFilter}
            placeholder="Origem"
            options={SOURCE_OPTIONS}
            className="w-[150px]"
          />
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
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Origem</TableHead>
                <TableHead className="w-[52px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-16">
                    <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                      <Receipt className="h-8 w-8" />
                      <p className="font-medium text-foreground">
                        Nenhuma movimentação encontrada
                      </p>
                      <p className="text-sm">
                        Ajuste os filtros ou registre uma nova movimentação.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((t) => {
                  const type = (t.type as TransactionType) ?? "expense";
                  const source = (t.source as TransactionSource) ?? "manual";
                  const Icon = TYPE_ICON[type];
                  const SourceIcon = SOURCE_ICON[source] ?? ReceiptText;
                  const tone = TYPE_TONE[type];
                  const reconciled =
                    t.status === "paid" &&
                    (source === "bella_pay" ||
                      source === "sale" ||
                      source === "purchase");
                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/40"
                      onClick={() => openDetails(t)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "grid h-8 w-8 shrink-0 place-items-center rounded-md bg-accent",
                              tone,
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{t.description}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {[t.category_name, t.account_name]
                                .filter(Boolean)
                                .join(" · ") || "—"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                        {t.due_date ? formatDate(t.due_date) : formatDate(t.transaction_date)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right font-medium tabular-nums",
                          tone,
                        )}
                      >
                        {type === "expense" ? "-" : type === "income" ? "+" : ""}
                        {formatCurrency(Number(t.amount ?? 0))}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <TransactionStatusBadge status={t.status} />
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                          <SourceIcon className="h-3.5 w-3.5" />
                          {SOURCE_OPTIONS.find((s) => s.value === source)?.label ?? "Manual"}
                          {reconciled ? (
                            <ShieldCheck className="h-3.5 w-3.5 text-success" />
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetails(t)}>
                              Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleEdit(t)}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                            {t.status !== "paid" && t.status !== "cancelled" ? (
                              <DropdownMenuItem
                                onClick={() => {
                                  setSettling(t);
                                  setSettleOpen(true);
                                }}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                {t.source === "sale_return" ? "Reembolsar" : type === "income" ? "Receber" : "Pagar"}
                              </DropdownMenuItem>
                            ) : null}
                            {t.status !== "cancelled" ? (
                              <DropdownMenuItem
                                onClick={() => handleStatus(t, "cancelled", "cancelada")}
                              >
                                <Ban className="mr-2 h-4 w-4" /> Cancelar
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(t)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
              ? `${(filters.page - 1) * filters.pageSize + 1}–${Math.min(
                  filters.page * filters.pageSize,
                  data?.total ?? 0,
                )} de ${data?.total}`
              : "0 resultados"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page <= 1}
              onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
            >
              Anterior
            </Button>
            <span className="text-muted-foreground">
              Página {filters.page} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= totalPages}
              onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
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
        defaultType={defaultType}
      />

      <SettleTransactionDialog
        open={settleOpen}
        onOpenChange={setSettleOpen}
        companyId={companyId}
        transaction={settling}
        verb={settling?.type === "expense" ? "Pagar" : "Receber"}
      />

      <TransactionDetailsDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        transaction={selected}
        companyId={companyId}
      />
    </div>
  );
}

function QuickSelect({
  value,
  onChange,
  placeholder,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Select
      value={value || "__all__"}
      onValueChange={(v) => onChange(v === "__all__" ? "" : v)}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__" textValue={`Todos · ${placeholder}`}>
          Todos · {placeholder}
        </SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value} textValue={o.label}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
