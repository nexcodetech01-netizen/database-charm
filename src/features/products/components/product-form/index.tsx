import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  ChevronDown,
  Loader2,
  Plus,
  Settings2,
  Sparkles,
  Wand2,
} from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CategoryManagerDialog } from "@/features/categories";
import { formatCurrency } from "@/lib/format";
import {
  useCategories,
  useCreateCategory,
  useCreateProduct,
  useSuppliers,
  useUpdateProduct,
} from "../../hooks/use-products";
import {
  PRODUCT_STATUS_OPTIONS,
  PRODUCT_UNIT_OPTIONS,
  SALES_CHANNEL_OPTIONS,
  type Product,
  type ProductInsert,
  type ProductUpdate,
} from "../../types";
import { useEntityForm } from "@/hooks/use-entity-form";
import { useNextAction } from "@/components/feedback/next-action-provider";
import { executeWithUndo } from "@/lib/undo-manager";
import { useQueryClient } from "@tanstack/react-query";
import { productImagesService } from "../../services/product-images.service";
import { productsKeys, useProductImages, useSignedImageUrls } from "../../hooks/use-products";

import { ProductImageUploader } from "../product-image-uploader";
import { ProductMainImagePicker } from "../product-main-image-picker";
import { SupplierQuickFormDialog } from "./supplier-quick-form-dialog";
import { ProductCreatedDialog } from "../product-created-dialog";
import { MovementFormDialog } from "@/features/inventory/components/movement-form-dialog";
import type { ManualMovementType } from "@/features/inventory/types";
import { SuggestedPricesByChannelCard } from "@/features/pricing/components/suggested-prices-by-channel-card";
import { usePricingInputs } from "@/features/pricing/hooks/use-pricing-inputs";
import {
  computeSuggestedPrice,
  evaluateOfficialPrice,
  worstCaseFee,
  effectiveFeePct,
} from "@/features/pricing/official";
import { useDraft } from "@/hooks/use-draft";
import { DRAFT_KEYS } from "@/lib/draft-storage";
import { DraftAutosave } from "@/components/feedback/draft-autosave";
import { generateNextSku, isSkuTaken } from "../../lib/sku-generator";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { Check, RefreshCw, RotateCcw, Search, X } from "lucide-react";
import { useOperationalDefaults } from "@/features/settings/hooks/use-operational-defaults";
import { handleTitleCaseBlur, toTitleCasePtBr } from "@/lib/text-format";
import { mergeTags, normalizeTag, normalizeTags, MAX_PRODUCT_TAGS } from "@/lib/product-tags";
import { suggestProductTags } from "../../lib/tag-suggestions.functions";
import { syncProductIdealMargin } from "@/features/pricing/lib/product-pricing.functions";
import { useFiscalAutofill } from "../../hooks/use-fiscal-autofill";
import {
  fiscalSuggestionService,
  formatCest,
  formatNcm,
  normalizeCest,
  normalizeNcm,
} from "../../lib/fiscal-suggestions";
import { lookupProductByEan } from "../../lib/ean-lookup.functions";

interface Props {
  companyId: string;
  product?: Product;
  duplicateOf?: Product;
  /** Preço sugerido aplicado externamente (modal de precificação) — apenas em memória. */
  initialPrice?: number;

}

const schema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(200),
  sku: z.string().trim().min(1, "SKU obrigatório").max(80),
  barcode: z.string().trim().max(80).optional().or(z.literal("")),
  // NCM/CEST aceitam entrada formatada (4202.21.00) — só os dígitos são validados.
  ncm: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\D/g, "") : v),
    z
      .string()
      .regex(/^\d{8}$/, "NCM deve ter 8 dígitos")
      .optional()
      .or(z.literal("")),
  ),
  cest: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\D/g, "") : v),
    z
      .string()
      .regex(/^\d{7}$/, "CEST deve ter 7 dígitos")
      .optional()
      .or(z.literal("")),
  ),
  brand: z.string().trim().max(120).optional().or(z.literal("")),
  weight: z.preprocess((v) => num(v as any), z.number().positive("Peso deve ser maior que zero")),
  width: z.preprocess((v) => num(v as any), z.number().positive("Largura deve ser maior que zero")),
  height: z.preprocess((v) => num(v as any), z.number().positive("Altura deve ser maior que zero")),
  length: z.preprocess((v) => num(v as any), z.number().positive("Comprimento deve ser maior que zero")),
});

type FormState = {
  name: string;
  sku: string;
  barcode: string;
  ncm: string;
  cest: string;
  brand: string;
  description: string;
  category_id: string;
  supplier_id: string;
  status: string;
  unit: string;
  sales_channels: string[];
  cost: string;
  freight: string;
  packaging: string;
  insurance: string;
  other_costs: string;
  margin: string;
  use_category_margin: boolean;
  price: string;
  stock: string;
  min_stock: string;
  tags: string[];
  weight: string;
  width: string;
  height: string;
  length: string;
};

const empty: FormState = {
  name: "",
  sku: "",
  barcode: "",
  ncm: "",
  cest: "",
  brand: "",
  description: "",
  category_id: "",
  supplier_id: "",
  status: "active",
  unit: "un",
  sales_channels: ["loja_fisica"],
  cost: "0",
  freight: "0",
  packaging: "0",
  insurance: "0",
  other_costs: "0",
  margin: "",
  use_category_margin: true,
  price: "0",
  stock: "0",
  min_stock: "0",
  tags: [],
  weight: "",
  width: "",
  height: "",
  length: "",
};

function toState(p?: Product): FormState {
  if (!p) return empty;
  return {
    name: p.name,
    sku: p.sku ?? "",
    barcode: p.barcode ?? "",
    ncm: p.ncm ?? "",
    cest: (p as { cest?: string | null }).cest ?? "",
    brand: p.brand ?? "",
    description: p.description ?? "",
    category_id: p.category_id ?? "",
    supplier_id: p.supplier_id ?? "",
    status: p.status,
    unit: p.unit,
    sales_channels: (p as any).sales_channels ?? [],
    cost: String(p.cost),
    freight: String(p.freight),
    packaging: String(p.packaging ?? 0),
    insurance: String(p.insurance),
    other_costs: String(p.other_costs),
    margin: String(p.margin),
    use_category_margin:
      (p as { use_category_margin?: boolean | null }).use_category_margin ?? false,
    price: String(p.price),
    stock: String(p.stock),
    min_stock: String(p.min_stock),
    tags: p.tags ?? [],
    weight: (p as any).weight ? String((p as any).weight) : "",
    width: (p as any).width ? String((p as any).width) : "",
    height: (p as any).height ? String((p as any).height) : "",
    length: (p as any).length ? String((p as any).length) : "",
  };
}

/**
 * Converte a string de um input monetário/decimal em número float.
 * - Remove símbolos ("R$"), espaços e caracteres não numéricos.
 * - Aceita formato pt-BR ("1.234,56") e en-US ("1,234.56" ou "1234.56").
 * - Retorna 0 quando a entrada é inválida/vazia.
 */
function num(v: string | number | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  let s = String(v).trim();
  if (!s) return 0;
  // Remove tudo exceto dígitos, vírgula, ponto e sinal.
  s = s.replace(/[^\d,.\-]/g, "");
  if (!s) return 0;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Ambos presentes: o mais à direita é o decimal.
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    // Só vírgula → decimal pt-BR.
    s = s.replace(/\./g, "").replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function ProductForm({ companyId, product, duplicateOf, initialPrice }: Props) {
  const navigate = useNavigate();
  const showNextAction = useNextAction();

  const [tab, setTab] = useState("geral");
  /** Alíquota simulada nesta tela — não é persistida no produto. */
  const [taxPct, setTaxPct] = useState("0");
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<ManualMovementType>("in");
  const [form, setForm] = useEntityForm(product, toState);
  const initialPriceAppliedRef = useRef(false);
  useEffect(() => {
    if (!initialPrice || initialPrice <= 0 || initialPriceAppliedRef.current) return;
    initialPriceAppliedRef.current = true;
    setForm((s) => ({ ...s, price: initialPrice.toFixed(2) }));
  }, [initialPrice, setForm]);
  const duplicateAppliedRef = useRef(false);

  useEffect(() => {
    if (product || !duplicateOf || duplicateAppliedRef.current) return;
    duplicateAppliedRef.current = true;
    const base = toState(duplicateOf);
    // Duplicação copia apenas dados cadastrais (nome, categoria, fornecedor,
    // marca, descrição, unidade, canal, tags, margem e preço de venda).
    // Zera identificadores únicos, estoque e componentes operacionais de custo
    // — esses recebem novos valores padrão da empresa (efeito abaixo).
    setForm({
      ...base,
      name: `${base.name} (Cópia)`.slice(0, 200),
      sku: "", // regenerado pelo auto-SKU
      barcode: "", // código de barras é físico da peça
      cost: "0", // custo unitário revisado a cada compra
      freight: "0", // reaplicado via operationalDefaults
      packaging: "0",
      insurance: "0",
      other_costs: "0",
      stock: "0", // estoque inicia zerado
      min_stock: base.min_stock, // mantém política de reposição
      weight: base.weight, // dimensões logísticas são do produto físico
      width: base.width,
      height: base.height,
      length: base.length,
    });
    // Permite reaplicar os custos operacionais padrão da empresa no clone.
    defaultsAppliedRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duplicateOf?.id, product]);

  const [tagInput, setTagInput] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [suggestingTags, setSuggestingTags] = useState(false);

  const suggestTagsFn = useServerFn(suggestProductTags);
  const [newCategory, setNewCategory] = useState("");
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [createdProduct, setCreatedProduct] = useState<{ id: string; name: string } | null>(null);

  const qc = useQueryClient();
  const { data: categories = [] } = useCategories(companyId);
  const { data: suppliers = [] } = useSuppliers(companyId);
  const { data: existingImages = [] } = useProductImages(product?.id ?? "");
  const currentMainImage = existingImages[0] ?? null;
  const { data: signed = [] } = useSignedImageUrls(currentMainImage ? [currentMainImage.path] : []);
  const currentMainImageUrl = signed[0]?.signedUrl ?? null;
  const createCategory = useCreateCategory(companyId);
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const saving = createProduct.isPending || updateProduct.isPending;

  // Custos operacionais padrão da empresa (para novos produtos + botão "Restaurar padrão").
  const isEditForDefaults = !!product;
  const { data: operationalDefaults } = useOperationalDefaults(companyId);
  const defaultsAppliedRef = useRef(false);
  useEffect(() => {
    if (isEditForDefaults || defaultsAppliedRef.current || !operationalDefaults) return;
    defaultsAppliedRef.current = true;
    // Só aplica se o usuário ainda não mexeu (valores zerados iniciais).
    setForm((s) => {
      const isZero = (v: string) => num(v) === 0;
      if (
        !isZero(s.freight) ||
        !isZero(s.packaging) ||
        !isZero(s.insurance) ||
        !isZero(s.other_costs)
      ) {
        return s;
      }
      return {
        ...s,
        freight: String(operationalDefaults.freight),
        packaging: String(operationalDefaults.packaging),
        insurance: String(operationalDefaults.insurance),
        other_costs: String(operationalDefaults.other_costs),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operationalDefaults, isEditForDefaults]);

  // OFFLINE-001 — Rascunho automático (somente em novo produto).
  const isEdit = !!product;
  const draftKey = isEdit ? null : DRAFT_KEYS.product(companyId);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryUpdatedAt, setRecoveryUpdatedAt] = useState<number | null>(null);
  const draftCheckedRef = useRef(false);
  const draft = useDraft({
    key: draftKey,
    value: form,
    isEmpty: (v) => !v.name.trim(),
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
    if (found?.data) setForm(found.data as FormState);
    toast.success("Rascunho recuperado");
    setRecoveryOpen(false);
  };
  const discardDraft = () => {
    draft.discard();
    setRecoveryOpen(false);
  };

  // ─── Geração automática de SKU (apenas em novo produto) ───
  // skuAuto = true enquanto o usuário não editar o campo manualmente.
  // Ao salvar (isEdit), o SKU nunca é regenerado automaticamente.
  const [skuAuto, setSkuAuto] = useState(!isEdit);
  const [skuGenerating, setSkuGenerating] = useState(false);
  const debouncedName = useDebouncedValue(form.name, 400);
  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === form.category_id) ?? null,
    [categories, form.category_id],
  );
  const categoryName = selectedCategory?.name ?? null;

  // ─── Automação fiscal (NCM/CEST) ───
  const applyFiscal = useCallback(
    (values: { ncm: string; cest: string }) =>
      setForm((prev) => ({ ...prev, ncm: values.ncm, cest: values.cest })),
    [setForm],
  );
  const fiscal = useFiscalAutofill({
    companyId,
    name: form.name,
    categoryId: form.category_id,
    material: (form as any).material || null,
    categories,
    ncm: form.ncm,
    cest: form.cest,
    onApply: applyFiscal,
  });

  const lookupEan = useServerFn(lookupProductByEan);
  const [eanLoading, setEanLoading] = useState(false);

  async function handleEanLookup() {
    const code = form.barcode.replace(/\D/g, "");
    if (code.length < 8) {
      toast.error("Informe um código de barras válido (8 a 14 dígitos).");
      return;
    }
    setEanLoading(true);
    try {
      // 1) Histórico interno: mesmo EAN já cadastrado na empresa.
      const internal = await fiscalSuggestionService.byBarcode(companyId, code);
      if (internal) {
        fiscal.applySuggestion({ ncm: internal.ncm, cest: internal.cest }, "barcode");
        toast.success("NCM recuperado de um produto com o mesmo EAN.", {
          description: internal.sampleName,
        });
      }

      // 2) Base pública (opcional): dados cadastrais do produto.
      const result = await lookupEan({ data: { barcode: code } });
      if (!result.found) {
        if (!internal) {
          toast.info("Nenhum dado público encontrado para este EAN.", {
            description: "Preencha as informações manualmente.",
          });
        }
        return;
      }

      setForm((prev) => ({
        ...prev,
        name: prev.name.trim() ? prev.name : toTitleCasePtBr(result.name ?? ""),
        brand: prev.brand.trim() ? prev.brand : toTitleCasePtBr(result.brand ?? ""),
        description:
          prev.description.trim() || !result.quantity
            ? prev.description
            : `Embalagem: ${result.quantity}`,
      }));
      toast.success(`Dados encontrados em ${result.source}.`, {
        description: "Revise as informações antes de salvar.",
      });
    } catch (err) {
      toast.error("Não foi possível consultar o EAN", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    } finally {
      setEanLoading(false);
    }
  }
  // Política automática da categoria (Motor Comercial V2). Quando desligada,
  // a categoria não impõe margem e o formulário cai na política da empresa.
  const categoryAutoPolicy =
    (selectedCategory as { auto_pricing_policy?: boolean | null } | null)?.auto_pricing_policy !==
    false;
  const categoryDefaultMargin = useMemo(() => {
    if (!categoryAutoPolicy) return null;
    const raw = (selectedCategory as { target_margin_pct?: number | null } | null)
      ?.target_margin_pct;
    return raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null;
  }, [selectedCategory, categoryAutoPolicy]);
  const hasCategoryMargin = categoryDefaultMargin != null;

  // Auto-preenche a margem quando a opção "Utilizar margem da categoria"
  // estiver ativa e existir margem padrão configurada para a categoria.
  useEffect(() => {
    if (!form.use_category_margin) return;
    if (!hasCategoryMargin) return;
    const next = String(categoryDefaultMargin);
    if (form.margin === next) return;
    setForm((s) => ({ ...s, margin: next }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.use_category_margin, categoryDefaultMargin, hasCategoryMargin]);

  useEffect(() => {
    if (isEdit || !skuAuto) return;
    if (!debouncedName.trim()) return;
    let cancelled = false;
    setSkuGenerating(true);
    generateNextSku(companyId, debouncedName, categoryName)
      .then((sku) => {
        if (cancelled || !sku) return;
        setForm((s) => ({ ...s, sku }));
      })
      .finally(() => {
        if (!cancelled) setSkuGenerating(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedName, categoryName, companyId, isEdit, skuAuto]);

  const regenerateSku = async () => {
    if (!form.name.trim()) {
      toast.error("Informe o nome do produto antes de gerar o SKU");
      return;
    }
    setSkuAuto(true);
    setSkuGenerating(true);
    try {
      const sku = await generateNextSku(companyId, form.name, categoryName);
      if (sku) {
        setForm((s) => ({ ...s, sku }));
        toast.success("SKU gerado");
      } else {
        toast.error("Não foi possível gerar o SKU");
      }
    } finally {
      setSkuGenerating(false);
    }
  };

  // ─── Validação de duplicidade de SKU (tempo real) ───
  const debouncedSku = useDebouncedValue(form.sku.trim(), 350);
  const [skuChecking, setSkuChecking] = useState(false);
  const [skuTaken, setSkuTaken] = useState(false);

  useEffect(() => {
    if (!debouncedSku) {
      setSkuTaken(false);
      setSkuChecking(false);
      return;
    }
    let cancelled = false;
    setSkuChecking(true);
    isSkuTaken(companyId, debouncedSku, product?.id)
      .then((taken) => {
        if (!cancelled) setSkuTaken(taken);
      })
      .finally(() => {
        if (!cancelled) setSkuChecking(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSku, companyId, product?.id]);

  // Precificação: base de custos (Custo + Frete + Embalagem + Seguro + Outros)
  const totalCost = useMemo(
    () =>
      num(form.cost) +
      num(form.freight) +
      num(form.packaging) +
      num(form.insurance) +
      num(form.other_costs),
    [form.cost, form.freight, form.packaging, form.insurance, form.other_costs],
  );

  const price = num(form.price);

  // ── MOTOR COMERCIAL V2 — entradas oficiais (margem categoria→empresa,
  // taxas reais do Asaas, impostos e custos padrão). Nada é hardcoded.
  const { inputs: pricingInputs } = usePricingInputs(companyId, form.category_id || null);

  const officialCosts = useMemo(
    () => ({
      acquisition: num(form.cost),
      freight: num(form.freight),
      packaging: num(form.packaging),
      insurance: num(form.insurance),
      otherCosts: num(form.other_costs),
    }),
    [form.cost, form.freight, form.packaging, form.insurance, form.other_costs],
  );

  /** Margem efetiva: produto → categoria → empresa (via política oficial). */
  const effectiveMargins = useMemo(() => {
    const own = num(form.margin);
    return own > 0 ? { ...pricingInputs.margins, targetPct: own } : pricingInputs.margins;
  }, [form.margin, pricingInputs]);

  /**
   * Resultado COMPLETO do Motor Comercial V2 (mín / recomendado / premium).
   * UX apenas: nenhuma fórmula é calculada aqui.
   */
  const officialSuggestion = useMemo(() => {
    if (officialCosts.acquisition <= 0) return null;
    return computeSuggestedPrice({
      companyId,
      productId: product?.id ?? "new-product",
      categoryId: form.category_id || undefined,
      costs: officialCosts,
      margins: effectiveMargins,
      taxPct: num(taxPct),
      feeTable: pricingInputs.feeTable,
      module: "products.form",
    });
  }, [
    companyId,
    product?.id,
    form.category_id,
    officialCosts,
    effectiveMargins,
    taxPct,
    pricingInputs,
  ]);

  /** Preço sugerido oficial — ÚNICA origem de preço desta tela. */
  const suggestOfficialPrice = useCallback((): number | null => {
    const value = officialSuggestion?.targetPrice;
    return value != null && Number.isFinite(value) && value > 0 ? value : null;
  }, [officialSuggestion]);


  // Impostos: alíquota efetiva da empresa (quando configurada).
  const taxAppliedRef = useRef(false);
  useEffect(() => {
    if (taxAppliedRef.current || pricingInputs.taxPct <= 0) return;
    taxAppliedRef.current = true;
    setTaxPct(String(pricingInputs.taxPct));
  }, [pricingInputs.taxPct]);

  // Margem: quando não há valor próprio nem da categoria, usa a política da empresa.
  useEffect(() => {
    if (num(form.margin) > 0) return;
    if (form.use_category_margin && hasCategoryMargin) return;
    const target = pricingInputs.margins.targetPct;
    if (!(target > 0)) return;
    setForm((s) => (num(s.margin) > 0 ? s : { ...s, margin: String(target) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricingInputs.margins.targetPct, form.margin, form.use_category_margin, hasCategoryMargin]);

  // Produto NOVO: preço sugerido gerado automaticamente pelo motor.
  const autoPriceRef = useRef(false);
  useEffect(() => {
    if (isEdit || autoPriceRef.current) return;
    if (num(form.price) > 0 || officialCosts.acquisition <= 0) return;
    if (!(effectiveMargins.targetPct > 0)) return;
    const suggested = suggestOfficialPrice();
    if (suggested == null) return;
    autoPriceRef.current = true;
    setForm((s) => (num(s.price) > 0 ? s : { ...s, price: suggested.toFixed(2) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, form.price, officialCosts, effectiveMargins, suggestOfficialPrice]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const addTag = () => {
    const t = normalizeTag(tagInput);
    if (!t) return;
    if (form.tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    if (form.tags.length >= MAX_PRODUCT_TAGS) {
      toast.error(`Máximo de ${MAX_PRODUCT_TAGS} tags por produto.`);
      return;
    }
    set("tags", [...form.tags, t]);
    setSuggestedTags((prev) => prev.filter((x) => x.toLowerCase() !== t.toLowerCase()));
    setTagInput("");
  };

  const acceptSuggestedTag = (t: string) => {
    if (form.tags.length >= MAX_PRODUCT_TAGS) {
      toast.error(`Máximo de ${MAX_PRODUCT_TAGS} tags por produto.`);
      return;
    }
    set("tags", mergeTags(form.tags, [t]));
    setSuggestedTags((prev) => prev.filter((x) => x.toLowerCase() !== t.toLowerCase()));
  };

  const acceptAllSuggested = () => {
    if (!suggestedTags.length) return;
    set("tags", mergeTags(form.tags, suggestedTags));
    setSuggestedTags([]);
  };

  const dismissSuggestedTag = (t: string) => {
    setSuggestedTags((prev) => prev.filter((x) => x.toLowerCase() !== t.toLowerCase()));
  };

  const generateTagSuggestions = async (opts: { silent?: boolean } = {}) => {
    if (!form.name.trim()) {
      if (!opts.silent) toast.error("Informe o nome do produto para a Bella sugerir tags.");
      return;
    }
    setSuggestingTags(true);
    try {
      const result = await suggestTagsFn({
        data: {
          name: form.name,
          category: categoryName,
          brand: form.brand || null,
          description: form.description || null,
          existingTags: form.tags,
        },
      });
      const fresh = (result?.tags ?? []).filter(
        (t) => !form.tags.some((x) => x.toLowerCase() === t.toLowerCase()),
      );
      setSuggestedTags(fresh);
      if (!opts.silent) {
        if (fresh.length)
          toast.success(`Bella sugeriu ${fresh.length} tag${fresh.length > 1 ? "s" : ""}.`);
        else toast.message("Nenhuma nova sugestão no momento.");
      }
    } catch (err) {
      if (!opts.silent) {
        toast.error(err instanceof Error ? err.message : "Falha ao gerar sugestões de tags.");
      }
    } finally {
      setSuggestingTags(false);
    }
  };

  const isDuplicating = !!duplicateOf && !product;

  const submit = async () => {
    // Validações estritas para duplicação: exige categoria, fornecedor e
    // preços informados explicitamente antes de criar o novo registro.
    if (isDuplicating) {
      if (!form.category_id) {
        toast.error("Selecione uma categoria antes de salvar a duplicação.");
        return;
      }
      if (!form.supplier_id) {
        toast.error("Selecione um fornecedor antes de salvar a duplicação.");
        return;
      }
      if (num(form.cost) <= 0) {
        toast.error("Informe o Preço de Custo antes de salvar a duplicação.");
        return;
      }
      if (num(form.price) <= 0) {
        toast.error("Informe o Preço de Venda antes de salvar a duplicação.");
        return;
      }
    }

    // UPSERT — em criação, verifica se já existe produto equivalente
    // (Nome OU SKU OU Código de barras). Se existir, reaproveitamos o SKU
    // do registro existente: nunca geramos um SKU novo para o mesmo produto.
    let duplicateProduct: { id: string; name: string; sku: string | null } | null = null;
    if (!product && companyId) {
      const { findDuplicateProduct } = await import("../../lib/product-dedupe");
      duplicateProduct = await findDuplicateProduct(companyId, {
        name: form.name,
        sku: form.sku,
        barcode: form.barcode,
      });
    }

    // Fallback: se o usuário deixou o SKU em branco, gera automaticamente
    // no momento de salvar (garante rastreabilidade em Mercado Livre e afins).
    let effectiveSku = form.sku.trim();
    if (duplicateProduct?.sku) {
      effectiveSku = duplicateProduct.sku;
    } else if (!effectiveSku && form.name.trim() && companyId) {
      const generated = await generateNextSku(companyId, form.name, categoryName);
      if (generated) effectiveSku = generated;
    }

    // Verificação anti-colisão: revalida contra o banco e re-gera incrementando
    // o sufixo numérico até encontrar um SKU livre (protege contra corridas
    // entre múltiplos cadastros simultâneos e edições concorrentes).
    // Não se aplica quando o produto já existe (fluxo de UPSERT).
    if (effectiveSku && companyId && !duplicateProduct) {
      const bumpSuffix = (sku: string): string => {
        const m = sku.match(/^(.*?)-(\d+)$/);
        if (m) {
          const next = parseInt(m[2], 10) + 1;
          return `${m[1]}-${String(next).padStart(m[2].length, "0")}`;
        }
        return `${sku}-001`;
      };
      const originalSku = effectiveSku;
      let attempts = 0;
      while (attempts < 25 && (await isSkuTaken(companyId, effectiveSku, product?.id))) {
        const regenerated = await generateNextSku(companyId, form.name, categoryName);
        effectiveSku =
          regenerated && regenerated.toUpperCase() !== effectiveSku.toUpperCase()
            ? regenerated
            : bumpSuffix(effectiveSku);
        attempts++;
      }
      if (attempts > 0 && effectiveSku !== originalSku) {
        setForm((s) => ({ ...s, sku: effectiveSku }));
        toast.info(`SKU "${originalSku}" já em uso — ajustado para ${effectiveSku}.`);
      } else if (!form.sku.trim()) {
        setForm((s) => ({ ...s, sku: effectiveSku }));
      }
    }

    const parsed = schema.safeParse({ ...form, sku: effectiveSku });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Dados inválidos");
      return;
    }
    if (
      companyId &&
      !duplicateProduct &&
      (await isSkuTaken(companyId, effectiveSku, product?.id))
    ) {
      toast.error("Este SKU já está em uso por outro produto");
      return;
    }

    // Validação explícita do Preço de Venda — bloqueia salvamento e mantém o
    // formulário aberto até que o usuário informe um valor numérico válido.
    const parsedPrice = num(form.price);
    if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast.error("Informe um Preço de Venda válido (maior que zero).");
      return;
    }

    // Auto-inferência de categoria quando o usuário não escolheu uma.
    let resolvedCategoryId = form.category_id || null;
    if (!resolvedCategoryId) {
      const { inferCategoryWithFallback } = await import("../../lib/infer-category");
      const { ensureCategoryByName } = await import("@/features/categories/lib/ensure-category");
      const { name: catName, matched } = inferCategoryWithFallback(form.name, form.description);
      try {
        resolvedCategoryId = await ensureCategoryByName(companyId, catName);
        if (!matched) {
          toast.warning(`Produto associado à categoria "${catName}" — revise a classificação.`);
        }
      } catch {
        resolvedCategoryId = null;
      }
    }

    const basePayload: ProductUpdate = {
      name: toTitleCasePtBr(form.name),
      sku: effectiveSku || null,

      barcode: form.barcode.trim() || null,
      ncm: normalizeNcm(form.ncm) || null,
      cest: normalizeCest(form.cest) || null,
      brand: toTitleCasePtBr(form.brand) || null,
      description: form.description.trim() || null,
      category_id: resolvedCategoryId,
      supplier_id: form.supplier_id || null,
      status: form.status,
      unit: form.unit,
      sales_channels: form.sales_channels,
      cost: num(form.cost),
      freight: num(form.freight),
      packaging: num(form.packaging),
      insurance: num(form.insurance),
      other_costs: num(form.other_costs),
      margin: num(form.margin),
      use_category_margin: form.use_category_margin && hasCategoryMargin,
      price: parsedPrice,
      // Estoque inicial só na criação — em edição o saldo é alterado
      // exclusivamente por movimentação de estoque.
      ...(product ? {} : { stock: num(form.stock) }),
      min_stock: num(form.min_stock),
      tags: normalizeTags(form.tags),
      weight: num(form.weight),
      width: num(form.width),
      height: num(form.height),
      length: num(form.length),
    };

    try {
      const savedId = product
        ? (await updateProduct.mutateAsync({ id: product.id, input: basePayload }), product.id)
        : (
            await createProduct.mutateAsync({
              ...(basePayload as ProductInsert),
              company_id: companyId,
            })
          ).id;

      // Persistência da imagem principal (após salvar o produto).
      if (mainImageFile) {
        try {
          if (currentMainImage) {
            await productImagesService.remove(currentMainImage.id, currentMainImage.path);
          }
          const path = await productImagesService.upload(companyId, savedId, mainImageFile);
          await productImagesService.createRecord(companyId, savedId, path, 0);
          // Sincroniza denormalização usada por listagens/venda/compra.
          await updateProduct.mutateAsync({
            id: savedId,
            input: { cover_image_path: path } as ProductUpdate,
          });
          await qc.invalidateQueries({ queryKey: productsKeys.images(savedId) });
          setMainImageFile(null);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Falha ao enviar imagem");
        }
      }

      // Sincroniza a margem editada com o ProductPolicy do motor de precificação.
      // Best-effort: falha aqui não deve bloquear o save do produto.
      const marginNum = num(form.margin);
      if (Number.isFinite(marginNum) && marginNum > 0 && marginNum < 100) {
        try {
          await syncProductIdealMargin({
            data: { companyId, productId: savedId, idealMarginPct: marginNum },
          });
          await qc.invalidateQueries({ queryKey: ["pricing", "product-intelligence", savedId] });
          await qc.invalidateQueries({ queryKey: ["pricing"] });
        } catch (err) {
          console.warn("[product-form] falha ao sincronizar margem com ProductPolicy", err);
        }
      }

      // OFFLINE-001 — produto persistido com sucesso: limpar rascunho.
      draft.discard();

      if (product) {
        // Fluxo de edição: toast leve e volta para a lista de produtos.
        toast.success("Produto atualizado com sucesso!");
        navigate({ to: "/produtos" });
      } else if (duplicateProduct) {
        // UPSERT: produto já existia — atualizado e estoque somado.
        toast.success(
          `Produto já cadastrado (${duplicateProduct.name}) — dados atualizados e estoque somado.`,
        );
        navigate({ to: "/produtos" });
      } else {
        // Fluxo de criação: novo modal de próximos passos.
        setCreatedProduct({ id: savedId, name: basePayload.name ?? form.name });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao salvar");
    }
  };

  const taxPctNum = num(taxPct);
  // MOTOR ÚNICO — lucro e margem vêm do Motor Comercial V2 (nunca calculados aqui).
  const officialEvaluation = useMemo(
    () =>
      evaluateOfficialPrice(price, {
        companyId,
        productId: product?.id ?? "new-product",
        categoryId: form.category_id || undefined,
        costs: officialCosts,
        margins: pricingInputs.margins,
        fee: { pct: effectiveFeePct(worstCaseFee(pricingInputs.feeTable, price), price) },
        taxPct: taxPctNum,
        module: "products.form",
      }),
    [price, companyId, product?.id, form.category_id, officialCosts, pricingInputs, taxPctNum],
  );
  const taxAmount = (price * officialEvaluation.taxPct) / 100;
  const netProfit = officialEvaluation.profit;
  const realMarginPct = officialEvaluation.marginPct;
  // Só exibe indicadores de resultado quando há custo E preço preenchidos —
  // evita "prejuízo de -100%" em produtos ainda sem precificação.
  const hasPricing = totalCost > 0 && price > 0;

  /** Faixa escolhida pelo usuário (UX apenas — não altera o motor). */
  const [priceTier, setPriceTier] = useState<"min" | "recommended" | "premium">("recommended");

  /** Faixas oferecidas pelo motor (somente leitura). */

  const priceTiers = useMemo(
    () =>
      officialSuggestion
        ? ([
            { key: "min" as const, label: "Mínimo", value: officialSuggestion.minPrice },
            {
              key: "recommended" as const,
              label: "Recomendado",
              value: officialSuggestion.recommendedPrice,
            },
            { key: "premium" as const, label: "Premium", value: officialSuggestion.premiumPrice },
          ].filter((t) => Number.isFinite(t.value) && t.value > 0))
        : [],
    [officialSuggestion],
  );

  const selectedTierPrice = priceTiers.find((t) => t.key === priceTier)?.value ?? null;

  /**
   * UX — apenas preenche o campo "Preço de venda" em memória.
   * NÃO grava nada: o produto só é salvo em "Salvar produto".
   */
  const applySuggestedPrice = () => {
    const suggested = selectedTierPrice ?? suggestOfficialPrice();
    if (suggested == null) {
      toast.error("Não foi possível calcular. Verifique custos e margem.");
      return;
    }
    setForm((s) => ({ ...s, price: suggested.toFixed(2) }));
    toast.success(
      `Preço aplicado no formulário: ${formatCurrency(suggested)} — revise e clique em Salvar produto.`,
    );
  };


  return (
    <div className="space-y-6">
      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="geral">Dados gerais</TabsTrigger>
          <TabsTrigger value="custos">Custos e precificação</TabsTrigger>
          <TabsTrigger value="canais">Precificação por canal</TabsTrigger>
          <TabsTrigger value="estoque">Estoque e fiscal</TabsTrigger>
        </TabsList>

        {/* ══════════════ ABA 1 — DADOS GERAIS ══════════════ */}
        <TabsContent value="geral" className="space-y-6">
          {/* ─── Bloco IMAGEM PRINCIPAL ─── */}
          <Section
            title="Imagem principal"
            description="Uma boa foto vende. Envie PNG, JPG ou WEBP (até 2 MB)."
          >
            <ProductMainImagePicker
              currentUrl={currentMainImageUrl}
              file={mainImageFile}
              onFileChange={setMainImageFile}
              onRemoveCurrent={
                currentMainImage
                  ? async () => {
                      const removedImage = currentMainImage;
                      const removedUrl = currentMainImageUrl;
                      let cachedBlob: Blob | null = null;
                      const cachedName = removedImage.path.split("/").pop() || "image.png";
                      try {
                        if (removedUrl) {
                          const r = await fetch(removedUrl);
                          if (r.ok) cachedBlob = await r.blob();
                        }
                      } catch {
                        /* undo best-effort */
                      }
                      try {
                        await productImagesService.remove(removedImage.id, removedImage.path);
                        await updateProduct.mutateAsync({
                          id: product!.id,
                          input: { cover_image_path: null } as ProductUpdate,
                        });
                        await qc.invalidateQueries({ queryKey: productsKeys.images(product!.id) });
                        executeWithUndo({
                          message: "✓ Imagem removida.",
                          apply: () => {
                            /* já removida */
                          },
                          undo: async () => {
                            if (!cachedBlob) {
                              toast.error("Não foi possível desfazer — imagem indisponível.");
                              return;
                            }
                            try {
                              const file = new File([cachedBlob], cachedName, {
                                type: cachedBlob.type || "image/png",
                              });
                              const uploadedPath = await productImagesService.upload(
                                companyId,
                                product!.id,
                                file,
                              );
                              await productImagesService.createRecord(
                                companyId,
                                product!.id,
                                uploadedPath,
                                0,
                              );
                              await updateProduct.mutateAsync({
                                id: product!.id,
                                input: { cover_image_path: uploadedPath } as ProductUpdate,
                              });
                              await qc.invalidateQueries({
                                queryKey: productsKeys.images(product!.id),
                              });
                              toast.success("Imagem restaurada");
                            } catch (err) {
                              toast.error(
                                err instanceof Error ? err.message : "Falha ao restaurar imagem",
                              );
                            }
                          },
                        });
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Falha ao remover imagem");
                      }
                    }
                  : undefined
              }
              disabled={saving}
            />
          </Section>
          
          <Section title="Dimensões Logísticas" description="Informações obrigatórias para cálculo de frete (Mercado Livre e transportadoras).">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Peso (kg) *" hint="Peso bruto do produto com embalagem">
                <NumInput
                  value={form.weight}
                  onChange={(v) => set("weight", v)}
                  placeholder="Ex: 0.500"
                />
              </Field>
              <Field label="Comprimento (cm) *" hint="Dimensão mais longa">
                <NumInput
                  value={form.length}
                  onChange={(v) => set("length", v)}
                  placeholder="Ex: 20"
                />
              </Field>
              <Field label="Largura (cm) *" hint="Dimensão lateral">
                <NumInput
                  value={form.width}
                  onChange={(v) => set("width", v)}
                  placeholder="Ex: 15"
                />
              </Field>
              <Field label="Altura (cm) *" hint="Espessura/Altura">
                <NumInput
                  value={form.height}
                  onChange={(v) => set("height", v)}
                  placeholder="Ex: 10"
                />
              </Field>
            </div>
          </Section>

          {/* ─── Bloco INFORMAÇÕES ─── */}
          <Section title="Informações" description="O básico para identificar o produto.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nome *" hint="Nome comercial do produto">
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  onBlur={handleTitleCaseBlur((v) => set("name", v))}
                />
              </Field>
              <Field label="Categoria">
                <div className="flex gap-2">
                  <Select
                    value={form.category_id || "__none"}
                    onValueChange={(v) => {
                      const next = v === "__none" ? "" : v;
                      const prev = form.category_id;
                      if (next === "" && prev) {
                        executeWithUndo({
                          message: "✓ Categoria removida.",
                          apply: () => set("category_id", ""),
                          undo: () => set("category_id", prev),
                        });
                      } else {
                        set("category_id", next);
                      }
                    }}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sem categoria</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Gerenciar categorias"
                    onClick={() => setCategoryManagerOpen(true)}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>
                </div>
                <InlineCreate
                  placeholder="Nova categoria"
                  value={newCategory}
                  onChange={setNewCategory}
                  onCreate={async () => {
                    if (!newCategory.trim()) return;
                    const c = await createCategory.mutateAsync(newCategory.trim());
                    set("category_id", c.id);
                    setNewCategory("");
                  }}
                />
                <CategoryManagerDialog
                  open={categoryManagerOpen}
                  onOpenChange={setCategoryManagerOpen}
                  companyId={companyId}
                  onCreated={(id) => set("category_id", id)}
                />
              </Field>
              <Field label="Fornecedor">
                <div className="flex gap-2">
                  <Select
                    value={form.supplier_id || "__none"}
                    onValueChange={(v) => set("supplier_id", v === "__none" ? "" : v)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none">Sem fornecedor</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setSupplierDialogOpen(true)}
                    title="Novo fornecedor"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </Field>
              <Field
                label="SKU *"
                hint="Obrigatório — gerado automaticamente, editável se necessário"
              >
                <div className="flex gap-2">
                  <Input
                    value={form.sku}
                    onChange={(e) => {
                      setSkuAuto(false);
                      set("sku", e.target.value);
                    }}
                    placeholder={skuGenerating ? "Gerando..." : "Ex.: BOL-MIL-PRE-001"}
                    aria-invalid={skuTaken || undefined}
                    className={
                      skuTaken
                        ? "border-danger focus-visible:ring-danger"
                        : form.sku.trim() && !skuChecking
                          ? "border-success/60 focus-visible:ring-success"
                          : undefined
                    }
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={regenerateSku}
                    disabled={skuGenerating || !form.name.trim()}
                    title="Gera um SKU a partir do nome e categoria"
                    className="shrink-0 gap-1.5"
                  >
                    <RefreshCw className={`h-4 w-4 ${skuGenerating ? "animate-spin" : ""}`} />
                    Gerar SKU
                  </Button>
                </div>
                {form.sku.trim() ? (
                  skuChecking ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Verificando disponibilidade…
                    </p>
                  ) : skuTaken ? (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-danger">
                      <X className="h-3 w-3" /> SKU já existe
                    </p>
                  ) : (
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-success">
                      <Check className="h-3 w-3" /> SKU disponível
                    </p>
                  )
                ) : null}
              </Field>
              <Field
                label="Código de barras (EAN)"
                hint="Opcional — use a busca para autopreencher os dados cadastrais"
              >
                <div className="flex gap-2">
                  <Input
                    className="flex-1"
                    value={form.barcode}
                    inputMode="numeric"
                    maxLength={14}
                    onChange={(e) => set("barcode", e.target.value.replace(/\D/g, "").slice(0, 14))}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5"
                    onClick={handleEanLookup}
                    disabled={eanLoading || form.barcode.replace(/\D/g, "").length < 8}
                    title="Consulta bases públicas e o histórico interno pelo EAN"
                  >
                    {eanLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Buscar EAN
                  </Button>
                </div>
              </Field>
              <Field label="Marca">
                <Input
                  value={form.brand}
                  onChange={(e) => set("brand", e.target.value)}
                  onBlur={handleTitleCaseBlur((v) => set("brand", v))}
                />
              </Field>
              <Field label="Status">
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Unidade">
                <Select value={form.unit} onValueChange={(v) => set("unit", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Section
                title="Canais de Venda"
                description="Onde este produto pode ser vendido."
              >
                <div className="flex flex-col gap-3">
                  {SALES_CHANNEL_OPTIONS.map((c) => {
                    const checked = form.sales_channels.includes(c.value);
                    return (
                      <label key={c.value} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              set("sales_channels", [...form.sales_channels, c.value]);
                            } else {
                              set(
                                "sales_channels",
                                form.sales_channels.filter((v) => v !== c.value),
                              );
                            }
                          }}
                        />
                        <span className="text-sm font-medium">{c.label}</span>
                      </label>
                    );
                  })}
                  {!form.sales_channels.length && (
                    <p className="text-[11px] text-danger">Selecione pelo menos um canal.</p>
                  )}
                </div>
              </Section>
            </div>
            <Field label="Descrição">
              <Textarea
                rows={3}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
              />
            </Field>
          </Section>

          {/* Fotos adicionais */}
          {product ? (
            <Section title="Fotos do produto" description="Fotos e mídias adicionais.">
              <ProductImageUploader companyId={companyId} productId={product.id} />
            </Section>
          ) : null}

          {/* Tags */}
          <Section
            title="Tags"
            description="A Bella sugere tags automaticamente. Aceite, remova ou adicione as suas."
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {form.tags.length} / {MAX_PRODUCT_TAGS} tags
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => generateTagSuggestions()}
                disabled={
                  suggestingTags || !form.name.trim() || form.tags.length >= MAX_PRODUCT_TAGS
                }
              >
                {suggestingTags ? (
                  <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                )}
                Sugerir com Bella
              </Button>
            </div>

            {suggestedTags.length > 0 ? (
              <div className="mt-3 rounded-md border border-dashed border-primary/40 bg-primary/5 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-primary">
                    Sugestões da Bella — clique para aceitar
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setSuggestedTags([])}
                    >
                      Descartar
                    </Button>
                    <Button type="button" size="sm" onClick={acceptAllSuggested}>
                      Aceitar todas
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {suggestedTags.map((t) => (
                    <Badge
                      key={t}
                      variant="outline"
                      className="cursor-pointer border-primary/40 bg-background hover:bg-primary/10"
                      onClick={() => acceptSuggestedTag(t)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        dismissSuggestedTag(t);
                      }}
                      title="Clique para aceitar · botão direito para descartar"
                    >
                      + {t}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}

            <Field label="Adicionar tag manualmente">
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Digite e pressione Enter"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addTag}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {form.tags.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.tags.map((t) => (
                    <Badge
                      key={t}
                      variant="secondary"
                      className="cursor-pointer"
                      onClick={() => {
                        const prev = form.tags;
                        executeWithUndo({
                          message: `✓ Tag "${t}" removida.`,
                          apply: () =>
                            set(
                              "tags",
                              prev.filter((x) => x !== t),
                            ),
                          undo: () => set("tags", prev),
                        });
                      }}
                    >
                      {t} ✕
                    </Badge>
                  ))}
                </div>
              ) : null}
            </Field>
          </Section>
        </TabsContent>

        {/* ══════════════ ABA 2 — CUSTOS E PRECIFICAÇÃO ══════════════ */}
        <TabsContent value="custos" className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="mb-5">
              <h3 className="text-sm font-semibold">Custos e precificação</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Preencha os passos abaixo — o preço de venda base é calculado a partir deles.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
              {/* Passos */}
              <div className="space-y-5">
                <StepRow
                  step={1}
                  title="Custo de aquisição"
                  hint="Valor pago ao fornecedor por unidade"
                >
                  <NumInput value={form.cost} onChange={(v) => set("cost", v)} />
                </StepRow>

                <StepRow
                  step={2}
                  title="Frete de compra e embalagem"
                  hint="Custos logísticos por unidade"
                >
                  <div className="grid gap-3 sm:grid-cols-2">
                    <OperationalCostField
                      label="Frete (R$)"
                      value={form.freight}
                      onChange={(v) => set("freight", v)}
                      defaultValue={operationalDefaults?.freight}
                    />
                    <OperationalCostField
                      label="Embalagem (R$)"
                      value={form.packaging}
                      onChange={(v) => set("packaging", v)}
                      defaultValue={operationalDefaults?.packaging}
                    />
                    <OperationalCostField
                      label="Seguro (R$)"
                      value={form.insurance}
                      onChange={(v) => set("insurance", v)}
                      defaultValue={operationalDefaults?.insurance}
                    />
                    <OperationalCostField
                      label="Outros custos (R$)"
                      value={form.other_costs}
                      onChange={(v) => set("other_costs", v)}
                      defaultValue={operationalDefaults?.other_costs}
                    />
                  </div>
                </StepRow>

                <StepRow
                  step={3}
                  title="Impostos / alíquota base (%)"
                  hint="Percentual sobre o preço de venda — usado apenas no cálculo desta tela"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      inputMode="decimal"
                      value={taxPct}
                      onChange={(e) => setTaxPct(e.target.value)}
                      className="max-w-[160px] tabular-nums"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </StepRow>

                <StepRow
                  step={4}
                  title="Margem desejada / markup (%)"
                  hint="Definida por produto — ou herdada da categoria"
                >
                  <MarginSourceField
                    useCategory={form.use_category_margin}
                    onChangeMode={(useCat) => set("use_category_margin", useCat)}
                    margin={form.margin}
                    onChangeMargin={(v) => set("margin", v)}
                    categoryName={categoryName}
                    categoryDefaultMargin={categoryDefaultMargin}
                  />
                </StepRow>
              </div>

              {/* Resultado em destaque */}
              <aside className="space-y-4 rounded-xl border border-primary/25 bg-primary/5 p-5">
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Custo total
                  </p>
                  <p className="text-base font-semibold tabular-nums">
                    {formatCurrency(totalCost)}
                  </p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-muted-foreground">
                    Preço de venda base (R$)
                  </Label>
                  <div className="mt-1.5">
                    <NumInput value={form.price} onChange={(v) => set("price", v)} />
                  </div>

                  {num(form.price) <= 0 ? (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-[11px] font-semibold uppercase tracking-tight">
                        Definir Preço
                      </span>
                    </div>
                  ) : null}

                  {priceTiers.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        Preço sugerido pelo Motor Comercial V2
                      </p>
                      <div className="grid grid-cols-3 gap-2">
                        {priceTiers.map((tier) => {
                          const active = tier.key === priceTier;
                          return (
                            <button
                              key={tier.key}
                              type="button"
                              aria-pressed={active}
                              onClick={() => setPriceTier(tier.key)}
                              className={`rounded-lg border p-2 text-center transition-colors ${
                                active
                                  ? "border-primary bg-primary/10"
                                  : "border-border/60 hover:border-primary/40"
                              }`}
                            >
                              <span
                                className={`block text-[10px] uppercase ${
                                  active ? "text-primary" : "text-muted-foreground"
                                }`}
                              >
                                {tier.label}
                              </span>
                              <span className="mt-0.5 block text-sm font-semibold tabular-nums">
                                {formatCurrency(tier.value)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <Button
                    type="button"
                    className="mt-2 w-full"
                    onClick={applySuggestedPrice}
                    disabled={totalCost <= 0}
                  >
                    <Wand2 className="mr-1.5 h-4 w-4" /> Aplicar preço sugerido
                  </Button>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Preenche apenas o campo acima. Nada é salvo até você clicar em{" "}
                    <strong>Salvar produto</strong>.
                  </p>
                </div>


                <div className="grid grid-cols-2 gap-3 border-t border-primary/20 pt-4">
                  <Metric
                    label="Lucro líquido"
                    value={hasPricing ? formatCurrency(netProfit) : "—"}
                    tone={hasPricing ? (netProfit < 0 ? "danger" : "success") : undefined}
                  />
                  <Metric
                    label="Margem real"
                    value={hasPricing ? `${realMarginPct.toFixed(2)}%` : "—"}
                    tone={hasPricing ? (realMarginPct < 0 ? "danger" : "success") : undefined}
                  />
                </div>
                {!hasPricing ? (
                  <p className="text-[11px] text-muted-foreground">
                    Informe custo e preço para ver lucro e margem.
                  </p>
                ) : null}
              </aside>
            </div>
          </div>
        </TabsContent>

        {/* ══════════════ ABA 3 — PRECIFICAÇÃO POR CANAL ══════════════ */}
        <TabsContent value="canais" className="space-y-6">
          <SuggestedPricesByChannelCard
            mode="local"
            costTotalCents={Math.round(totalCost * 100)}
            targetMarginPct={num(form.margin)}
            currentStorePriceCents={Math.round(num(form.price) * 100)}
            productId={product?.id}
            onApplySuggested={(recommended) => {
              setForm((s) => ({ ...s, price: recommended.toFixed(2) }));
              toast.success("Preços sugeridos aplicados");
            }}
          />
        </TabsContent>

        {/* ══════════════ ABA 4 — ESTOQUE E FISCAL ══════════════ */}
        <TabsContent value="estoque" className="space-y-6">
          <Section title="Estoque" description="Saldo, mínimo e movimentações.">
            <div className="grid gap-4 sm:grid-cols-2">
              {product ? (
                <Field label="Saldo em estoque" hint="Alterado somente por movimentação de estoque">
                  <div className="space-y-2">
                    <NumInput value={form.stock} onChange={() => {}} disabled />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setMovementType("in");
                          setMovementOpen(true);
                        }}
                      >
                        <ArrowUpRight className="mr-1.5 h-4 w-4" /> Entrada de estoque
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setMovementType("adjustment");
                          setMovementOpen(true);
                        }}
                      >
                        <Boxes className="mr-1.5 h-4 w-4" /> Ajustar estoque
                      </Button>
                    </div>
                    {num(form.stock) <= 0 ? (
                      <p className="text-sm font-medium text-destructive">⚠️ Produto sem estoque</p>
                    ) : null}
                  </div>
                </Field>
              ) : (
                <Field label="Estoque inicial" hint="Quantidade disponível hoje">
                  <NumInput value={form.stock} onChange={(v) => set("stock", v)} />
                </Field>
              )}
              <Field label="Estoque mínimo" hint="Dispara alerta de reposição">
                <NumInput value={form.min_stock} onChange={(v) => set("min_stock", v)} />
              </Field>
            </div>
            {product ? (
              <MovementFormDialog
                open={movementOpen}
                onOpenChange={setMovementOpen}
                companyId={companyId}
                defaultProductId={product.id}
                defaultType={movementType}
                lockProduct
                lockedProductLabel={product.name}
                onCompleted={() => {
                  qc.invalidateQueries({ queryKey: productsKeys.all });
                }}
              />
            ) : null}
          </Section>

          <Section title="Fiscal" description="Classificação fiscal usada na emissão de notas.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="NCM" hint="8 dígitos — obrigatório para emitir NF-e">
                <Input
                  value={form.ncm}
                  inputMode="numeric"
                  maxLength={12}
                  placeholder="0000.00.00 ou 00000000"
                  onChange={(e) => {
                    fiscal.markManual();
                    set("ncm", normalizeNcm(e.target.value));
                  }}
                />
                {form.ncm && fiscal.source !== "manual" ? (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Sparkles className="h-3 w-3 text-primary" />
                    {fiscal.source === "category"
                      ? `Sugerido pela categoria ${fiscal.categorySuggestion?.categoryName ?? ""} — edite se precisar.`
                      : fiscal.source === "barcode"
                        ? "Sugerido pelo EAN cadastrado — edite se precisar."
                        : "Sugerido pelo histórico de produtos — edite se precisar."}
                  </p>
                ) : null}

                {fiscal.historyLoading && !form.ncm ? (
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> Buscando produtos semelhantes…
                  </p>
                ) : null}

                {fiscal.historySuggestions.length ? (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-[11px] font-medium text-muted-foreground">
                      Usados em produtos semelhantes:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {fiscal.historySuggestions.map((s) => (
                        <Button
                          key={s.ncm}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 px-2 text-[11px]"
                          onClick={() =>
                            fiscal.applySuggestion({ ncm: s.ncm, cest: s.cest }, "history")
                          }
                          title={`${s.sampleName} — ${s.usageCount} produto(s)`}
                        >
                          <Wand2 className="h-3 w-3" />
                          {formatNcm(s.ncm)}
                          {s.cest ? ` · CEST ${formatCest(s.cest)}` : ""}
                          <Badge variant="secondary" className="ml-0.5 px-1 py-0 text-[10px]">
                            {s.usageCount}
                          </Badge>
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Field>
              <Field label="CEST" hint="7 dígitos — apenas para substituição tributária">
                <Input
                  value={form.cest}
                  inputMode="numeric"
                  maxLength={11}
                  placeholder="00.000.00 ou 0000000"
                  onChange={(e) => {
                    fiscal.markManual();
                    set("cest", normalizeCest(e.target.value));
                  }}
                />
              </Field>
            </div>
          </Section>

          <Section
            title="Dimensões e peso"
            description="Medidas oficiais usadas para o cálculo exato de frete nos Marketplaces (Mercado Livre, etc)."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field 
                label="Peso (kg)" 
                hint="Peso total com embalagem"
              >
                <div className="relative">
                  <NumInput 
                    value={form.weight} 
                    onChange={(v) => set("weight", v)} 
                    placeholder="0,000"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase">kg</span>
                </div>
              </Field>

              <Field 
                label="Altura (cm)" 
                hint="Altura da caixa/embalagem"
              >
                <div className="relative">
                  <NumInput 
                    value={form.height} 
                    onChange={(v) => set("height", v)} 
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase">cm</span>
                </div>
              </Field>

              <Field 
                label="Largura (cm)" 
                hint="Largura da caixa/embalagem"
              >
                <div className="relative">
                  <NumInput 
                    value={form.width} 
                    onChange={(v) => set("width", v)} 
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase">cm</span>
                </div>
              </Field>

              <Field 
                label="Comprimento (cm)" 
                hint="Comprimento da caixa/embalagem"
              >
                <div className="relative">
                  <NumInput 
                    value={form.length} 
                    onChange={(v) => set("length", v)} 
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground uppercase">cm</span>
                </div>
              </Field>
            </div>
          </Section>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate({ to: "/produtos" })}>
          Cancelar
        </Button>
        <Button type="button" onClick={submit} disabled={saving || skuTaken || skuChecking}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {product ? "Salvar alterações" : "Criar produto"}
        </Button>
      </div>

      <SupplierQuickFormDialog
        companyId={companyId}
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        onCreated={(s) => set("supplier_id", s.id)}
      />
      <DraftAutosave
        savedAt={draft.savedAt}
        recovery={
          !isEdit
            ? {
                open: recoveryOpen,
                onOpenChange: setRecoveryOpen,
                title: "Cadastro em andamento",
                description:
                  "Foi encontrado um cadastro de produto em andamento. Deseja continuar?",
                updatedAt: recoveryUpdatedAt,
                onRestore: restoreDraft,
                onDiscard: discardDraft,
              }
            : undefined
        }
      />
      {createdProduct ? (
        <ProductCreatedDialog
          open={!!createdProduct}
          onOpenChange={(v: boolean) => {
            if (!v) setCreatedProduct(null);
          }}
          productId={createdProduct.id}
          productName={createdProduct.name}
          onCreateAnother={() => {
            // Reset completo: novo formulário em branco, sem reutilizar dados
            // do produto recém-criado e sem passar pelo detalhe.
            setCreatedProduct(null);
            setForm(empty);
            setMainImageFile(null);
            setSuggestedTags([]);
            setTagInput("");
            setNewCategory("");
            setSkuAuto(true);
            setSkuTaken(false);
            defaultsAppliedRef.current = false;
            draft.discard();
            navigate({ to: "/produtos/novo" });
          }}
        />
      ) : null}
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-5">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {description ? <p className="text-xs text-muted-foreground mt-0.5">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  const color =
    tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : "text-foreground";
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Input
      inputMode="decimal"
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="tabular-nums"
    />
  );
}

function OperationalCostField({
  label,
  value,
  onChange,
  defaultValue,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  defaultValue: number | undefined;
}) {
  const hasDefault = typeof defaultValue === "number";
  const current = Number(value.replace(",", "."));
  const currentValid = Number.isFinite(current) ? current : 0;
  const isDifferent = hasDefault && Math.abs(currentValid - (defaultValue ?? 0)) > 1e-6;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
        {hasDefault && isDifferent ? (
          <button
            type="button"
            onClick={() => onChange(String(defaultValue))}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
            title={`Restaurar padrão da empresa (R$ ${(defaultValue ?? 0).toFixed(2)})`}
          >
            <RotateCcw className="h-3 w-3" /> Restaurar padrão
          </button>
        ) : null}
      </div>
      <NumInput value={value} onChange={onChange} />
      {hasDefault ? (
        <p className="text-[11px] text-muted-foreground">
          Padrão da empresa: R$ {(defaultValue ?? 0).toFixed(2)}
        </p>
      ) : null}
    </div>
  );
}

function MarginSourceField({
  useCategory,
  onChangeMode,
  margin,
  onChangeMargin,
  categoryName,
  categoryDefaultMargin,
}: {
  useCategory: boolean;
  onChangeMode: (useCategory: boolean) => void;
  margin: string;
  onChangeMargin: (v: string) => void;
  categoryName: string | null;
  categoryDefaultMargin: number | null;
}) {
  const hasCategoryMargin = categoryDefaultMargin != null;
  const effectiveUseCategory = useCategory && hasCategoryMargin;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs font-medium text-muted-foreground">Margem</Label>
        {!hasCategoryMargin && categoryName ? (
          <span className="text-[11px] text-muted-foreground">
            Nenhuma margem padrão em <strong>{categoryName}</strong> — usando personalizada.
          </span>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => hasCategoryMargin && onChangeMode(true)}
          disabled={!hasCategoryMargin}
          className={`flex items-start gap-2 rounded-md border p-3 text-left transition ${
            effectiveUseCategory
              ? "border-primary/60 bg-primary/5"
              : "border-border hover:bg-accent"
          } ${!hasCategoryMargin ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <span
            className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
              effectiveUseCategory ? "border-primary" : "border-muted-foreground/40"
            }`}
          >
            {effectiveUseCategory ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
          </span>
          <span className="min-w-0 text-sm">
            <span className="block font-medium">Utilizar margem da categoria</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {hasCategoryMargin
                ? `${categoryName ?? "Categoria"} • ${categoryDefaultMargin}%`
                : categoryName
                  ? "Categoria sem margem padrão configurada."
                  : "Selecione uma categoria para usar sua margem padrão."}
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => onChangeMode(false)}
          className={`flex items-start gap-2 rounded-md border p-3 text-left transition ${
            !effectiveUseCategory
              ? "border-primary/60 bg-primary/5"
              : "border-border hover:bg-accent"
          }`}
        >
          <span
            className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
              !effectiveUseCategory ? "border-primary" : "border-muted-foreground/40"
            }`}
          >
            {!effectiveUseCategory ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
          </span>
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-medium">
              Margem personalizada
              {(() => {
                const parsed = Number(String(margin).replace(",", "."));
                return Number.isFinite(parsed) && String(margin).trim() !== ""
                  ? ` (${parsed}%)`
                  : "";
              })()}
            </span>
            <div className="mt-1.5 flex items-center gap-2">
              <Input
                inputMode="decimal"
                value={margin}
                onChange={(e) => onChangeMargin(e.target.value)}
                onFocus={() => onChangeMode(false)}
                disabled={effectiveUseCategory}
                className="h-8 tabular-nums"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </span>
        </button>
      </div>
    </div>
  );
}

function InlineCreate({
  placeholder,
  value,
  onChange,
  onCreate,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="mt-1.5 flex gap-1.5">
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 text-xs"
      />
      <Button type="button" size="sm" variant="ghost" onClick={onCreate}>
        <Plus className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function StepRow({
  step,
  title,
  hint,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
        {step}
      </span>
      <div className="min-w-0 space-y-2">
        <div>
          <p className="text-sm font-medium">{title}</p>
          {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}
