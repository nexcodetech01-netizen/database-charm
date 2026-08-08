import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  FINANCE_PAYMENT_METHOD_OPTIONS,
  TRANSACTION_STATUS_OPTIONS,
  TRANSACTION_TYPE_OPTIONS,
  type FinancePaymentMethod,
  type FinancialTransaction,
  type TransactionStatus,
  type TransactionType,
} from "../types";
import {
  useAccounts,
  useCreateAndSettleTransaction,
  useCreateTransaction,
  useFinancialCategories,
  useUpdateTransaction,
} from "../hooks/use-finance";
import { useNextAction } from "@/components/feedback/next-action-provider";
import { useCashGuard } from "@/features/cash";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  transaction?: FinancialTransaction | null;
  defaultType?: TransactionType;
  initialIsReimbursement?: boolean;
}

const todayISO = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function TransactionFormDialog({
  open,
  onOpenChange,
  companyId,
  transaction,
  defaultType,
  initialIsReimbursement,
}: Props) {
  const isEdit = !!transaction;
  const createMut = useCreateTransaction();
  const createAndSettleMut = useCreateAndSettleTransaction();
  const updateMut = useUpdateTransaction();
  const { data: accounts } = useAccounts(companyId);
  const { data: categories } = useFinancialCategories(companyId);
  const showNextAction = useNextAction();
  const [paymentMethod, setPaymentMethod] = useState<FinancePaymentMethod | "">("");
  const [installments, setInstallments] = useState(1);
  const [paidWith, setPaidWith] = useState<"company" | "personal">("company");
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);

  const [form, setForm] = useState({
    type: (defaultType ?? "income") as TransactionType,
    description: "",
    amount: 0,
    account_id: "",
    transfer_to_account_id: "",
    category_id: "",
    transaction_date: todayISO(),
    due_date: todayISO(),
    status: "pending" as TransactionStatus,
    notes: "",
  });

  const selectedAccountName =
    (accounts ?? []).find((a) => a.id === form.account_id)?.name ?? null;
  const { runWithCashGuard, cashGuardDialog } = useCashGuard({
    companyId,
    accountName: selectedAccountName,
  });

  useEffect(() => {
    if (!open) return;
    setPaymentMethod("");
    setInstallments(1);
    setPaidWith("company");
    if (transaction) {

      setForm({
        type: transaction.type as TransactionType,
        description: transaction.description,
        amount: Number(transaction.amount ?? 0),
        account_id: transaction.account_id ?? "",
        transfer_to_account_id: transaction.transfer_to_account_id ?? "",
        category_id: transaction.category_id ?? "",
        transaction_date: transaction.transaction_date ?? todayISO(),
        due_date: transaction.due_date ?? todayISO(),
        status: (transaction.status as TransactionStatus) ?? "pending",
        notes: transaction.notes ?? "",
      });
    } else {
      setForm((f) => ({
        ...f,
        type: defaultType ?? "income",
        description: "",
        amount: 0,
        account_id: "",
        transfer_to_account_id: "",
        category_id: initialIsReimbursement ? (categories?.find(c => c.kind === "income" && (c.name.includes("Aporte") || c.name.includes("Dono") || c.name.includes("Sócio")))?.id ?? "") : "",
        transaction_date: todayISO(),
        due_date: todayISO(),
        status: "pending",
        notes: initialIsReimbursement ? "Investimento do Dono" : "",
      }));
    }
  }, [open, transaction, defaultType, initialIsReimbursement, categories]);

  const filteredCategories = useMemo(() => {
    if (!categories) return [];
    if (form.type === "transfer") return [];
    const kind = form.type === "income" ? "income" : "expense";
    return categories.filter((c) => c.kind === kind);
  }, [categories, form.type]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.description.trim()) {
      toast.error("Informe a descrição");
      return;
    }
    if (form.amount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }
    if (form.type === "transfer" && (!form.account_id || !form.transfer_to_account_id)) {
      toast.error("Selecione as contas de origem e destino");
      return;
    }
    const settleOnCreate = !isEdit && form.status === "paid" && form.type !== "transfer";
    if (settleOnCreate && !paymentMethod) {
      toast.error("Selecione a forma de pagamento/recebimento da baixa");
      return;
    }
    if (settleOnCreate && !form.account_id) {
      toast.error("Selecione a conta da baixa");
      return;
    }

    // Sprint 8.4: Fallback para "Despesas Gerais" se for despesa e categoria estiver vazia
    let finalCategoryId = form.type === "transfer" ? null : form.category_id || null;
    if (!finalCategoryId && form.type === "expense") {
      const generalCategory = categories?.find(c => c.name.toLowerCase().includes("gerais") || c.name.toLowerCase().includes("geral"));
      if (generalCategory) {
        finalCategoryId = generalCategory.id;
      }
    }

    const payload = {
      company_id: companyId,
      type: form.type,
      description: form.description.trim(),
      amount: form.amount,
      account_id: form.account_id || null,
      transfer_to_account_id: form.type === "transfer" ? form.transfer_to_account_id || null : null,
      category_id: finalCategoryId,
      transaction_date: form.transaction_date,
      due_date: form.due_date || todayISO(),
      status: form.status === "paid" ? "pending" : form.status,
      source: form.type === "transfer" ? "transfer" : "manual",
      notes: form.notes || null,
      metadata: paidWith === "personal" ? {
        reimbursement: true,
        installments,
        original_amount: form.amount,
        owner: "Tiele"
      } : undefined
    };

    try {
      if (isEdit && transaction) {
        const { company_id: _c, source: _s, status: _st, ...update } = payload;
        void _c;
        void _s;
        void _st;
        await updateMut.mutateAsync({ id: transaction.id, input: update });
        toast.success("Movimentação atualizada");
        onOpenChange(false);
      } else {
        if (settleOnCreate) {
          const settled = await runWithCashGuard(
            () =>
              createAndSettleMut.mutateAsync({
                input: payload,
                settle: {
                  paymentMethod: paymentMethod as FinancePaymentMethod,
                  accountId: form.account_id,
                  paidAt: form.transaction_date || todayISO(),
                  notes: form.notes || null,
                },
              }),
            { preCheck: true },
          );
          // Sem caixa aberto: o diálogo de abertura assume o fluxo e a
          // operação é reexecutada automaticamente depois.
          if (settled === undefined) return;
        } else {
          await createMut.mutateAsync(payload);
        }
        onOpenChange(false);

        const kindLabel =
          form.type === "income" ? "Receita" : form.type === "expense" ? "Despesa" : "Transferência";
        const summary = [
          `${kindLabel} registrada`,
          "Saldo será atualizado conforme o status da movimentação",
        ];
        showNextAction({
          title: "Movimentação criada",
          summary,
          question: "O que quer fazer agora?",
          primaryAction: { label: "Ver financeiro", to: "/financeiro" },
          secondaryActions: [
            { label: "Nova movimentação", onClick: () => onOpenChange(true) },
          ],
        });
      }
    } catch (err) {
      toast.error("Não foi possível salvar", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar movimentação" : form.type === "transfer" ? "Nova Transferência" : "Nova movimentação"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm({ ...form, type: v as TransactionType })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRANSACTION_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} textValue={o.label}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRANSACTION_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} textValue={o.label}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!isEdit && form.status === "paid" && form.type !== "transfer" ? (
              <div className="sm:col-span-2">
                <Label>Forma de {form.type === "income" ? "recebimento" : "pagamento"} *</Label>
                <Select
                  value={paymentMethod || "__none__"}
                  onValueChange={(v) =>
                    setPaymentMethod(v === "__none__" ? "" : (v as FinancePaymentMethod))
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {FINANCE_PAYMENT_METHOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} textValue={o.label}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">
                  A baixa será registrada pelo motor financeiro na conta selecionada.
                </p>
              </div>
            ) : null}
            <div className="sm:col-span-2">

              <Label>Descrição *</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Ex.: Aluguel de setembro"
              />
            </div>
            {form.type === "expense" && (
              <div className="sm:col-span-2 space-y-4 rounded-lg border bg-muted/30 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Pago com:</Label>
                    <Select
                      value={paidWith}
                      onValueChange={(v) => setPaidWith(v as any)}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="company">Conta da Empresa</SelectItem>
                        <SelectItem value="personal">Cartão Pessoal (Tiele)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {paidWith === "personal" && (
                    <div>
                      <Label>Número de parcelas:</Label>
                      <Select
                        value={String(installments)}
                        onValueChange={(v) => setInstallments(Number(v))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                            <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                {paidWith === "personal" && (
                  <p className="text-xs text-muted-foreground">
                    O sistema gerará automaticamente as contas a pagar nos meses futuros marcadas como "Reembolso de Sócio".
                  </p>
                )}
              </div>
            )}
            <div>
              <Label>Valor Total *</Label>
              <Input
                type="number"
                step="0.01"
                min={0}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              />
              {paidWith === "personal" && installments > 1 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {installments}x de {formatCurrency(form.amount / installments)}
                </p>
              )}
            </div>
            <div>
              <Label>{form.type === "transfer" ? "Conta de origem" : "Conta"}</Label>
              <Select
                value={form.account_id || "__none__"}
                onValueChange={(v) =>
                  setForm({ ...form, account_id: v === "__none__" ? "" : v })
                }
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" textValue="Sem conta">Sem conta</SelectItem>
                  {(accounts ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id} textValue={a.name}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {form.type === "transfer" ? (
              <div className="sm:col-span-2">
                <Label>Conta de destino *</Label>
                <Select
                  value={form.transfer_to_account_id || "__none__"}
                  onValueChange={(v) =>
                    setForm({
                      ...form,
                      transfer_to_account_id: v === "__none__" ? "" : v,
                    })
                  }
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__" textValue="Selecione">Selecione</SelectItem>
                    {(accounts ?? [])
                      .filter((a) => a.id !== form.account_id)
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id} textValue={a.name}>
                          {a.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="sm:col-span-2">
                <Label>Categoria</Label>
                <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={categoryOpen}
                      className="w-full justify-between font-normal"
                    >
                      {form.category_id
                        ? filteredCategories.find((c) => c.id === form.category_id)?.name
                        : "Selecionar categoria..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Procurar categoria..." 
                        value={categorySearch}
                        onValueChange={setCategorySearch}
                      />
                      <CommandList>
                        <CommandEmpty className="py-2 px-4 text-sm">
                          Nenhuma categoria encontrada.
                        </CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__"
                            onSelect={() => {
                              setForm({ ...form, category_id: "" });
                              setCategoryOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                !form.category_id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            Sem categoria
                          </CommandItem>
                          {filteredCategories.map((c) => (
                            <CommandItem
                              key={c.id}
                              value={c.name}
                              onSelect={() => {
                                setForm({ ...form, category_id: c.id });
                                setCategoryOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  form.category_id === c.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {c.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Se não selecionada, será classificada como "Despesas Gerais" automaticamente.
                </p>
              </div>
            )}

            <div>
              <Label>Data</Label>
              <Input
                type="date"
                value={form.transaction_date}
                onChange={(e) => setForm({ ...form, transaction_date: e.target.value })}
              />
            </div>
            <div>
              <Label>Data de Vencimento / Previsão de Pagamento</Label>
              <Input
                type="date"
                value={form.due_date}
                onChange={(e) =>
                  setForm({ ...form, due_date: e.target.value || todayISO() })
                }
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Se não preencher, será usada a data de hoje.
              </p>
            </div>

            <div className="sm:col-span-2">
              <Label>Observações</Label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMut.isPending || updateMut.isPending || createAndSettleMut.isPending}>
              {createMut.isPending || updateMut.isPending || createAndSettleMut.isPending
                ? "Salvando..."
                : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      </Dialog>
      {cashGuardDialog}
    </>
  );
}
