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

import { ProductCreatedDialog } from "../product-created-dialog";
import { SupplierQuickFormDialog } from "./supplier-quick-form-dialog";
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
  video_url: string;
};

const empty: FormState = {
  name: "", sku: "", barcode: "SEM GTIN", ncm: "", cest: "",
  brand: "Genérico", model: "Padrão", description: "", category_id: "",
  supplier_id: "", status: "active", unit: "UN", sales_channels: ["loja_fisica"],
  cost: "0", freight: "0", packaging: "0", insurance: "0", other_costs: "0",
  margin: "", use_category_margin: true, price: "0", stock: "1", min_stock: "0",
  tags: [], weight: "0.3", width: "15", height: "15", length: "15", video_url: "",
};

function toState(p?: Product): FormState {
  if (!p) return empty;
  return {
    name: p.name, sku: p.sku ?? "", barcode: p.barcode ?? "", ncm: p.ncm ?? "",
    cest: (p as any).cest ?? "", brand: p.brand ?? "", model: (p as any).model ?? "",
    description: p.description ?? "", category_id: p.category_id ?? "",
    supplier_id: p.supplier_id ?? "", status: p.status, unit: p.unit,
    sales_channels: (p as any).sales_channels ?? [], cost: String(p.cost),
    freight: String(p.freight), packaging: String(p.packaging ?? 0),
    insurance: String(p.insurance), other_costs: String(p.other_costs),
    margin: String(p.margin), use_category_margin: (p as any).use_category_margin ?? false,
    price: String(p.price), stock: String(p.stock), min_stock: String(p.min_stock),
    tags: p.tags ?? [], weight: String((p as any).weight || ""),
    width: String((p as any).width || ""), height: String((p as any).height || ""),
    length: String((p as any).length || ""), video_url: (p as any).video_url ?? "",
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
  const [createdProduct, setCreatedProduct] = useState<{ id: string; name: string } | null>(null);
  const [mainImageFile, setMainImageFile] = useState<File | null>(null);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [suggestingTags, setSuggestingTags] = useState(false);

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
  const { data: operationalDefaults } = useOperationalDefaults(companyId);
  
  const isEdit = !!product;
  const categoryName = categories.find(c => c.id === form.category_id)?.name || null;
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
    categories,
    ncm: form.ncm,
    cest: form.cest,
    onApply: (v) => setForm((s: any) => ({ ...s, ...v })),
  });
  const [eanLoading, setEanLoading] = useState(false);

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
  const totalCost = num(form.cost) + num(form.freight) + num(form.packaging) + num(form.insurance) + num(form.other_costs);

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

  const submit = async () => {
    const validation = schema.safeParse(form);
    if (!validation.success) {
      return toast.error("Verifique os campos obrigatórios: " + validation.error.errors[0].message);
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
      stock: num(form.stock),
      min_stock: num(form.min_stock),
      weight: num(form.weight),
      width: num(form.width),
      height: num(form.height),
      length: num(form.length),
      sales_channels: form.sales_channels,
    };

    try {
      const saved = isEdit 
        ? await updateProduct.mutateAsync({ id: product.id, input: payload })
        : await createProduct.mutateAsync({ ...payload, company_id: companyId } as ProductInsert);
      
      const savedId = isEdit ? product.id : (saved?.id as string);

      if (mainImageFile) {
        const path = await productImagesService.upload(companyId, savedId, mainImageFile);
        await productImagesService.createRecord(companyId, savedId, path, 0);
        await updateProduct.mutateAsync({ id: savedId, input: { cover_image_path: path } as ProductUpdate });
      }

      toast.success(isEdit ? "Atualizado" : "Criado");
      if (!isEdit && saved?.id) setCreatedProduct({ id: saved.id as string, name: payload.name });
      else navigate({ to: "/produtos" });
    } catch (err) { toast.error("Erro ao salvar"); }
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
          <Button onClick={submit} disabled={updateProduct.isPending || createProduct.isPending}>
            {(updateProduct.isPending || createProduct.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
        </TabsList>

        <div className="bg-card rounded-2xl border shadow-sm p-8 min-h-[500px]">
          <TabsContent value="geral" className="mt-0 space-y-8">
            <GeneralInfoForm
              form={form}
              setForm={setForm}
              categories={categories}
              suppliers={suppliers}
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
                onFiscalAutofill={() => {}}
                fiscalLoading={false}
              />
            </div>
          </TabsContent>

          <TabsContent value="custos" className="mt-0 space-y-8">
            <PricingForm
              form={form}
              setForm={setForm}
              categoryName={categoryName}
              onApplyCategoryMargin={() => {}}
            />
            <SuggestedPricesByChannelCard
              mode="local"
              costTotalCents={Math.round(totalCost * 100)}
              targetMarginPct={num(form.margin)}
              currentStorePriceCents={Math.round(num(form.price) * 100)}
              productId={product?.id}
              onApplySuggested={(p) => setForm(s => ({ ...s, price: p.toFixed(2) }))}
            />
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
              currentMainImageUrl={currentMainImageUrl || ""}
              uploadingVideo={uploadingVideo}
              onVideoUpload={handleVideoUpload}
            />
          </TabsContent>
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
    </div>
  );
}
