import { useEffect, useMemo, useRef, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
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
  STATIC_FINANCIAL_CATEGORIES,
} from "../types";

import {
  useAccounts,
  useCreateAndSettleTransaction,
  useCreateTransaction,
  useFinancialCategories,
  useUpdateTransaction,
} from "../hooks/use-finance";
import { useNextAction } from "@/components/feedback/next-action-provider";
import { useQueryClient } from "@tanstack/react-query";
import { financeService } from "../services/finance.service";

/** Categorias sugeridas ainda não criadas na empresa (criadas ao salvar). */
const STATIC_CATEGORY_PREFIX = "static:";
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
  const qc = useQueryClient();
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
    category: "", // Nova propriedade para armazenar o texto da categoria
    transaction_date: todayISO(),
    due_date: todayISO(),
    status: "pending" as TransactionStatus,
    notes: "",
    payment_condition: "cash" as "cash" | "installments",
    installment_count: 1,
    installment_interval_days: 30,
    first_installment_date: todayISO(),
    is_recurring: false,
    recurrence_day: 20,
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

    setPaidWith("company");
    if (transaction) {

      setForm({
        ...form,
        type: transaction.type as TransactionType,
        description: transaction.description,
        amount: Number(transaction.amount ?? 0),
        account_id: transaction.account_id ?? "",
        transfer_to_account_id: transaction.transfer_to_account_id ?? "",
        category_id: transaction.category_id ?? "",
        category: (transaction as any).category ?? "",

        transaction_date: transaction.transaction_date ?? todayISO(),
        due_date: transaction.due_date ?? todayISO(),
        status: (transaction.status as TransactionStatus) ?? "pending",
        notes: transaction.notes ?? "",
        is_recurring: (transaction as any).is_recurring ?? false,
        recurrence_day: (transaction as any).recurrence_day ?? 20,
      });

    } else {
      setForm((f) => ({
        ...f,
        type: defaultType ?? "income",
        description: "",
        amount: 0,
        account_id: "",
        transfer_to_account_id: "",
        category_id: "",
        category: initialIsReimbursement ? "Aporte de Sócio" : "",

        transaction_date: todayISO(),
        due_date: todayISO(),
        status: "pending",
        notes: initialIsReimbursement ? "Investimento do Dono" : "",
        is_recurring: false,
        recurrence_day: 20,
      }));
    }
  }, [open, transaction, defaultType, initialIsReimbursement, categories]);

  const filteredCategories = useMemo(() => {
    if (form.type === "transfer") return [];
    
        // Despesas: categorias da empresa (tabela financial_categories).
    // BUG CORRIGIDO (2026-09-30): antes a lista era fixa, gravada só como
    // texto — e o serviço descartava esse texto, então TODA despesa ficava
    // sem categoria e o fechamento não conseguia separar mercadoria,
    // despesa da loja e retirada das sócias.
    if (form.type === "expense") {
      const companyExpense = (categories ?? []).filter(
        (c) => c.kind === "expense" && c.status !== "inactive",
      );
      if (companyExpense.length > 0) {
        return companyExpense.map((c) => ({ id: c.id, name: c.name, kind: "expense" as const }));
      }
      // Empresa ainda sem categorias: sugere a lista padrão e cria a
      // categoria escolhida ao salvar.
      return STATIC_FINANCIAL_CATEGORIES.map((name) => ({
        id: `${STATIC_CATEGORY_PREFIX}${name}`,
        name,
        kind: "expense" as const,
      }));
    }

    // Se for receita, mantemos as categorias do banco por enquanto
    if (!categories) return [];
    return categories.filter((c) => c.kind === "income");
  }, [categories, form.type]);


  // FIX (2026-09-06): duplo clique em "Salvar" criava dois lançamentos
  // idênticos — o botão fica desabilitado com base em createMut.isPending
  // etc., mas esse estado só reflete na tela depois de um re-render do
  // React; se a rede estiver lenta e o segundo clique acontecer antes
  // disso, os dois cliques passam e criam duas movimentações iguais.
  // Esse "ref" trava na hora, sem depender de re-renderização.
  const isSubmittingRef = useRef(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmittingRef.current) return;
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
        if (form.type === "expense" && !form.category_id) {
      toast.error("Escolha a categoria da despesa", {
        description: "Retirada de sócia? Use Retirada — Tiele, Retirada — Gabriela ou Retirada — dividida.",
      });
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

    // Sprint 8.4: Fallback para "Outras Despesas Gerais" se for despesa e categoria estiver vazia
    let finalCategory = form.type === "transfer" ? null : form.category || null;
    let finalCategoryId = form.type === "transfer" ? null : form.category_id || null;

        if (form.type === "expense") {
      // Categoria obrigatória (validada acima), sempre por id.
      finalCategory = null;
    } else if (form.type === "income" && !finalCategoryId) {
      // Fallback para receitas (mantido do banco)
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
      // O campo 'category' é mantido aqui para lógica de UI ou para o hook useCreateTransaction,
      // mas o financeService.createTransaction agora o remove antes de enviar ao Supabase.
      category: finalCategory,

      transaction_date: form.transaction_date,
      due_date: form.due_date || todayISO(),
      status: form.status === "paid" ? "pending" : form.status,
      source: form.type === "transfer" ? "transfer" : "manual",
      notes: form.notes || null,
      payment_condition: form.payment_condition,
      installment_count: form.installment_count,
      installment_interval_days: form.installment_interval_days,
      first_installment_date: form.first_installment_date,
      // Conta recorrente (ex.: DAS todo dia 20): só faz sentido pra
      // pagamento à vista (não parcelado) e não é aplicável a
      // transferência entre contas.
      is_recurring: form.type !== "transfer" && form.payment_condition === "cash" ? form.is_recurring : false,
      recurrence_day: form.type !== "transfer" && form.payment_condition === "cash" && form.is_recurring ? form.recurrence_day : null,
      metadata: paidWith === "personal" ? {
        reimbursement: true,
        installments: form.installment_count,
        original_amount: form.amount,
        owner: "Tiele"
      } : undefined
    };


        try {
      isSubmittingRef.current = true;

      // Categoria sugerida (empresa ainda sem categorias): cria agora.
      if (payload.category_id?.startsWith(STATIC_CATEGORY_PREFIX)) {
        const created = await financeService.createCategory({
          company_id: companyId,
          name: payload.category_id.slice(STATIC_CATEGORY_PREFIX.length),
          kind: "expense",
        });
        payload.category_id = created.id;
        void qc.invalidateQueries({ queryKey: ["finance"] });
      }
      console.log("[TransactionFormDialog] Enviando payload:", payload);

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
    } catch (err: any) {
      console.error('Erro ao salvar movimentação:', {
        error: err,
        payload,
        message: err.message,
        details: err.details,
        hint: err.hint
      });
      
      toast.error("Não foi possível salvar", {
        description: err.details || err.message || "Verifique o console para mais detalhes.",
      });
    } finally {
      isSubmittingRef.current = false;
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>
            {isEdit ? "Editar movimentação" : form.type === "transfer" ? "Nova Transferência" : "Nova movimentação"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">


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
                      onValueChange={(v) => {
                        setPaidWith(v as any);
                        if (v === "company") {
                          setForm(f => ({ ...f, payment_condition: "cash", installment_count: 1 }));
                        }
                      }}
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
                      <Label>Número de parcelas (Cartão):</Label>
                      <Select
                        value={String(form.installment_count)}
                        onValueChange={(v) => setForm(f => ({ ...f, installment_count: Number(v) }))}
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
              {paidWith === "personal" && form.installment_count > 1 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {form.installment_count}x de {formatCurrency(form.amount / form.installment_count)}
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
                                            {(form.category_id
                        ? filteredCategories.find((c) => c.id === form.category_id)?.name
                        : null) ?? "Selecionar categoria..."}

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
                                                    {form.type !== "expense" && (
                          <CommandItem
                            value="__none__"
                            onSelect={() => {
                              setForm({ ...form, category_id: "", category: "" });
                              setCategoryOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                (!form.category_id && !form.category) ? "opacity-100" : "opacity-0"
                              )}
                            />
                                                        Sem categoria
                          </CommandItem>
                          )}
                          {filteredCategories.map((cat) => (
                            <CommandItem
                              key={cat.id}
                              value={cat.name}
                              onSelect={() => {
                                                                setForm({ ...form, category_id: cat.id, category: "" });
                                setCategoryOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                                                    form.category_id === cat.id
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              {cat.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  {form.type === "expense" 
                                        ? "* Obrigatória. Compras para revender: Mercadoria. Dinheiro para vocês: Retirada."
                    : "* Classificação automática para 'Receitas Gerais' caso não informada."}
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
            <div className="sm:col-span-2 rounded-lg border bg-muted/20 p-4 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <Label>Condição de Pagamento</Label>
                  <Select
                    value={form.payment_condition}
                    onValueChange={(v) => setForm(f => ({ ...f, payment_condition: v as any }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">À vista</SelectItem>
                      <SelectItem value="installments">Parcelado (A Prazo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {form.payment_condition === "installments" && (
                  <div>
                    <Label>Nº de Parcelas</Label>
                    <Select
                      value={String(form.installment_count)}
                      onValueChange={(v) => setForm(f => ({ ...f, installment_count: Number(v) }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map(n => (
                          <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {form.type !== "transfer" && form.payment_condition === "cash" && (
                <div className="space-y-3 border-t pt-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="is_recurring"
                      checked={form.is_recurring}
                      onCheckedChange={(checked) =>
                        setForm((f) => ({ ...f, is_recurring: checked === true }))
                      }
                    />
                    <Label htmlFor="is_recurring" className="cursor-pointer font-normal">
                      Conta recorrente (repete todo mês)
                    </Label>
                  </div>
                  {form.is_recurring && (
                    <div className="max-w-[200px]">
                      <Label>Dia do vencimento (todo mês)</Label>
                      <Select
                        value={String(form.recurrence_day)}
                        onValueChange={(v) => setForm((f) => ({ ...f, recurrence_day: Number(v) }))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                            <SelectItem key={d} value={String(d)}>{`Dia ${d}`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Ao dar baixa (marcar como pago), o lançamento do mês seguinte é criado automaticamente, já pendente, com o mesmo valor.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {form.payment_condition === "installments" && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Intervalo (dias)</Label>
                    <Input
                      type="number"
                      value={form.installment_interval_days}
                      onChange={(e) => setForm(f => ({ ...f, installment_interval_days: Number(e.target.value) }))}
                    />
                  </div>
                  <div>
                    <Label>Data da 1ª Parcela</Label>
                    <Input
                      type="date"
                      value={form.first_installment_date}
                      onChange={(e) => setForm(f => ({ ...f, first_installment_date: e.target.value }))}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="p-6 pt-2 border-t bg-muted/5">
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
