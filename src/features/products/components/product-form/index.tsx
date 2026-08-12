import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEntityForm } from "@/hooks/use-entity-form";
import { useDraft } from "@/hooks/use-draft";
import { DRAFT_KEYS } from "@/lib/draft-storage";
import { DraftAutosave } from "@/components/feedback/draft-autosave";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { toTitleCasePtBr } from "@/lib/text-format";
import { normalizeCest, normalizeNcm } from "../../lib/fiscal-suggestions";
import { generateNextSku, isSkuTaken } from "../../lib/sku-generator";
import { suggestProductTags } from "../../lib/tag-suggestions.functions";
import { syncProductIdealMargin } from "@/features/pricing/lib/product-pricing.functions";
import { usePricingInputs } from "@/features/pricing/hooks/use-pricing-inputs";
import { evaluateOfficialPrice, computeSuggestedPrice, effectiveFeePct, worstCaseFee } from "@/features/pricing/official";
import { productImagesService } from "../../services/product-images.service";
import { productMediaService } from "../../services/product-media.service";
import { lookupProductByEan } from "../../lib/ean-lookup.functions";
import { getLastPurchaseInfo } from "@/features/purchases/services/purchase-history.functions";

import {
  useCategories,
  useSuppliers,
  useCreateProduct,
  useUpdateProduct,
  productsKeys,
  useProductImages,
  useSignedImageUrls,
  useCreateCategory,
} from "../../hooks/use-products";
import { useFiscalAutofill } from "../../hooks/use-fiscal-autofill";
import { useOperationalDefaults } from "@/features/settings/hooks/use-operational-defaults";

import { GeneralInfoForm } from "./modules/general-info-form";
import { LogisticsForm } from "./modules/logistics-form";
import { PricingForm } from "./modules/pricing-form";
import { MarketingForm } from "./modules/marketing-form";
import { MultimediaForm } from "./modules/multimedia-form";
import { StockForm } from "./modules/stock-form";
import { FiscalForm } from "./modules/fiscal-form";
import { KitCompositionModule } from "./modules/kit-composition-module";

import { ProductCreatedDialog } from "../product-created-dialog";
import { SupplierQuickFormDialog } from "./supplier-quick-form-dialog";
import { CategoryQuickFormDialog } from "./category-quick-form-dialog";
import { MovementFormDialog } from "@/features/inventory/components/movement-form-dialog";
import { SuggestedPricesByChannelCard } from "@/features/pricing/components/suggested-prices-by-channel-card";

import type { Product, ProductInsert, ProductUpdate } from "../../types";
import type { ManualMovementType } from "@/features/inventory/types";

interface Props {
  companyId: string;
  product?: Product;
  duplicateOf?: Product;
  initialPrice?: number;
}

const schema = z.object({
  name: z.string().trim().min(1, "Nome obrigatório").max(200),
  sku: z.string().trim().min(1, "SKU obrigatório").max(80),
  barcode: z.string().trim().min(1, "EAN/GTIN obrigatório").max(80),
  ncm: z.preprocess((v) => (typeof v === "string" ? v.replace(/\D/g, "") : v), z.string().regex(/^\d{8}$/, "NCM inválido")),
  category_id: z.string().min(1, "Categoria obrigatória"),
  price: z.preprocess((v) => parseFloat(String(v).replace(/[^\d.-]/g, "")) || 0, z.number().positive("Preço inválido")),
});

type FormState = {
  name: string; sku: string; barcode: string; ncm: string; cest: string;
  brand: string; model: string; description: string; category_id: string;
  supplier_id: string; status: string; unit: string; sales_channels: string[];
  cost: string; freight: string; packaging: string; insurance: string;
  other_costs: string; margin: string; use_category_margin: boolean;
  price: string; stock: string; min_stock: string; tags: string[];
  weight: string; width: string; height: string; length: string;
  video_url: string; product_type: "simple" | "kit";
  composition: any[];
  channel_fee_pct: string; channel_fixed_fee: string; tax_pct: string;
};

const empty: FormState = {
  name: "", sku: "", barcode: "SEM GTIN", ncm: "", cest: "",
  brand: "Genérico", model: "Padrão", description: "", category_id: "",
  supplier_id: "", status: "active", unit: "UN", sales_channels: ["loja_fisica"],
  cost: "0", freight: "0", packaging: "0", insurance: "0", other_costs: "0",
  margin: "", use_category_margin: true, price: "0", stock: "1", min_stock: "0",
  channel_fee_pct: "0", channel_fixed_fee: "0", tax_pct: "0",
  tags: [], weight: "0.3", width: "15", height: "15", length: "15", video_url: "",
  product_type: "simple", composition: [],
};

function toState(p?: Product): FormState {
  if (!p) return empty;
  return {
    ...empty,
    name: p.name, sku: p.sku ?? "", barcode: p.barcode ?? "", ncm: p.ncm ?? "",
    cest: (p as any).cest ?? "", brand: p.brand ?? "", model: (p as any).model ?? "",
    description: p.description ?? "", category_id: p.category_id ?? "",
    supplier_id: p.supplier_id ?? "", status: p.status, unit: p.unit,
    sales_channels: (p as any).sales_channels ?? [], cost: String(p.cost),
    freight: String(p.freight), packaging: String(p.packaging ?? 0),
    insurance: String(p.insurance), other_costs: String(p.other_costs),
    margin: String(p.margin), use_category_margin: (p as any).use_category_margin ?? false,
    channel_fee_pct: String((p as any).channel_pricing_settings?.ml?.fee_pct ?? 0),
    channel_fixed_fee: String((p as any).channel_pricing_settings?.ml?.fixed_fee ?? 0),
    tax_pct: String((p as any).channel_pricing_settings?.ml?.tax_pct ?? 0),
    price: String(p.price), stock: String(p.stock), min_stock: String(p.min_stock),
    tags: p.tags ?? [], weight: String((p as any).weight || ""),
    width: String((p as any).width || ""), height: String((p as any).height || ""),
    length: String((p as any).length || ""), video_url: (p as any).video_url ?? "",
    product_type: (p as any).product_type ?? "simple",
    composition: ((p as any).composition || []).map((c: any) => ({
      id: c.id,
      component_id: c.component_id,
      quantity: c.quantity,
      name: c.product?.name || "",
      sku: c.product?.sku || "",
      cost: c.product?.cost || 0,
      stock: c.product?.stock || 0
    })),
  };
}

export function ProductForm({ companyId, product, duplicateOf, initialPrice }: Props) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("geral");
  const [form, setForm] = useEntityForm(product, toState);
  
  // States para modais e utilitários
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<ManualMovementType>("in");
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [createdProduct, setCreatedProduct] = useState<{ id: string; name: string } | null>(null);
  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [uploadingMainImage, setUploadingMainImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [suggestingTags, setSuggestingTags] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Hooks de dados
  const { data: categories = [] } = useCategories(companyId);
  const { data: suppliers = [] } = useSuppliers(companyId);
  const { data: existingImages = [] } = useProductImages(product?.id ?? "");
  const currentMainImage = existingImages[0] ?? null;
  const { data: signed = [] } = useSignedImageUrls(currentMainImage ? [currentMainImage.path] : []);
  const currentMainImageUrl = signed[0]?.signedUrl ?? null;
  
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const createCategory = useCreateCategory(companyId);
  const suggestTagsFn = useServerFn(suggestProductTags);
  const lookupEan = useServerFn(lookupProductByEan);
  const fetchLastPurchase = useServerFn(getLastPurchaseInfo);
  const { data: operationalDefaults } = useOperationalDefaults(companyId);
  
  const isEdit = !!product;
  const currentCategory = categories.find(c => c.id === form.category_id);
  const categoryName = currentCategory?.name || null;
  const categoryMargin = (currentCategory as any)?.target_margin_pct ?? null;
  const num = (v: any) => parseFloat(String(v).replace(/[^\d.-]/g, "")) || 0;

  // SKU Logic
  const [skuAuto, setSkuAuto] = useState(!isEdit);
  const [skuGenerating, setSkuGenerating] = useState(false);
  const debouncedSku = useDebouncedValue(form.sku.trim(), 350);
  const [skuChecking, setSkuChecking] = useState(false);
  const [skuTaken, setSkuTaken] = useState(false);

  // Fiscal Suggestion Logic
  const fiscal = useFiscalAutofill({
    companyId,
    name: form.name,
    categoryId: form.category_id,
    material: form.model || null,
    categories,
    ncm: form.ncm,
    cest: form.cest,
    onApply: (v) => setForm((s: any) => ({ ...s, ...v })),
  });
  const [eanLoading, setEanLoading] = useState(false);

  // Botão "Sugestão IA" da aba fiscal — antes era um no-op (onFiscalAutofill
  // sempre vazio, fiscalLoading sempre false). Aplica a melhor sugestão já
  // calculada pelo hook: categoria > histórico de produtos similares > tabela
  // mestre de NCM.
  const handleFiscalAutofill = useCallback(() => {
    if (fiscal.categorySuggestion?.ncm) {
      fiscal.applySuggestion(
        { ncm: fiscal.categorySuggestion.ncm, cest: fiscal.categorySuggestion.cest },
        "category",
      );
      return;
    }
    const bestHistory = fiscal.historySuggestions[0];
    if (bestHistory?.ncm) {
      fiscal.applySuggestion({ ncm: bestHistory.ncm, cest: bestHistory.cest }, "history");
      return;
    }
    const bestMaster = fiscal.masterSuggestions[0];
    if (bestMaster?.ncm) {
      fiscal.applySuggestion({ ncm: bestMaster.ncm, cest: null }, "barcode");
      return;
    }
    toast.error("Nenhuma sugestão fiscal encontrada. Preencha nome e categoria do produto.");
  }, [fiscal]);

  // Draft Logic
  const draft = useDraft({
    key: isEdit ? null : DRAFT_KEYS.product(companyId),
    value: form,
    enabled: !isEdit,
  });
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const recoveryData = draft.load();
  const recoveryUpdatedAt = recoveryData?.updatedAt;

  // Pricing Logic
  const { inputs: pricingInputs } = usePricingInputs(companyId, form.category_id || null);
  
  const compositionCost = useMemo(() => {
    if (form.product_type !== 'kit') return 0;
    return (form.composition || []).reduce((acc, item) => acc + (num(item.cost) * num(item.quantity)), 0);
  }, [form.product_type, form.composition]);

  const kitStock = useMemo(() => {
    if (form.product_type !== 'kit' || !form.composition?.length) return 0;
    const stocks = form.composition.map(c => Math.floor(num(c.stock) / num(c.quantity)));
    return Math.min(...stocks);
  }, [form.product_type, form.composition]);

  const currentCost = form.product_type === 'kit' ? compositionCost : num(form.cost);
  const currentStock = form.product_type === 'kit' ? kitStock : num(form.stock);

  const totalCost = currentCost + num(form.freight) + num(form.packaging) + num(form.insurance) + num(form.other_costs);

  // "Usar margem da categoria": recalcula o preço pelo MOTOR OFICIAL
  // (computeSuggestedPrice), nunca localmente.
  const applyCategoryMargin = useCallback(() => {
    if (!form.category_id) return;
    const suggestion = computeSuggestedPrice({
      companyId,
      productId: product?.id ?? "new-product",
      categoryId: form.category_id,
      categoryName: categoryName ?? undefined,
      costs: {
        acquisition: num(form.cost),
        freight: num(form.freight),
        packaging: num(form.packaging),
        insurance: num(form.insurance),
        otherCosts: num(form.other_costs),
      },
      margins: pricingInputs.margins,
      feeTable: pricingInputs.feeTable,
      taxPct: pricingInputs.taxPct,
      module: "products.form",
    });
    setForm((s: any) => ({
      ...s,
      price: suggestion.targetPrice.toFixed(2),
      margin: String(suggestion.marginPct),
    }));
  }, [
    companyId,
    product?.id,
    form.category_id,
    form.cost,
    form.freight,
    form.packaging,
    form.insurance,
    form.other_costs,
    categoryName,
    pricingInputs,
    setForm,
  ]);

  // Mantém o preço em sincronia com o motor oficial enquanto a margem da
  // categoria estiver ativa (ex: usuário muda o custo depois de já ter
  // ligado o switch).
  useEffect(() => {
    if (form.use_category_margin && form.category_id) {
      applyCategoryMargin();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    form.use_category_margin,
    form.category_id,
    form.cost,
    form.freight,
    form.packaging,
    form.insurance,
    form.other_costs,
    pricingInputs,
  ]);

  // Sync cost and stock if kit
  useEffect(() => {
    if (form.product_type === 'kit') {
      setForm(s => ({
        ...s,
        cost: String(compositionCost),
        stock: String(kitStock)
      }));
    }
  }, [form.product_type, compositionCost, kitStock, setForm]);

  // CARREGAMENTO DOS CUSTOS PADRÃO E SOMA DO CUSTO TOTAL
  useEffect(() => {
    if (operationalDefaults && !recoveryData) {
      setForm(prev => {
        // Se já houver valores, só preenche se for novo produto ou se estiverem zerados
        const currentFreight = num(prev.freight);
        const currentPackaging = num(prev.packaging);
        const currentInsurance = num(prev.insurance);
        const currentOther = num(prev.other_costs);

        // Se for novo produto, força os padrões da empresa
        if (!isEdit) {
          return {
            ...prev,
            freight: currentFreight > 0 ? String(currentFreight) : String(operationalDefaults.freight || 0),
            packaging: currentPackaging > 0 ? String(currentPackaging) : String(operationalDefaults.packaging ?? 2.30),
            insurance: currentInsurance > 0 ? String(currentInsurance) : String(operationalDefaults.insurance ?? 0),
            other_costs: currentOther > 0 ? String(currentOther) : String(operationalDefaults.other_costs ?? 0.10),
            use_category_margin: true,
          };
        }

        // Para produtos existentes, só preenche se estiverem zerados e os padrões existirem
        return {
          ...prev,
          packaging: currentPackaging === 0 ? String(operationalDefaults.packaging ?? 2.30) : String(currentPackaging),
          other_costs: currentOther === 0 ? String(operationalDefaults.other_costs ?? 0.10) : String(currentOther),
        };
      });
    }
  }, [isEdit, operationalDefaults, recoveryData, setForm]);

  // Event Handlers
  const handleRegenerateSku = async () => {
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    setSkuGenerating(true);
    try {
      const sku = await generateNextSku(companyId, form.name, categoryName);
      if (sku) setForm(s => ({ ...s, sku }));
    } finally { setSkuGenerating(false); }
  };

  const handleEanLookup = async () => {
    const code = form.barcode.trim();
    if (!code || code === "SEM GTIN") return;
    setEanLoading(true);
    try {
      const result = await lookupEan({ data: { barcode: code } });
      if (result.found) {
        setForm(prev => ({
          ...prev,
          name: prev.name.trim() ? prev.name : result.name || "",
          brand: prev.brand.trim() ? prev.brand : result.brand || "",
        }));
        toast.success("Dados encontrados");
      }
    } catch (err) { toast.error("Erro ao buscar EAN"); }
    finally { setEanLoading(false); }
  };

  // Botão "Sugerir com IA" das tags — suggestTagsFn já existia (importado e
  // instanciado via useServerFn), mas nunca era chamado; onSuggestTags
  // estava ligado a uma função vazia.
  const handleSuggestTags = async () => {
    if (!form.name.trim()) {
      toast.error("Preencha o nome do produto antes de gerar sugestões.");
      return;
    }
    setSuggestingTags(true);
    try {
      const result = await suggestTagsFn({
        data: {
          name: form.name,
          category: categoryName || null,
          brand: form.brand || null,
          description: form.description || null,
          existingTags: form.tags,
        },
      });
      setSuggestedTags(result.tags);
      if (!result.tags.length) {
        toast.info("Nenhuma sugestão encontrada para esse produto.");
      }
    } catch (err) {
      console.error("[handleSuggestTags]", err);
      toast.error("Erro ao sugerir tags");
    } finally {
      setSuggestingTags(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingVideo(true);
    try {
      const url = await productMediaService.uploadVideo(companyId, product?.id || "temp", file);
      setForm(s => ({ ...s, video_url: url }));
      toast.success("Vídeo carregado");
    } catch (err) { toast.error("Erro no upload"); }
    finally { setUploadingVideo(false); }
  };

  const handleFetchLastPurchase = useCallback(async () => {
    if (!form.supplier_id) return;

    try {
      const info = await fetchLastPurchase({ 
        data: { 
          companyId, 
          productId: product?.id || null, 
          supplierId: form.supplier_id,
          productName: !product?.id ? form.name : undefined,
          sku: !product?.id ? form.sku : undefined
        } 
      });

      if (info) {
        setForm(s => {
          const next = {
            ...s,
            cost: info.unitPrice.toFixed(2),
          };

          // Sobreposição inteligente para o frete:
          // Se houver frete na compra, use-o.
          if (info.unitShipping > 0) {
            next.freight = info.unitShipping.toFixed(2);
          } else if (operationalDefaults) {
            // Se não houver frete na compra, mas houver padrão da empresa, use o padrão
            next.freight = operationalDefaults.freight.toFixed(2);
          }

          return next;
        });
        // Sincronização silenciosa removida toast.success
      }
    } catch (err) {
      console.error("Erro ao buscar histórico:", err);
      // Silenciado: toast.error("Erro ao consultar histórico de compras.");
    }
  }, [companyId, product?.id, form.supplier_id, fetchLastPurchase, setForm, operationalDefaults]);

  // Sincronizar ao trocar de fornecedor
  useEffect(() => {
    if (form.supplier_id) {
      handleFetchLastPurchase();
    }
  }, [form.supplier_id]);

  const submit = async () => {
    setFormErrors({});
    const validation = schema.safeParse(form);
    if (!validation.success) {
      const errors: Record<string, string> = {};
      validation.error.errors.forEach(err => {
        const path = err.path[0] as string;
        if (!errors[path]) errors[path] = err.message;
      });
      setFormErrors(errors);

      // Smart Focus & Tab Switching
      const firstError = validation.error.errors[0];
      const field = firstError.path[0] as string;

      if (["name", "category_id"].includes(field)) setTab("geral");
      else if (["sku", "barcode", "ncm"].includes(field)) setTab("estoque");
      else if (["price"].includes(field)) setTab("custos");

      // Scroll and focus
      setTimeout(() => {
        const el = document.getElementById(field);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.focus();
        }
      }, 100);

      return toast.error("Verifique os campos obrigatórios");
    }

    const payload: ProductUpdate = {
      name: toTitleCasePtBr(form.name),
      sku: form.sku.trim(),
      barcode: form.barcode.trim(),
      ncm: normalizeNcm(form.ncm),
      cest: normalizeCest(form.cest),
      brand: toTitleCasePtBr(form.brand),
      model: form.model.trim(),
      description: form.description.trim(),
      category_id: form.category_id,
      supplier_id: form.supplier_id || null,
      status: form.status as any,
      unit: form.unit,
      price: num(form.price),
      cost: num(form.cost),
      freight: num(form.freight),
      packaging: num(form.packaging),
      insurance: num(form.insurance),
      other_costs: num(form.other_costs),
      margin: num(form.margin),
      use_category_margin: form.use_category_margin,
      // Persistência em channel_pricing_settings para manter compatibilidade com o schema Supabase
      channel_pricing_settings: {
        ml: {
          fee_pct: num(form.channel_fee_pct),
          fixed_fee: num(form.channel_fixed_fee),
          tax_pct: num(form.tax_pct)
        }
      } as any,
      stock: num(form.stock),
      min_stock: num(form.min_stock),
      weight: num(form.weight),
      width: num(form.width),
      height: num(form.height),
      length: num(form.length),
      sales_channels: form.sales_channels,
      product_type: form.product_type,
      composition: form.composition,
    };

    try {
      // 1. Se houver imagem principal pendente, enviar ANTES de salvar o produto
      // para garantir que temos o path para o cover_image_path
      let cover_image_path = product?.cover_image_path || null;
      
      if (mainImageFile) {
        setUploadingMainImage(true);
        try {
          // Nota: Se for novo produto, usamos um ID temporário ou UUID
          // O productImagesService.upload aceita qualquer string como productId
          const tempId = product?.id || crypto.randomUUID();
          const path = await productImagesService.upload(companyId, tempId, mainImageFile);
          cover_image_path = path;
        } catch (err) {
          console.error("Erro no upload da imagem:", err);
          throw new Error("Erro no upload da imagem. Verifique o tamanho do arquivo.");
        } finally {
          setUploadingMainImage(false);
        }
      }

      const finalPayload: ProductUpdate = {
        ...payload,
        cover_image_path,
      };

      // O banco bloqueia qualquer alteração direta de "stock" em produtos já
      // existentes (só é permitida via inventory_movements, para manter o
      // histórico correto). Removemos aqui por segurança para nunca disparar
      // esse erro ao salvar edições.
      if (isEdit) {
        delete (finalPayload as any).stock;
      }

      const saved = isEdit 
        ? await updateProduct.mutateAsync({ id: product.id, input: finalPayload })
        : await createProduct.mutateAsync({ ...finalPayload, company_id: companyId } as ProductInsert);
      
      const savedId = isEdit ? product.id : (saved?.id as string);

      // Se enviamos uma nova imagem principal para um novo produto, criar o registro na product_images
      if (mainImageFile && !isEdit && savedId) {
        await productImagesService.createRecord(companyId, savedId, cover_image_path!, 0);
      }

      toast.success(isEdit ? "Atualizado" : "Criado");
      if (!isEdit && saved?.id) setCreatedProduct({ id: saved.id as string, name: payload.name as string });
      else navigate({ to: "/produtos" });
    } catch (err: any) { 
      const message = err?.message || "Erro ao salvar";
      toast.error(message);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border shadow-sm">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{isEdit ? "Editar Produto" : "Novo Produto"}</h1>
          <p className="text-muted-foreground text-sm">Cockpit operacional de cadastro e inteligência.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate({ to: "/produtos" })}>Cancelar</Button>
          <Button onClick={submit} disabled={updateProduct.isPending || createProduct.isPending || uploadingMainImage}>
            {(updateProduct.isPending || createProduct.isPending || uploadingMainImage) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar Alterações" : "Concluir Cadastro"}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-8">
        <TabsList className="w-full justify-start h-auto p-1 bg-muted/50 rounded-xl">
          <TabsTrigger value="geral" className="px-6 py-2.5 rounded-lg">Geral</TabsTrigger>
          <TabsTrigger value="estoque" className="px-6 py-2.5 rounded-lg">Estoque & Fiscal</TabsTrigger>
          <TabsTrigger value="custos" className="px-6 py-2.5 rounded-lg">Custos & Preço</TabsTrigger>
          <TabsTrigger value="marketing" className="px-6 py-2.5 rounded-lg">Marketing & Tags</TabsTrigger>
          <TabsTrigger value="multimidia" className="px-6 py-2.5 rounded-lg">Fotos & Canais</TabsTrigger>
          {form.product_type === 'kit' && (
            <TabsTrigger value="composicao" className="px-6 py-2.5 rounded-lg">Composição do Kit</TabsTrigger>
          )}
        </TabsList>

        <div className="bg-card rounded-2xl border shadow-sm p-8 min-h-[500px]">
          <TabsContent value="geral" className="mt-0 space-y-8">
            <GeneralInfoForm
              form={form}
              setForm={setForm}
              categories={categories}
              suppliers={suppliers}
              errors={formErrors}
              onOpenQuickCategory={() => setCategoryDialogOpen(true)}
              onTitleBlur={() => {
                const formatted = toTitleCasePtBr(form.name);
                if (formatted !== form.name) setForm(s => ({ ...s, name: formatted }));
              }}
            />
          </TabsContent>

          <TabsContent value="estoque" className="mt-0 space-y-8">
            <div className="grid gap-12">
              <LogisticsForm
                form={form}
                setForm={setForm}
                skuGenerating={skuGenerating}
                onRegenerateSku={handleRegenerateSku}
                eanLoading={eanLoading}
                onEanLookup={handleEanLookup}
                errors={formErrors}
              />
              <div className="h-px bg-border" />
              <StockForm
                form={form}
                setForm={setForm}
                isEdit={isEdit}
                onOpenMovement={(t) => { setMovementType(t); setMovementOpen(true); }}
              />
              <div className="h-px bg-border" />
              <FiscalForm
                form={form}
                setForm={setForm}
                onFiscalAutofill={fiscal.applySuggestion as any}
                fiscalLoading={fiscal.masterLoading}
                errors={formErrors}
                categoryName={categoryName}
              />
            </div>
          </TabsContent>

          <TabsContent value="custos" className="mt-0 space-y-8">
            <div className="space-y-6">
              <PricingForm
                form={form}
                setForm={setForm}
                categoryName={categoryName}
                categoryMargin={categoryMargin}
                errors={formErrors}
                onOpenQuickCategory={() => setCategoryDialogOpen(true)}
                onApplyCategoryMargin={applyCategoryMargin}
                onFetchLastPurchase={handleFetchLastPurchase}
              />
              <div className="pt-6 border-t border-slate-100">
                <SuggestedPricesByChannelCard
                  mode="local"
                  costTotalCents={Math.round(totalCost * 100)}
                  targetMarginPct={num(form.margin)}
                  currentStorePriceCents={Math.round(num(form.price) * 100)}
                  productId={product?.id}
                  onApplySuggested={(p) => setForm(s => ({ ...s, price: p.toFixed(2) }))}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="marketing" className="mt-0 space-y-8">
            <MarketingForm
              form={form}
              setForm={setForm}
              tagInput={tagInput}
              setTagInput={setTagInput}
              onAddTag={() => {}}
              onRemoveTag={() => {}}
              suggestedTags={suggestedTags}
              suggestingTags={suggestingTags}
              onSuggestTags={() => {}}
            />
          </TabsContent>

          <TabsContent value="multimidia" className="mt-0 space-y-8">
            <MultimediaForm
              companyId={companyId}
              productId={product?.id}
              form={form}
              setForm={setForm}
              mainImageFile={mainImageFile}
              setMainImageFile={setMainImageFile}
              uploadingMainImage={uploadingMainImage}
              currentMainImageUrl={currentMainImageUrl || ""}
              uploadingVideo={uploadingVideo}
              onVideoUpload={handleVideoUpload}
            />
          </TabsContent>

          {form.product_type === 'kit' && (
            <TabsContent value="composicao" className="mt-0 space-y-8">
              <KitCompositionModule
                companyId={companyId}
                composition={form.composition}
                setComposition={(composition) => setForm(s => ({ ...s, composition }))}
              />
            </TabsContent>
          )}
        </div>
      </Tabs>

      <MovementFormDialog
        open={movementOpen}
        onOpenChange={setMovementOpen}
        companyId={companyId}
        defaultProductId={product?.id || ""}
        defaultType={movementType}
        onCompleted={() => qc.invalidateQueries({ queryKey: productsKeys.all })}
      />
      <SupplierQuickFormDialog
        companyId={companyId}
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        onCreated={(s) => setForm(prev => ({ ...prev, supplier_id: s.id }))}
      />
      {createdProduct && (
        <ProductCreatedDialog
          open={!!createdProduct}
          onOpenChange={v => !v && setCreatedProduct(null)}
          productId={createdProduct.id}
          productName={createdProduct.name}
          onCreateAnother={() => {
            setCreatedProduct(null);
            setForm(empty);
            setTab("geral");
            navigate({ to: "/produtos/novo" });
          }}
        />
      )}
      <CategoryQuickFormDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        onCreated={(c) => setForm(prev => ({ ...prev, category_id: c.id }))}
        onCreate={(name) => createCategory.mutateAsync({ name })}
        isPending={createCategory.isPending}
      />
    </div>
  );
}
