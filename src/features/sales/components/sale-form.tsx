import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, Link, useLocation } from "@tanstack/react-router";
import {
  Loader2,
  AlertTriangle,
  User,
  Check,
  ChevronsUpDown,
  Mail,
  Phone,
  ShoppingCart,
  ArrowLeft,
  Sparkles,
  UserPlus,
  FileText,
  Settings2,
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
import { productImagesService } from "@/features/products/services/product-images.service";
import { PageLayout } from "@/components/layout";
import { useCustomer } from "@/features/customers";
import {
  useActiveCustomersForSale,
  useCreateSale,
  useUpdateSale,
  useSetSaleStatus,
} from "../hooks/use-sales";
import { SaleEngine, type SaleDraftState } from "../engine";
import {

  SALE_PAYMENT_METHODS,
  SALE_STATUS_OPTIONS,
  computeTotals,
  type SaleItem,
  type SaleItemDraft,
  type SaleWithItems,
} from "../types";
import { SaleItemsEditor } from "./sale-items-editor";
import { supabase } from "@/integrations/supabase/client";
import { CheckoutDialog } from "./checkout-dialog";
import { useAuth } from "@/providers/auth-provider";
import { cashService } from "@/features/cash/services/cash.service";
import { useCashGuard } from "@/features/cash";
import {
  useDiscountPolicy,
  evaluateDiscount,
  type DiscountPolicy,
} from "../lib/discount-policy";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useDraft } from "@/hooks/use-draft";
import { useCompanyToday } from "@/hooks/use-company-today";
import { DRAFT_KEYS } from "@/lib/draft-storage";
import { executeWithUndo } from "@/lib/undo-manager";
import { DraftAutosave } from "@/components/feedback/draft-autosave";
import {
  computeStockInsufficiencies,
  formatInsufficiencyMessage,
  type StockInsufficiency,
} from "../lib/stock-validation";
import {
  isSaleDraftEmpty,
  resolveInProgressSaleDraft,
} from "../lib/sale-draft";



export interface SaleFormPrefillItem {
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

/**
 * Pré-preenchimento externo (ex.: Inbox WhatsApp → Nova Venda).
 * É apenas estado inicial do formulário: nada é persistido até o operador
 * finalizar a venda pelo fluxo oficial.
 */
export interface SaleFormPrefill {
  customerId?: string | null;
  notes?: string | null;
  items: SaleFormPrefillItem[];
}

interface Props {
  companyId: string;
  sale?: SaleWithItems;
  title?: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  /** Se informado, adiciona automaticamente o produto ao carrinho (qtd. 1). */
  initialProductId?: string;
  prefill?: SaleFormPrefill;
  /** Chamado SOMENTE após a venda ser criada com sucesso pelo fluxo oficial. */
  onSaleCreated?: (saleId: string) => void;
}


// TZ-002 — `sale_date` NÃO é editável pelo operador. Representa exclusivamente
// a data em que a venda ocorreu e é resolvida pela data operacional da empresa
// (`company_today`) / trigger `trg_set_sale_date_company_today` no banco.
// Vencimento/previsão de recebimento usam `due_date` (tela de detalhe da venda).
// Cenário futuro (não implementado): venda retroativa mediante permissão
// administrativa — exigirá campo liberado por role + auditoria.
const schema = z.object({
  number: z.string().trim().min(1, "Número é obrigatório").max(60),
});

type FormState = {
  number: string;
  customer_id: string;
  sale_date: string;
  payment_method: string;
  status: string;
  discount: string;
  shipping: string;
  notes: string;
};

const NONE = "__none__";

function nextNumber() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `VD-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function itemsFromSale(items: SaleItem[]): SaleItemDraft[] {
  return items.map((it) => ({
    ui_key: it.id,
    id: it.id,
    product_id: it.product_id,
    description: it.description,
    quantity: Number(it.quantity),
    unit_price: Number(it.unit_price),
    discount: Number(it.discount),
  }));
}

export function SaleForm({
  companyId,
  sale,
  title,
  description,
  backHref = "/vendas",
  backLabel = "Vendas",
  initialProductId,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const createMut = useCreateSale();
  const updateMut = useUpdateSale();
  const setStatusMut = useSetSaleStatus();
  const isEdit = !!sale;
  const { user } = useAuth();
  const { requestOpenCash, cashGuardDialog } = useCashGuard({ companyId });
  const { data: customers = [] } = useActiveCustomersForSale(companyId);
  // TZ-001 — data operacional da empresa (company_today no servidor).
  // Nunca derivar sale_date de UTC no browser.
  const { companyToday } = useCompanyToday(companyId);


  const [form, setForm] = useState<FormState>(() => ({
    number: sale?.number ?? nextNumber(),
    customer_id: sale?.customer_id ?? "",
    sale_date: sale?.sale_date ?? "",
    payment_method: sale?.payment_method ?? "pix_manual",
    status: sale?.status ?? "draft",
    discount: String(sale?.discount ?? 0),
    shipping: String(sale?.shipping ?? 0),
    notes: sale?.notes ?? "",
  }));

  // TZ-001 — preenche a data operacional assim que o servidor responde
  // (apenas para vendas novas / campo ainda vazio).
  useEffect(() => {
    if (!companyToday) return;
    setForm((f) => (f.sale_date ? f : { ...f, sale_date: companyToday }));
  }, [companyToday]);

  const [items, setItems] = useState<SaleItemDraft[]>(
    sale ? itemsFromSale(sale.items) : [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customerPopoverOpen, setCustomerPopoverOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showNotes, setShowNotes] = useState(!!sale?.notes);
  const [checkout, setCheckout] = useState<{
    saleId: string;
    saleNumber: string | null;
    customerId: string | null;
    amount: number;
  } | null>(null);
  const skipNavigateOnCloseRef = useRef(false);
  const [stockIssues, setStockIssues] = useState<
    StockInsufficiency<SaleItemDraft>[]
  >([]);
  const [revalidatingStock, setRevalidatingStock] = useState(false);
  const stockValidationEpochRef = useRef(0);
  const [returningToItems, setReturningToItems] = useState(false);

  // Pré-seleção de produto vindo por query string (?productId=...). Adiciona
  // uma única vez o produto ao carrinho com quantidade 1 quando é uma nova
  // venda e o carrinho ainda está vazio.
  const preselectedRef = useRef<string | null>(null);
  useEffect(() => {
    if (isEdit || !initialProductId) return;
    if (preselectedRef.current === initialProductId) return;
    if (items.length > 0) return;
    preselectedRef.current = initialProductId;
    (async () => {
      const { data } = await supabase
        .from("products")
        .select(
          "id,name,sku,price,cost,stock,unit,cover_image_path,category:product_categories(min_margin_pct,target_margin_pct,default_discount_pct)",
        )
        .eq("id", initialProductId)
        .maybeSingle();
      if (!data) return;
      const cat = (data as {
        category?: {
          min_margin_pct?: number | null;
          target_margin_pct?: number | null;
          default_discount_pct?: number | null;
        } | null;
      }).category ?? null;
      const unitPrice = data.price != null ? Number(data.price) : 0;
      const discountPct = cat?.default_discount_pct != null ? Number(cat.default_discount_pct) : 0;
      const discount = discountPct > 0 ? Math.max(0, (unitPrice * discountPct) / 100) : 0;
      const imageUrl = data.cover_image_path
        ? await productImagesService
            .signedUrl(data.cover_image_path)
            .catch(() => null)
        : null;
      setItems((curr) =>
        curr.length > 0
          ? curr
          : [
              {
                ui_key:
                  globalThis.crypto?.randomUUID?.() ??
                  `item-${Date.now()}-${Math.random()}`,
                product_id: data.id,
                description: data.name,
                quantity: 1,
                unit_price: unitPrice,
                discount,
                sku: data.sku,
                image_url: imageUrl,
                unit_cost: data.cost != null ? Number(data.cost) : null,
                stock_available: data.stock != null ? Number(data.stock) : null,
                unit: data.unit ?? null,
                min_margin_pct: cat?.min_margin_pct != null ? Number(cat.min_margin_pct) : null,
                target_margin_pct: cat?.target_margin_pct != null ? Number(cat.target_margin_pct) : null,
                default_discount_pct: cat?.default_discount_pct != null ? Number(cat.default_discount_pct) : null,
              },
            ],
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProductId, isEdit]);


  // OFFLINE-001 — Rascunho automático (somente em nova venda).
  const draftKey = isEdit ? null : DRAFT_KEYS.sale(companyId);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryUpdatedAt, setRecoveryUpdatedAt] = useState<number | null>(null);
  const draftCheckedRef = useRef(false);
  // BUG-PDV-016 — após criar a venda, o autosave (debounce 600ms) ainda
  // disparava com `items` populados e regravava o rascunho depois do
  // `draft.discard()`. Na próxima "Nova venda" o modal "Venda em andamento"
  // reaparecia falsamente. Desligamos o autosave assim que a venda é
  // persistida; `resetForNewSale` religa.
  const [autosaveDisabled, setAutosaveDisabled] = useState(false);
  const draft = useDraft({
    key: draftKey,
    enabled: !autosaveDisabled,
    value: { form, items },
    isEmpty: (v) => isSaleDraftEmpty(v),
  });
  useEffect(() => {
    if (isEdit || draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    if (!companyId) return;
    let cancelled = false;
    void resolveInProgressSaleDraft(companyId, async (saleNumber) => {
      const { data, error } = await supabase
        .from("sales")
        .select(
          "id,status,paid_at,payment_confirmed_at,created_at,updated_at",
        )
        .eq("company_id", companyId)
        .eq("number", saleNumber)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("[sale-draft] falha ao validar origem no banco", {
          sale_id: null,
          status: null,
          draft: true,
          completed_at: null,
          payment_status: null,
          created_at: null,
          updated_at: null,
          origem: "banco",
          error: error.message,
        });
        return null;
      }
      if (!data) return null;
      return {
        sale_id: data.id,
        status: data.status,
        completed_at: data.paid_at,
        payment_status:
          data.status === "paid" || data.payment_confirmed_at
            ? "paid"
            : data.status === "cancelled"
              ? "cancelled"
              : "pending",
        created_at: data.created_at,
        updated_at: data.updated_at,
      };
    }).then((found) => {
      if (cancelled || !found) return;
      setRecoveryUpdatedAt(found.updatedAt);
      setRecoveryOpen(true);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, companyId]);
  const restoreDraft = () => {
    const found = draft.load();
    if (found?.data) {
      const d = found.data as { form: FormState; items: SaleItemDraft[] };
      if (d.form) setForm(d.form);
       if (Array.isArray(d.items)) {
         setItems(
           d.items.map((item) => ({
             ...item,
             ui_key:
               item.ui_key ??
               item.id ??
               globalThis.crypto?.randomUUID?.() ??
               `item-${Date.now()}-${Math.random()}`,
           })),
         );
       }
      setShowNotes(!!d.form?.notes);
      toast.success("Rascunho recuperado");
    }
    setRecoveryOpen(false);
  };
  const discardDraft = useCallback(() => {
    // BUG-PDV-017 — "Descartar" precisa eliminar TODOS os vestígios da venda
    // em andamento: o autosave em debounce, o rascunho em localStorage, o
    // estado local do formulário, um eventual rascunho órfão no banco (criado
    // por "Ir para pagamento" e abandonado) e o cache do React Query.

    // 1) Desliga o autosave ANTES de qualquer setState — impede que o debounce
    //    de 600ms regrave o rascunho com o snapshot atual do formulário.
    setAutosaveDisabled(true);

    // 2) Captura o rascunho local antes de removê-lo para tentar limpar um
    //    possível registro órfão no banco (mesmo número, status='draft').
    const previous = draft.load() as
      | { data: { form?: FormState } | null }
      | null;
    const previousNumber = previous?.data?.form?.number?.trim() ?? null;

    // 3) Remove o rascunho local (localStorage).
    draft.discard();

    // 4) Reseta o estado em memória para o estado "nova venda vazia".
    setItems([]);
    setErrors({});
    setShowNotes(false);
    setShowAdvanced(false);
    setForm({
      number: nextNumber(),
      customer_id: "",
      sale_date: companyToday ?? "",
      payment_method: "pix_manual",
      status: "draft",
      discount: "0",
      shipping: "0",
      notes: "",
    });

    // 5) Impede que o modal de recuperação reabra neste mount.
    draftCheckedRef.current = true;
    setRecoveryOpen(false);
    setRecoveryUpdatedAt(null);

    // 6) Melhor esforço: apaga rascunho persistido no banco (venda com o
    //    mesmo número em status='draft'). Não bloqueia a UX.
    if (previousNumber) {
      void (async () => {
        try {
          const { data: orphans, error } = await supabase
            .from("sales")
            .select("id")
            .eq("company_id", companyId)
            .eq("status", "draft")
            .eq("number", previousNumber);
          if (error || !orphans?.length) return;
          for (const row of orphans) {
            await supabase.rpc("delete_sale", { _sale_id: row.id });
          }
        } catch {
          /* noop — limpeza silenciosa */
        } finally {
          // 7) Atualiza apenas resumos. Invalidar ["sales"] também refaria
          // qualquer detalhe/editor de venda montado em outra árvore.
          void queryClient.invalidateQueries({ queryKey: ["sales", "list"] });
          void queryClient.invalidateQueries({ queryKey: ["sales", "metrics"] });
        }
      })();
    } else {
      void queryClient.invalidateQueries({ queryKey: ["sales", "list"] });
      void queryClient.invalidateQueries({ queryKey: ["sales", "metrics"] });
    }

    // 8) Religa o autosave após a janela do debounce (600ms) para que
    //    edições futuras voltem a ser salvas normalmente.
    window.setTimeout(() => setAutosaveDisabled(false), 800);
  }, [draft, companyId, queryClient]);


  // PDV-015 — Política de descontos (UX-only, localStorage por empresa).
  const [discountPolicy] = useDiscountPolicy(companyId);
  const [discountOverride, setDiscountOverride] = useState(false);
  const [discountApprovalOpen, setDiscountApprovalOpen] = useState(false);
  // UX-AR — confirmação explícita da venda "A Receber" (não altera regra financeira).
  const [receivableConfirmOpen, setReceivableConfirmOpen] = useState(false);
  const [managerName, setManagerName] = useState("");

  // Reseta a autorização se operador trocar método de pagamento ou o valor.
  useEffect(() => {
    setDiscountOverride(false);
  }, [form.payment_method, form.discount]);



  function resetForNewSale() {
    skipNavigateOnCloseRef.current = true;
    setCheckout(null);
    setItems([]);
    setErrors({});
    setShowNotes(false);
    setShowAdvanced(false);
    setForm({
      number: nextNumber(),
      customer_id: "",
      sale_date: companyToday ?? "",
      payment_method: "pix_manual",
      status: "draft",
      discount: "0",
      shipping: "0",
      notes: "",
    });
    // Garante limpeza total: remove qualquer rascunho residual e religa o
    // autosave para a próxima venda.
    draft.discard();
    draftCheckedRef.current = true; // não reabrir o modal de recuperação
    setRecoveryOpen(false);
    setRecoveryUpdatedAt(null);
    setAutosaveDisabled(false);
    toast.success("Pronto para a próxima venda");
  }

  // BUG-PDV-011 — só re-hidrata o formulário quando o ID da venda muda.
  // Depender de `sale` (objeto) causava reset a cada refetch/invalidate
  // (useSetSaleStatus, useUpdateSale) — potencial loop se combinado com
  // mutações downstream. Chave por id evita re-inicialização a cada tick.
  const hydratedForSaleIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!sale) return;
    if (hydratedForSaleIdRef.current === sale.id) return;
    hydratedForSaleIdRef.current = sale.id;
    setForm({
      number: sale.number,
      customer_id: sale.customer_id ?? "",
      sale_date: sale.sale_date,
      payment_method: sale.payment_method ?? "",
      status: sale.status,
      discount: String(sale.discount ?? 0),
      shipping: String(sale.shipping ?? 0),
      notes: sale.notes ?? "",
    });
    setItems(itemsFromSale(sale.items));
    setShowNotes(!!sale.notes);
  }, [sale]);

  /**
   * "Continuar venda" — quando o operador volta ao editor de uma venda
   * já persistida, `sale.items` traz apenas os campos persistidos
   * (id/product_id/description/quantity/unit_price/discount). Para o PDV
   * funcionar por completo (miniatura, custo/margem, estoque disponível,
   * política de desconto da categoria) precisamos re-hidratar as
   * informações transientes a partir de `products` + `product_categories`.
   * Não persiste nada — apenas enriquece o estado local do editor.
   */
  const enrichedForSaleIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!sale) return;
    if (enrichedForSaleIdRef.current === sale.id) return;
    if (!sale.items?.length) return;
    enrichedForSaleIdRef.current = sale.id;

    const productIds = Array.from(
      new Set(
        sale.items
          .map((it) => it.product_id)
          .filter((v): v is string => !!v),
      ),
    );
    if (productIds.length === 0) return;

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id,sku,cost,stock,unit,cover_image_path,category:product_categories(min_margin_pct,target_margin_pct,default_discount_pct)",
        )
        .in("id", productIds);
      if (cancelled || error || !data) return;

      const byId = new Map(data.map((p) => [p.id, p]));
      const paths = data
        .map((p) => p.cover_image_path)
        .filter((v): v is string => !!v);
      const signed = paths.length
        ? await productImagesService.signedUrls(paths)
        : [];
      if (cancelled) return;
      const imageMap = new Map(signed.map((s) => [s.path, s.signedUrl]));

      setItems((curr) =>
        curr.map((it) => {
          if (!it.product_id) return it;
          const p = byId.get(it.product_id);
          if (!p) return it;
          const cat =
            (p as unknown as {
              category?: {
                min_margin_pct: number | null;
                target_margin_pct: number | null;
                default_discount_pct: number | null;
              } | null;
            }).category ?? null;
          return {
            ...it,
            sku: p.sku ?? it.sku ?? null,
            unit_cost:
              p.cost != null ? Number(p.cost) : (it.unit_cost ?? null),
            stock_available:
              p.stock != null
                ? Number(p.stock)
                : (it.stock_available ?? null),
            unit: p.unit ?? it.unit ?? null,
            image_url: p.cover_image_path
              ? (imageMap.get(p.cover_image_path) ?? it.image_url ?? null)
              : (it.image_url ?? null),
            min_margin_pct:
              cat?.min_margin_pct != null
                ? Number(cat.min_margin_pct)
                : (it.min_margin_pct ?? null),
            target_margin_pct:
              cat?.target_margin_pct != null
                ? Number(cat.target_margin_pct)
                : (it.target_margin_pct ?? null),
            default_discount_pct:
              cat?.default_discount_pct != null
                ? Number(cat.default_discount_pct)
                : (it.default_discount_pct ?? null),
          };
        }),
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [sale]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const totals = useMemo(
    () =>
      computeTotals(items, {
        discount: Number(form.discount) || 0,
        shipping: Number(form.shipping) || 0,
      }),
    [items, form.discount, form.shipping],
  );

  // Insuficiências calculadas em tempo real com os valores locais do carrinho
  // (indicador visual antes mesmo do usuário clicar em "Continuar").
  const localStockIssues = useMemo(
    () => computeStockInsufficiencies(items),
    [items],
  );
  const insufficientStockCount = localStockIssues.length;
  // Une insuficiências locais + revalidação servidor (sem duplicar por product_id).
  const displayedStockIssues = useMemo(() => {
    const map = new Map<string, StockInsufficiency<SaleItemDraft>>();
    for (const i of localStockIssues) {
      const key = i.item.product_id ?? `${i.item.description}-${map.size}`;
      map.set(key, i);
    }
    for (const i of stockIssues) {
      const key = i.item.product_id ?? `${i.item.description}-${map.size}`;
      map.set(key, i); // servidor tem precedência
    }
    return [...map.values()];
  }, [localStockIssues, stockIssues]);

  const selectedCustomer = customers.find((c) => c.id === form.customer_id);
  const { data: customerFull } = useCustomer(form.customer_id);

  async function submit(e: React.FormEvent, finalize: boolean) {
    e.preventDefault();
    const parsed = schema.safeParse({
      number: form.number,
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

    // Cliente é obrigatório: sem cliente cadastrado, a venda não pode ser
    // salva (rascunho, finalização ou retomada de pagamento).
    if (!form.customer_id) {
      toast.error("É obrigatório selecionar um cliente para salvar a venda");
      setCustomerPopoverOpen(true);
      return;
    }


    if (finalize) {
      if (returningToItems) {
        console.warn("[sale-form] checkout bloqueado durante restauração", {
          saleId: sale?.id ?? null,
          pathname: location.pathname,
        });
        toast.info("Aguarde a venda voltar para edição");
        return;
      }
      // Regra no SaleEngine — a tela só traduz a decisão em toast.
      const itemsCheck = SaleEngine.validateItems(items);
      if (!itemsCheck.ok) {
        if (itemsCheck.code === "no_items") {
          toast.error(itemsCheck.message);
        } else {
          toast.error("Verifique os itens", {
            description: itemsCheck.message,
          });
        }
        return;
      }


      // Validação de estoque — bloqueia checkout se algum item estiver
      // acima do disponível. Revalida contra o banco para pegar consumo
      // concorrente de outro operador. Também usado pelo servidor em
      // `createAsaasCharge` para blindar contra bypass de UI.
      const productIds = items
        .map((it) => it.product_id)
        .filter((id): id is string => !!id);
      let freshStock = new Map<string, number | null>();
      if (productIds.length > 0) {
        const validationEpoch = ++stockValidationEpochRef.current;
        setRevalidatingStock(true);
        const { data: freshRows, error: freshErr } = await supabase
          .from("products")
          .select("id,stock")
          .in("id", productIds);
        if (validationEpoch !== stockValidationEpochRef.current) {
          console.warn("[sale-form] validação de estoque obsoleta descartada", {
            saleId: sale?.id ?? null,
            validationEpoch,
          });
          return;
        }
        setRevalidatingStock(false);
        if (freshErr) {
          console.error("[sale-form] stock revalidation failed", {
            companyId,
            productIds,
            error: freshErr.message,
          });
          toast.error("Não foi possível validar o estoque", {
            description: "Tente novamente em instantes.",
          });
          return;
        }
        freshStock = new Map(
          (freshRows ?? []).map((r) => [
            r.id as string,
            r.stock != null ? Number(r.stock) : null,
          ]),
        );
        // Atualiza stock_available local com o valor mais recente (o card
        // do item passa a mostrar o estoque real).
        setItems((curr) =>
          curr.map((it) =>
            it.product_id && freshStock.has(it.product_id)
              ? { ...it, stock_available: freshStock.get(it.product_id) ?? null }
              : it,
          ),
        );
      }
      const insufficient = computeStockInsufficiencies(items, freshStock);
      // eslint-disable-next-line no-console
      console.info("[sale-form] ETAPA estoque", {
        items: items.length,
        insufficient: insufficient.length,
      });
      setStockIssues(insufficient);
      if (insufficient.length > 0) {
        // Métrica/log estruturado para diagnóstico (bypass, drift, race).
        console.warn("[sale-form] blocked checkout: insufficient stock", {
          companyId,
          saleNumber: form.number,
          issues: insufficient.map((i) => ({
            product_id: i.item.product_id,
            description: i.item.description,
            requested: i.requested,
            available: i.available,
            shortage: i.shortage,
          })),
        });
        toast.error("Estoque insuficiente", {
          description: `Ajuste os itens antes de prosseguir: ${formatInsufficiencyMessage(insufficient)}.`,
        });
        return;
      }
      // Limpa o estado de erro caso tenha havido tentativa anterior.
      if (stockIssues.length > 0) setStockIssues([]);
    }

    // PDV-015 — Aplica política de descontos antes de qualquer persistência.
    const discountEval = evaluateDiscount({
      subtotal: totals.items_total,
      discountValue: Number(form.discount) || 0,
      paymentMethod: form.payment_method,
      policy: discountPolicy,
      overrideApproved: discountOverride,
    });
    if (discountEval.kind === "disabled_by_method") {
      toast.error("Desconto não permitido para esta forma de pagamento", {
        description: discountEval.reason,
      });
      return;
    }
    if (discountEval.kind === "exceeds") {
      if (discountEval.enforcement === "block") {
        toast.error("Desconto acima do limite", {
          description: `O limite é ${discountPolicy.maxPercent}%.`,
        });
        return;
      }
      if (discountEval.enforcement === "request_manager") {
        toast.error("Este desconto exige autorização", {
          description: "Solicite a autorização do gerente para prosseguir.",
        });
        setDiscountApprovalOpen(true);
        return;
      }
    }



    // A forma de pagamento é escolhida no Checkout.

    // HOTFIX-002: Caixa isolado por sessão.
    // Ao abrir o Checkout (finalize), a venda precisa ser vinculada à sessão
    // de caixa aberta do operador. Sem caixa aberto: bloqueia a criação.
    let cashSessionId: string | null = isEdit ? (sale?.cash_session_id ?? null) : null;
    if (!isEdit) {
      if (!user?.id) {
        toast.error("Sessão inválida", {
          description: "Faça login novamente para registrar a venda.",
        });
        return;
      }
      try {
        const openSession = await cashService.getOpenSession(companyId, user.id);
        // eslint-disable-next-line no-console
        console.info("[sale-form] ETAPA caixa", {
          companyId,
          openSessionId: openSession?.id ?? null,
        });
        if (!openSession) {
          // UX-CAIXA-001 — em vez de apenas avisar, oferecemos a abertura do
          // caixa e retomamos a venda automaticamente depois.
          requestOpenCash(() =>
            submit(
              { preventDefault: () => {} } as unknown as React.FormEvent,
              finalize,
            ),
          );
          return;
        }
        const { isSessionStale, staleSessionMessage } = await import(
          "@/features/cash/lib/session-day"
        );
        if (isSessionStale(openSession)) {
          toast.error(staleSessionMessage(openSession), {
            action: {
              label: "Fechar caixa",
              onClick: () => navigate({ to: "/caixa" }),
            },
          });
          return;
        }
        cashSessionId = openSession.id;

      } catch (err) {
        toast.error("Não foi possível validar o caixa", {
          description: err instanceof Error ? err.message : String(err),
        });
        return;
      }
    }


    // Ao finalizar, gravamos como "pending" (ou mantém o status atual em edição)
    // e abrimos o Checkout. A transição para "paid" acontece no CheckoutDialog
    // após confirmação do meio de pagamento (via webhook ou baixa manual).
    //
    // Exceção "A Receber": a venda é registrada como pendente (aguardando
    // pagamento) e o Checkout é ignorado. Um trigger em banco baixa o estoque
    // e cria automaticamente o lançamento em Contas a Receber. Como o trigger
    // depende dos itens já persistidos, primeiro gravamos como "draft" e só
    // então promovemos o status para "pending".
    // Status e payload são resolvidos pelo SaleEngine (mesma regra de
    // antes, agora compartilhável com o PDV).
    const engineState: SaleDraftState = {
      number: form.number,
      customerId: form.customer_id,
      paymentMethod: form.payment_method,
      status: form.status,
      discount: Number(form.discount) || 0,
      shipping: Number(form.shipping) || 0,
      notes: form.notes,
      items,
    };
    const isReceivable = SaleEngine.needsReceivablePromotion(
      engineState,
      finalize,
    );
    // TZ-002 — `sale_date` nunca é enviado pela UI:
    // • criação → trigger `trg_set_sale_date_company_today` resolve via company_today();
    // • edição  → a data original da venda é preservada (nunca sobrescrita).
    // String vazia é removida por salesService.create/update antes do INSERT.
    const payload = SaleEngine.buildPayload(engineState, {
      companyId,
      finalize,
      isEdit,
      persistedStatus: sale?.status ?? null,
      cashSessionId,
    });




    try {
      let savedId: string;
      let savedNumber: string | null;
      if (isEdit && sale) {
        await updateMut.mutateAsync({
          id: sale.id,
          input: { ...payload, items },
        });
        savedId = sale.id;
        savedNumber = sale.number;
      } else {
        // eslint-disable-next-line no-console
        console.info("[sale-form] ENTRADA create", {
          number: payload.number,
          cash_session_id: payload.cash_session_id,
          items: items.length,
          finalize,
        });
        const created = await createMut.mutateAsync({ ...payload, items });
        savedId = created.id;
        savedNumber = created.number ?? null;
        // eslint-disable-next-line no-console
        console.info("[sale-form] COMMIT create", {
          sale_id: savedId,
          number: savedNumber,
        });
        toast.success(
          `Venda ${savedNumber ?? payload.number} criada com sucesso.`,
        );
        // OFFLINE-001 / BUG-PDV-016 — venda persistida: desliga o autosave
        // ANTES de qualquer setState (para o debounce não regravar) e
        // apaga o rascunho existente.
        setAutosaveDisabled(true);
        draft.discard();
      }

      // A Receber — promove para "pending" após os itens estarem gravados,
      // o que dispara o trigger `apply_receivable_sale` (baixa de estoque +
      // criação do Contas a Receber pendente).
      if (isReceivable) {
        await setStatusMut.mutateAsync({ id: savedId, status: "pending" });
      }

      if (finalize) {
        if (isReceivable) {
          toast.success("Venda registrada como A Receber", {
            description:
              "Estoque baixado e lançamento criado em Contas a Receber.",
          });
          navigate({ to: "/vendas/$saleId", params: { saleId: savedId } });
        } else {
          setCheckout({
            saleId: savedId,
            saleNumber: savedNumber,
            customerId: form.customer_id,
            amount: totals.grand_total,
          });
        }
      } else {
        if (isEdit) toast.success("Venda atualizada");
        navigate({ to: "/vendas/$saleId", params: { saleId: savedId } });
      }
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      // eslint-disable-next-line no-console
      console.error("[sale-form] ERRO save", { payload, items: items.length, err });
      toast.error("Não foi possível salvar a venda", {
        description: rawMessage,

      });
    }
  }

  const submitting = createMut.isPending || updateMut.isPending;
  const totalUnits = items.reduce((s, i) => s + (i.quantity || 0), 0);

  /**
   * BUG-PDV-020 — Ao voltar do checkout e adicionar/alterar itens, qualquer
   * validação antiga (estoque, aprovação de desconto), o checkout residual e
   * o cache de detalhe da venda precisam ser explicitamente descartados. Sem
   * isso, o próximo "Ir para pagamento" reabre o checkout com um payload
   * inconsistente (preço/tax quote recomputado sobre dados stale) e a árvore
   * do CheckoutDialog quebra silenciosamente.
   */
  const resetCheckoutDerivedState = useCallback(() => {
    stockValidationEpochRef.current += 1;
    setCheckout(null);
    setStockIssues([]);
    setRevalidatingStock(false);
    setDiscountOverride(false);
    setDiscountApprovalOpen(false);
    setManagerName("");
    if (sale?.id) {
      void queryClient.cancelQueries({
        queryKey: ["checkout", "sale-poll", sale.id],
      });
      void queryClient.cancelQueries({
        queryKey: ["checkout", "cash-open", sale.id],
      });
    }
  }, [queryClient, sale?.id]);

  const handleItemsChange = useCallback(
    (next: SaleItemDraft[]) => {
      const changed =
        next.length !== items.length ||
        next.some((item, index) => {
          const previous = items[index];
          return (
            !previous ||
            previous.ui_key !== item.ui_key ||
            previous.product_id !== item.product_id ||
            previous.quantity !== item.quantity ||
            previous.unit_price !== item.unit_price ||
            previous.discount !== item.discount ||
            previous.description !== item.description
          );
        });
      if (!changed) return;

      // Nunca execute setState/invalidação dentro do updater de `setItems`.
      // React pode repetir updaters durante render concorrente, causando o loop.
      resetCheckoutDerivedState();
      setItems(next);
    },
    [items, resetCheckoutDerivedState],
  );





  const pageTitle = title ?? (isEdit ? "Editar venda" : "Nova venda");
  const pageDescription =
    description ??
    (isEdit
      ? "Atualize itens, pagamento e dados desta venda."
      : "Busque produtos e finalize com poucos cliques.");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(e, false);
      }}
    >
      <PageLayout
        icon={ShoppingCart}
        title={pageTitle}
        description={pageDescription}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to={backHref}>
              <ArrowLeft className="mr-1.5 h-4 w-4" /> {backLabel}
            </Link>
          </Button>
        }
      >
        <div className="space-y-3">
          {/* ============ CLIENTE — combobox único ============ */}
          <div className="rounded-xl border border-border bg-card p-2 sm:p-3">
            <Popover open={customerPopoverOpen} onOpenChange={setCustomerPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <User className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "truncate text-base font-semibold sm:text-lg",
                          !selectedCustomer ? "text-muted-foreground" : "",
                        )}
                      >
                        {selectedCustomer?.name ?? "Selecionar cliente *"}
                      </span>
                      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-70 group-hover:opacity-100" />
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                      {!selectedCustomer ? (
                        <span className="text-destructive">
                          Obrigatório para salvar a venda
                        </span>
                      ) : (
                        <>
                          {customerFull?.document ? (
                            <span className="font-mono">{customerFull.document}</span>
                          ) : null}
                          {customerFull?.phone ? (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="h-3 w-3" /> {customerFull.phone}
                            </span>
                          ) : null}
                          {customerFull?.email ? (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="h-3 w-3" /> {customerFull.email}
                            </span>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(420px,calc(100vw-2rem))] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Buscar cliente por nome…" />
                  <CommandList>
                    <CommandEmpty>

                      <div className="flex flex-col items-center gap-2 py-3 text-center">
                        <span className="text-sm">Nenhum cliente encontrado.</span>
                        <Button asChild variant="outline" size="sm">
                          <Link to="/clientes/novo">
                            <UserPlus className="mr-1.5 h-3.5 w-3.5" /> Cadastrar novo
                          </Link>
                        </Button>
                      </div>
                    </CommandEmpty>
                    <CommandGroup heading="Ativos">

                      {customers.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.name}
                          onSelect={() => {
                            set("customer_id", c.id);
                            setCustomerPopoverOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              form.customer_id === c.id ? "opacity-100" : "opacity-0",
                            )}
                          />
                          {c.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>


                    <CommandGroup>
                      <CommandItem asChild value="__new__">
                        <Link to="/clientes/novo" className="cursor-pointer">
                          <UserPlus className="mr-2 h-4 w-4" /> Cadastrar novo cliente
                        </Link>
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>


          {/* ============ BUSCA + ITENS ============ */}
          <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
            <SaleItemsEditor
              companyId={companyId}
              items={items}
              onChange={handleItemsChange}
              enabled
            />
          </div>

          {/* ============ PAGAMENTO — linha única ============ */}
          <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
            <div className="grid gap-3 sm:grid-cols-4">
              <div>
                <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Forma de pagamento
                </Label>
                <Select
                  value={form.payment_method || NONE}
                  onValueChange={(v) =>
                    set("payment_method", v === NONE ? "" : v)
                  }
                >
                  <SelectTrigger
                    className={`mt-1 h-9 transition-colors ${
                      form.payment_method === "pix_manual"
                        ? "border-primary/60 ring-1 ring-primary/30"
                        : ""
                    }`}
                  >
                    <SelectValue placeholder="Escolher no checkout" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Escolher no checkout</SelectItem>
                    {SALE_PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.payment_method === "a_receber" ? (
                  <p className="mt-1.5 text-[11px] leading-snug text-warning">
                    Esta venda não será recebida agora. Será criado um título em
                    Contas a Receber.
                  </p>
                ) : null}
              </div>

              <DiscountField
                subtotal={totals.items_total}
                value={form.discount}
                onChange={(v) => set("discount", v)}
                paymentMethod={form.payment_method}
                policy={discountPolicy}
                overrideApproved={discountOverride}
                onRequestApproval={() => setDiscountApprovalOpen(true)}
                onCancelExceed={() => {
                  const prev = form.discount;
                  executeWithUndo({
                    message: "✓ Desconto removido.",
                    apply: () => set("discount", "0"),
                    undo: () => set("discount", prev),
                  });
                }}
              />

              <div>
                <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Frete (R$)
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.shipping}
                  onChange={(e) => set("shipping", e.target.value)}
                  className="mt-1 h-9 text-right tabular-nums"
                />
              </div>

              <div>
                <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  Data da venda
                </Label>
                <div className="mt-1 flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm tabular-nums text-muted-foreground">
                  {form.sale_date
                    ? new Date(`${form.sale_date}T12:00:00`).toLocaleDateString("pt-BR")
                    : "—"}
                </div>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                  Data operacional da empresa. Para vencimento, use “Data
                  prevista de recebimento”.
                </p>
              </div>


            </div>

            {/* Rodapé de opções secundárias */}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-2.5">
              {!showNotes ? (
                <button
                  type="button"
                  onClick={() => setShowNotes(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  <FileText className="h-3.5 w-3.5" /> Adicionar observação
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                <Settings2 className="h-3.5 w-3.5" />
                {showAdvanced ? "Ocultar avançado" : "Opções avançadas"}
              </button>
              <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                {form.number}
              </span>
            </div>

            {showNotes ? (
              <div className="mt-3">
                <Label className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                  <FileText className="h-3 w-3" /> Observações internas
                </Label>
                <Textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Ex.: entregar após 14h, embalar para presente…"
                  className="mt-1.5 resize-none"
                />
              </div>
            ) : null}

            {showAdvanced ? (
              <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                <div>
                  <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    Nº da venda
                  </Label>
                  <Input
                    value={form.number}
                    onChange={(e) => set("number", e.target.value)}
                    className="mt-1 h-9 font-mono text-sm"
                  />
                  {errors.number ? (
                    <p className="mt-1 text-xs text-destructive">{errors.number}</p>
                  ) : null}
                </div>
                {isEdit ? (
                  <div>
                    <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      Status
                    </Label>
                    <Select value={form.status} onValueChange={(v) => set("status", v)}>
                      <SelectTrigger className="mt-1 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SALE_STATUS_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* ============ RODAPÉ STICKY ============ */}
          <div className="sticky bottom-4 z-10 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:p-4">
            {displayedStockIssues.length > 0 ? (
              <div className="mb-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    {displayedStockIssues.length} item(ns) sem estoque suficiente — corrija antes de pagar.
                  </span>
                </div>
                <ul className="mt-1.5 space-y-0.5 pl-6 text-[11px]">
                  {displayedStockIssues.slice(0, 5).map((issue, i) => (
                    <li key={`${issue.item.product_id ?? issue.item.description}-${i}`}>
                      <span className="font-medium">{issue.item.description}</span>
                      <span className="opacity-80">
                        {" "}· pedido {issue.requested}, disponível {issue.available}
                        {issue.available === 0 ? " (sem estoque)" : ` (falta ${issue.shortage})`}
                      </span>
                    </li>
                  ))}
                  {displayedStockIssues.length > 5 ? (
                    <li className="opacity-80">
                      + {displayedStockIssues.length - 5} outro(s) item(ns).
                    </li>
                  ) : null}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
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

              <div className="ml-auto flex items-end gap-3 border-l border-border pl-6">
                <div className="flex flex-col">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Total
                  </span>
                  <span className="text-3xl font-bold leading-none tabular-nums text-primary sm:text-4xl">
                    {formatCurrency(totals.grand_total)}
                  </span>
                </div>
              </div>

              <div className="flex w-full flex-wrap items-center justify-end gap-2 border-t border-border pt-3 sm:w-auto sm:border-0 sm:pt-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate({ to: "/vendas" })}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                {isEdit ? (
                  <Button
                    type="submit"
                    variant="outline"
                    size="sm"
                    disabled={submitting || !form.customer_id}
                    title={
                      !form.customer_id
                        ? "Selecione um cliente para salvar a venda"
                        : undefined
                    }
                  >
                    Salvar alterações
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  className="min-w-[180px] font-semibold"
                  disabled={
                    submitting ||
                    returningToItems ||
                    revalidatingStock ||
                    items.length === 0 ||
                    insufficientStockCount > 0 ||
                    !form.customer_id
                  }
                  title={
                    !form.customer_id
                      ? "Selecione um cliente para salvar a venda"
                      : undefined
                  }
                  onClick={(e) => {
                    e.preventDefault();
                    // UX-AR — "A Receber" exige confirmação explícita antes de
                    // concluir; nenhuma baixa é executada por este caminho.
                    if (form.payment_method === "a_receber") {
                      setReceivableConfirmOpen(true);
                      return;
                    }
                    void submit(e, true);
                  }}
                >
                  {submitting || revalidatingStock ? (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  ) : null}
                  {revalidatingStock
                    ? "Validando estoque…"
                    : form.payment_method === "a_receber"
                      ? "Criar conta a receber"
                      : "Ir para pagamento"}


                </Button>
              </div>
            </div>
          </div>
        </div>
      </PageLayout>

      {checkout ? (
        <CheckoutDialog
          open={!!checkout}
          onOpenChange={(v) => {
            if (!v) {
              const id = checkout.saleId;
              const skip = skipNavigateOnCloseRef.current;
              skipNavigateOnCloseRef.current = false;
              setCheckout(null);
              if (!skip) {
                // BUG-PDV-020 — evita loop/telemetria de reset quando o
                // usuário já está na rota-alvo (ex.: /vendas/:id/editar).
                const target = `/vendas/${id}`;
                const current = location.pathname;
                if (current === target || current.startsWith(`${target}/`)) {
                  console.warn(
                    "[sale-form] skip navigate on checkout close: already on route",
                    { current, target },
                  );
                } else {
                  navigate({ to: "/vendas/$saleId", params: { saleId: id } });
                }
              }
            }
          }}
          companyId={companyId}
          saleId={checkout.saleId}
          saleNumber={checkout.saleNumber}
          customerId={checkout.customerId}
          amount={checkout.amount}
          onNewSale={!isEdit ? resetForNewSale : undefined}
          onContinueEditing={() => {
            skipNavigateOnCloseRef.current = true;
            resetCheckoutDerivedState();
          }}
          onReturnToItemsStateChange={setReturningToItems}
        />
      ) : null}

      {/* PDV-015 — Diálogo de autorização de gerente para descontos acima do limite */}
      <Dialog
        open={discountApprovalOpen}
        onOpenChange={(o) => {
          setDiscountApprovalOpen(o);
          if (!o) setManagerName("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Autorizar desconto acima do limite</DialogTitle>
            <DialogDescription>
              Este desconto ultrapassa {discountPolicy.maxPercent}%. Informe o
              nome do gerente que autorizou para prosseguir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs text-muted-foreground">
              Nome do gerente
            </Label>
            <Input
              autoFocus
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
              placeholder="Ex.: Ana Souza"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setDiscountApprovalOpen(false);
                setManagerName("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              disabled={managerName.trim().length < 2}
              onClick={() => {
                setDiscountOverride(true);
                setDiscountApprovalOpen(false);
                toast.success("Desconto autorizado", {
                  description: `Autorizado por ${managerName.trim()}.`,
                });
              }}
            >
              Autorizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* UX-AR — confirmação da venda "A Receber". Apenas comunicação: nenhuma
          regra financeira é alterada e nenhuma baixa é aberta aqui. */}
      <Dialog open={receivableConfirmOpen} onOpenChange={setReceivableConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Esta venda não será recebida agora</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>Será criado um título em Contas a Receber.</p>
                <p>
                  Para registrar o pagamento será necessário realizar uma baixa
                  posteriormente, em Vendas &gt; Marcar paga ou em Financeiro &gt;
                  Contas a Receber.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              <span className="text-muted-foreground">
                Valor a receber: {formatCurrency(totals.grand_total)}
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setReceivableConfirmOpen(false)}
            >
              Voltar
            </Button>
            <Button
              type="button"
              disabled={submitting || revalidatingStock}
              onClick={(e) => {
                setReceivableConfirmOpen(false);
                void submit(e, true);
              }}
            >
              Criar conta a receber
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>



      <DraftAutosave
        savedAt={draft.savedAt}
        recovery={
          !isEdit
            ? {
                open: recoveryOpen,
                onOpenChange: setRecoveryOpen,
                title: "Venda em andamento",
                description:
                  "Foi encontrada uma venda em andamento. Deseja continuar?",
                updatedAt: recoveryUpdatedAt,
                onRestore: restoreDraft,
                onDiscard: discardDraft,
              }
            : undefined
        }
      />
      {cashGuardDialog}
    </form>
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
          "text-sm font-semibold tabular-nums",
          muted ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * PDV-015 — Campo de desconto com aplicação automática da política.
 * Desabilita quando o método de pagamento não permite (ex.: cartão).
 * Bloqueia / solicita autorização conforme configurado.
 */
function DiscountField({
  subtotal,
  value,
  onChange,
  paymentMethod,
  policy,
  overrideApproved,
  onRequestApproval,
  onCancelExceed,
}: {
  subtotal: number;
  value: string;
  onChange: (v: string) => void;
  paymentMethod: string;
  policy: DiscountPolicy;
  overrideApproved: boolean;
  onRequestApproval: () => void;
  onCancelExceed: () => void;
}) {
  const numericValue = Number(value) || 0;
  const evaluation = evaluateDiscount({
    subtotal,
    discountValue: numericValue,
    paymentMethod,
    policy,
    overrideApproved,
  });

  const disabledByMethod = evaluation.kind === "disabled_by_method";
  const disabledByPolicy = evaluation.kind === "disabled_by_policy";
  const disabled = disabledByMethod || disabledByPolicy;
  const exceeds = evaluation.kind === "exceeds";

  return (
    <div>
      <Label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Desconto (R$)
      </Label>
      <Input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="mt-1 h-9 text-right tabular-nums"
      />
      {disabledByMethod ? (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Desconto disponível apenas para pagamentos à vista.
        </p>
      ) : null}
      {exceeds ? (
        <div className="mt-1 space-y-1">
          <p className="text-[11px] text-destructive">
            Este desconto ultrapassa o limite permitido ({policy.maxPercent}%).
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[11px]"
              onClick={onCancelExceed}
            >
              Cancelar
            </Button>
            {policy.enforcement === "request_manager" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-[11px]"
                onClick={onRequestApproval}
              >
                Solicitar autorização
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {overrideApproved && evaluation.kind === "ok" && numericValue > 0 ? (
        <p className="mt-1 text-[11px] text-primary">Desconto autorizado.</p>
      ) : null}
    </div>
  );
}

