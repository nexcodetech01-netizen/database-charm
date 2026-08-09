import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import {
  Loader2,
  PackageCheck,
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  User,
  ChevronsUpDown,
  Check,
  Plus,
  ChevronDown,
  ChevronUp,
  ShoppingBag,
} from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { PageLayout } from "@/components/layout";
import { useSupplier } from "@/features/suppliers";
import {
  useActiveSuppliersForPurchase,
  useCreatePurchase,
  useSetPurchaseStatus,
  useUpdatePurchase,
} from "../hooks/use-purchases";
import {
  PURCHASE_PAYMENT_TERMS,
  PURCHASE_STATUS_OPTIONS,
  computePurchaseCostMetrics,
  computeTotals,
  type PurchaseItem,
  type PurchaseItemDraft,
  type PurchaseStatus,
  type PurchaseWithItems,
} from "../types";
import { PurchaseItemsEditor } from "./purchase-items-editor";
import { useDraft } from "@/hooks/use-draft";
import { DRAFT_KEYS } from "@/lib/draft-storage";
import { DraftAutosave } from "@/components/feedback/draft-autosave";

interface Props {
  companyId: string;
  purchase?: PurchaseWithItems;
}

const schema = z.object({
  number: z.string().trim().min(1, "Número é obrigatório").max(60),
  purchase_date: z.string().min(1, "Data é obrigatória"),
});

type FormState = {
  number: string;
  supplier_id: string;
  purchase_date: string;
  expected_delivery_date: string;
  payment_terms: string;
  status: string;
  discount: string;
  shipping: string;
  insurance: string;
  other_costs: string;
  notes: string;
};

const NONE = "__none__";

const STATUS_TONE: Record<PurchaseStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending: "bg-warning/10 text-warning border-warning/20",
  received: "bg-success/10 text-success border-success/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function nextNumber() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `PC-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function itemsFromPurchase(items: PurchaseItem[]): PurchaseItemDraft[] {
  return items.map((it) => ({
    id: it.id,
    product_id: it.product_id,
    description: it.description,
    quantity: Number(it.quantity),
    unit_price: Number(it.unit_price),
    discount: Number(it.discount),
  }));
}

export function PurchaseForm({ companyId, purchase }: Props) {
  const navigate = useNavigate();
  const createMut = useCreatePurchase();
  const updateMut = useUpdatePurchase();
  
  const isEdit = !!purchase;
  const { data: suppliers = [] } = useActiveSuppliersForPurchase(companyId);

  const [form, setForm] = useState<FormState>(() => ({
    number: purchase?.number ?? nextNumber(),
    supplier_id: purchase?.supplier_id ?? "",
    purchase_date: purchase?.purchase_date ?? todayISO(),
    expected_delivery_date: purchase?.expected_delivery_date ?? "",
    payment_terms: purchase?.payment_terms ?? "",
    status: purchase?.status ?? "draft",
    discount: String(purchase?.discount ?? 0),
    shipping: String(purchase?.shipping ?? 0),
    insurance: String(purchase?.insurance ?? 0),
    other_costs: String(purchase?.other_costs ?? 0),
    notes: purchase?.notes ?? "",
  }));

  const [items, setItems] = useState<PurchaseItemDraft[]>(
    purchase ? itemsFromPurchase(purchase.items) : [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [supplierPopoverOpen, setSupplierPopoverOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(
    !!purchase?.notes ||
      !!purchase?.expected_delivery_date ||
      !!purchase?.payment_terms ||
      Number(purchase?.insurance ?? 0) > 0,
  );

  // OFFLINE-001 — Rascunho automático (somente em nova compra).
  const draftKey = isEdit ? null : DRAFT_KEYS.purchase(companyId);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryUpdatedAt, setRecoveryUpdatedAt] = useState<number | null>(null);
  const draftCheckedRef = useRef(false);
  const draft = useDraft({
    key: draftKey,
    value: { form, items },
    isEmpty: (v) =>
      v.items.length === 0 &&
      !v.form.supplier_id &&
      !v.form.notes.trim() &&
      Number(v.form.discount) === 0 &&
      Number(v.form.shipping) === 0,
  });
  useEffect(() => {
    if (isEdit || draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    const found = draft.load();
    if (found) {
      setRecoveryUpdatedAt(found.updatedAt);
      setRecoveryOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit]);
  const restoreDraft = () => {
    const found = draft.load();
    if (found?.data) {
      const d = found.data as { form: FormState; items: PurchaseItemDraft[] };
      if (d.form) setForm(d.form);
      if (Array.isArray(d.items)) setItems(d.items);
      toast.success("Rascunho recuperado");
    }
    setRecoveryOpen(false);
  };
  const discardDraft = () => {
    draft.discard();
    setRecoveryOpen(false);
  };

  useEffect(() => {
    if (!purchase) return;
    setForm({
      number: purchase.number,
      supplier_id: purchase.supplier_id ?? "",
      purchase_date: purchase.purchase_date,
      expected_delivery_date: purchase.expected_delivery_date ?? "",
      payment_terms: purchase.payment_terms ?? "",
      status: purchase.status,
      discount: String(purchase.discount ?? 0),
      shipping: String(purchase.shipping ?? 0),
      insurance: String(purchase.insurance ?? 0),
      other_costs: String(purchase.other_costs ?? 0),
      notes: purchase.notes ?? "",
    });
    setItems(itemsFromPurchase(purchase.items));
    setAdvancedOpen(
      !!purchase.notes ||
        !!purchase.expected_delivery_date ||
        !!purchase.payment_terms ||
        Number(purchase.insurance ?? 0) > 0,
    );
  }, [purchase]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const supplierSelected = isEdit ? true : !!form.supplier_id;
  const { data: supplierFull } = useSupplier(form.supplier_id);

  const totals = useMemo(
    () =>
      computeTotals(items, {
        discount: Number(form.discount) || 0,
        shipping: Number(form.shipping) || 0,
        insurance: Number(form.insurance) || 0,
        other_costs: Number(form.other_costs) || 0,
      }),
    [items, form.discount, form.shipping, form.insurance, form.other_costs],
  );

  const costMetrics = useMemo(
    () => computePurchaseCostMetrics(items, totals.grand_total),
    [items, totals.grand_total],
  );

  const selectedSupplier = suppliers.find((s) => s.id === form.supplier_id);
  const statusMeta = PURCHASE_STATUS_OPTIONS.find((o) => o.value === form.status);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse({
      number: form.number,
      purchase_date: form.purchase_date,
    });
    if (!parsed.success) {
      const fe: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        fe[String(i.path[0])] = i.message;
      });
      setErrors(fe);
      return;
    }
    setErrors({});

    if (items.length === 0) {
      toast.error("Adicione ao menos um item");
      return;
    }

    const invalidItem = items.find(
      (it) => !it.description.trim() || it.quantity <= 0,
    );
    if (invalidItem) {
      toast.error("Verifique os itens", {
        description: "Todo item precisa ter descrição e quantidade > 0.",
      });
      return;
    }

    // FLUXO DE PERSISTÊNCIA: A compra é salva com o status selecionado no formulário.
    const persistedStatus = form.status || "draft";
    
    console.log("[PurchaseForm.submit] Status formulário:", form.status, "Status a persistir:", persistedStatus);

    const payload = {
      company_id: companyId,
      number: form.number.trim(),
      supplier_id: form.supplier_id || null,
      purchase_date: form.purchase_date,
      expected_delivery_date: form.expected_delivery_date || null,
      payment_terms: form.payment_terms || null,
      status: persistedStatus,
      discount: Number(form.discount) || 0,
      shipping: Number(form.shipping) || 0,
      insurance: Number(form.insurance) || 0,
      other_costs: Number(form.other_costs) || 0,
      notes: form.notes.trim() || null,
    };

    try {
      let purchaseId: string;
      if (isEdit && purchase) {
        await updateMut.mutateAsync({
          id: purchase.id,
          input: { ...payload, items },
        });
        purchaseId = purchase.id;
      } else {
        const created = await createMut.mutateAsync({ ...payload, items });
        // OFFLINE-001 — compra persistida com sucesso: limpar rascunho.
        draft.discard();
        purchaseId = created.id;
      }

      console.log("[PurchaseForm.submit] Persistência concluída com status:", persistedStatus);


      toast.success(
        isEdit ? "Compra atualizada" : "Compra cadastrada",
      );
      navigate({ to: "/compras/$purchaseId", params: { purchaseId } });
    } catch (err) {
      toast.error("Não foi possível salvar", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    }

  }

  const submitting =
    createMut.isPending || updateMut.isPending;
  const totalUnits = costMetrics.total_qty;
  const extraCosts =
    (Number(form.shipping) || 0) +
    (Number(form.insurance) || 0) +
    (Number(form.other_costs) || 0);

  const supplierLabel =
    selectedSupplier?.name ??
    supplierFull?.name ??
    (supplierSelected ? "Sem fornecedor" : "Selecionar fornecedor…");

  const pageTitle = isEdit ? "Editar compra" : "Nova compra";
  const pageDescription = isEdit
    ? "Atualize itens, custos e dados desta ordem de compra."
    : "Registre entradas de mercadorias e atualize automaticamente o estoque.";

  return (
    <form onSubmit={(e) => submit(e)}>
      <PageLayout
        icon={ShoppingBag}
        title={pageTitle}
        description={pageDescription}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/compras">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Compras
            </Link>
          </Button>
        }
      >
        <div className="space-y-3">
          {/* ============ FORNECEDOR — barra compacta ============ */}
          <div className="rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2 sm:px-4">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Building2 className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <Popover open={supplierPopoverOpen} onOpenChange={setSupplierPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex max-w-full items-center gap-1.5 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span
                        className={cn(
                          "truncate text-sm font-semibold sm:text-base",
                          !supplierSelected ? "text-muted-foreground" : "",
                        )}
                      >
                        {supplierLabel}
                      </span>
                      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[360px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar fornecedor por nome…" />
                      <CommandList>
                        <CommandEmpty>Nenhum fornecedor encontrado.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="sem fornecedor"
                            onSelect={() => {
                              set("supplier_id", "");
                              setSupplierPopoverOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                form.supplier_id === "" ? "opacity-100" : "opacity-0",
                              )}
                            />
                            Sem fornecedor
                          </CommandItem>
                        </CommandGroup>
                        <CommandGroup heading="Ativos">
                          {suppliers.map((s) => (
                            <CommandItem
                              key={s.id}
                              value={s.name}
                              onSelect={() => {
                                set("supplier_id", s.id);
                                setSupplierPopoverOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  form.supplier_id === s.id
                                    ? "opacity-100"
                                    : "opacity-0",
                                )}
                              />
                              {s.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  {supplierFull?.document ? (
                    <span className="font-mono">{supplierFull.document}</span>
                  ) : null}
                  {supplierFull?.contact_name ? (
                    <span className="inline-flex items-center gap-1">
                      <User className="h-3 w-3" /> {supplierFull.contact_name}
                    </span>
                  ) : null}
                  {supplierFull?.phone ? (
                    <span className="inline-flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {supplierFull.phone}
                    </span>
                  ) : null}
                  {supplierFull?.email ? (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {supplierFull.email}
                    </span>
                  ) : null}
                  {!supplierSelected ? (
                    <span>Escolha um fornecedor para começar.</span>
                  ) : null}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSupplierPopoverOpen(true)}
                >
                  Trocar
                </Button>
                <Button asChild type="button" variant="ghost" size="sm">
                  <Link to="/fornecedores/novo">
                    <Plus className="mr-1 h-3.5 w-3.5" /> Novo
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* ============ ITENS — DOMINANTE ============ */}
          <div className="flex min-h-[62vh] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <PurchaseItemsEditor
              companyId={companyId}
              items={items}
              onChange={setItems}
              enabled={supplierSelected}
            />
          </div>

          {/* ============ DADOS ESSENCIAIS — faixa compacta ============ */}
          <div className="rounded-lg border border-border bg-card px-3 py-2.5 sm:px-4">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <CompactField label="Número" error={errors.number}>
                <Input
                  value={form.number}
                  onChange={(e) => set("number", e.target.value)}
                  placeholder="PC-000001"
                  className="mt-0.5 h-8 font-mono text-sm"
                />
              </CompactField>
              <CompactField label="Data" error={errors.purchase_date}>
                <Input
                  type="date"
                  value={form.purchase_date}
                  onChange={(e) => set("purchase_date", e.target.value)}
                  className="mt-0.5 h-8 text-sm"
                />
              </CompactField>
              <CompactField label="Status">
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger className="mt-0.5 h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PURCHASE_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CompactField>
              <CompactField label="Frete">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.shipping}
                  onChange={(e) => set("shipping", e.target.value)}
                  className="mt-0.5 h-8 text-right text-sm tabular-nums"
                />
              </CompactField>
              <CompactField label="Outros">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.other_costs}
                  onChange={(e) => set("other_costs", e.target.value)}
                  className="mt-0.5 h-8 text-right text-sm tabular-nums"
                />
              </CompactField>
              <CompactField label="Desconto">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.discount}
                  onChange={(e) => set("discount", e.target.value)}
                  className="mt-0.5 h-8 text-right text-sm tabular-nums"
                />
              </CompactField>
            </div>
          </div>

          {/* ============ MAIS OPÇÕES — recolhido ============ */}
          <div className="rounded-lg border border-border bg-card">
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium sm:px-4"
            >
              <span>Mais opções</span>
              {advancedOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {advancedOpen ? (
              <div className="space-y-3 border-t border-border p-3 sm:p-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  <CompactField label="Previsão de entrega">
                    <Input
                      type="date"
                      value={form.expected_delivery_date}
                      onChange={(e) => set("expected_delivery_date", e.target.value)}
                      className="mt-0.5 h-8 text-sm"
                    />
                  </CompactField>
                  <CompactField label="Condição de pagamento">
                    <Select
                      value={form.payment_terms || NONE}
                      onValueChange={(v) => set("payment_terms", v === NONE ? "" : v)}
                    >
                      <SelectTrigger className="mt-0.5 h-8 text-sm">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>—</SelectItem>
                        {PURCHASE_PAYMENT_TERMS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CompactField>
                  <CompactField label="Seguro">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.insurance}
                      onChange={(e) => set("insurance", e.target.value)}
                      className="mt-0.5 h-8 text-right text-sm tabular-nums"
                    />
                  </CompactField>
                </div>
                <div>
                  <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Observações internas
                  </Label>
                  <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => set("notes", e.target.value)}
                    placeholder="Anotações internas sobre a compra…"
                    className="mt-1"
                  />
                </div>
              </div>
            ) : null}
          </div>


          {/* ============ RODAPÉ STICKY ============ */}
          <div className="sticky bottom-4 z-10 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:p-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <FooterCell label="Itens" value={`${items.length} · ${totalUnits} un.`} />
              <FooterCell label="Subtotal" value={formatCurrency(totals.items_total)} />
              <FooterCell
                label="Desconto"
                value={formatCurrency(Number(form.discount) || 0)}
                muted
              />
              <FooterCell
                label="Frete"
                value={formatCurrency(Number(form.shipping) || 0)}
                muted
              />
              <FooterCell
                label="Outros"
                value={formatCurrency(extraCosts - (Number(form.shipping) || 0))}
                muted
              />
              {statusMeta ? (
                <div className="flex flex-col">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    Status
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      "mt-1 w-fit",
                      STATUS_TONE[form.status as PurchaseStatus] ?? "",
                    )}
                  >
                    {statusMeta.label}
                  </Badge>
                </div>
              ) : null}

              <div className="ml-auto flex items-center gap-6 border-l border-border pl-6">
                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Total da compra
                  </span>
                  <span className="text-3xl font-bold leading-none tabular-nums text-primary sm:text-4xl">
                    {formatCurrency(totals.grand_total)}
                  </span>
                  {costMetrics.total_qty > 0 ? (
                    <span className="mt-1 text-[11px] text-muted-foreground">
                      Custo médio unit.:{" "}
                      <span className="tabular-nums">
                        {formatCurrency(costMetrics.avg_unit_cost)}
                      </span>
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate({ to: "/compras" })}
                    disabled={submitting}
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={submitting}
                  >
                    {submitting ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : null}
                    {isEdit ? "Salvar alterações" : "Salvar rascunho"}
                  </Button>
                  {/* 
                    O botão de "Finalizar Compra" foi removido do formulário 
                    para garantir que o recebimento atômico ocorra apenas 
                    por ação explícita na tela de detalhes, evitando disparos automáticos.
                  */}
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageLayout>
      <DraftAutosave
        savedAt={draft.savedAt}
        recovery={
          !isEdit
            ? {
                open: recoveryOpen,
                onOpenChange: setRecoveryOpen,
                title: "Compra em andamento",
                description:
                  "Foi encontrada uma compra em andamento. Deseja continuar?",
                updatedAt: recoveryUpdatedAt,
                onRestore: restoreDraft,
                onDiscard: discardDraft,
              }
            : undefined
        }
      />
    </form>
  );
}


function CompactField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function FooterCell({
  label,
  value,
  muted,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-semibold tabular-nums sm:text-base",
          muted ? "text-muted-foreground" : "",
        )}
      >
        {value}
      </span>
    </div>
  );
}
