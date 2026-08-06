import { useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  computeOfficialPricing,
  resolveChannelFee,
  solvePriceForTargetProfit,
} from "@/features/pricing/official";
import { ErrorBoundary } from "react-error-boundary";

/** Comissão clássica do Mercado Livre (canal, não taxa de recebimento). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Check,
  Copy,
  Loader2,
  Search,
  ShoppingBag,
  ExternalLink,
  Smartphone,
  Sparkles,
  RefreshCw,
  X,
  ArrowLeft,
  ArrowRight,
  GripVertical,
  AlertTriangle,
  Wand2,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  publishProductToMercadoLivre,
  predictMercadoLivreCategory,
} from "@/lib/mercadolivre-publish.functions";
import { processProductImages } from "@/features/products/lib/image-processing.functions";
import { generateMercadoLivreDescription } from "@/lib/mercadolivre-ai.functions";
import { getMercadoLivreIntegration, getMercadoLivreCategoryAttributes } from "@/lib/mercadolivre.functions";
import { validateMercadoLivreRequirements } from "@/features/products/utils/ml-validation";
import { calculateMLFinalPrice, calculateMLNetValue, DEFAULT_ML_SETTINGS } from "../utils/ml-pricing";
import { getMercadoLivreSettings } from "../lib/mercadolivre-settings.functions";
import { withRetry } from "@/lib/retry";

import { getProductPricingIntelligence } from "@/features/pricing/lib/product-pricing.functions";
import { getProductChannelSettings } from "@/features/pricing/lib/channel-settings.functions";
import { productImagesService } from "@/features/products/services/product-images.service";
import { formatCurrency } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Product } from "../types";

interface Props {
  product: Product;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ListingType = "gold_special" | "gold_pro";
type Condition = "new" | "used";

interface CategoryHit {
  categoryId: string;
  categoryName: string;
  domainName: string | null;
}

export function PublishToMercadoLivreDialog({ product, open, onOpenChange }: Props) {
  // Reset de estados locais e de erro antes de montar o conteúdo pesado
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (open) {
      setKey(prev => prev + 1);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed left-[50%] top-[50%] z-50 grid w-full max-w-3xl translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-0 shadow-lg duration-200 h-[85vh] flex flex-col overflow-hidden">
        <ErrorBoundary
          key={key}
          fallbackRender={({ error }: { error: any }) => (
            <div className="flex-1 flex flex-col items-center justify-center p-8 space-y-4 text-center">
              <div className="bg-destructive/10 p-4 rounded-full">
                <AlertTriangle className="h-10 w-10 text-destructive" />
              </div>
              <div className="max-w-md w-full">
                <h2 className="text-xl font-bold text-white">Falha ao carregar dados</h2>
                <p className="text-slate-400 mt-2 text-sm">
                  Não foi possível preparar as informações do produto para o Mercado Livre. 
                </p>
                
                <div className="mt-6 p-4 bg-slate-900 border border-slate-800 rounded-md text-left overflow-auto max-h-[300px]">
                  <p className="text-destructive font-mono text-xs break-all">
                    {String(error)}
                  </p>
                  {error?.stack && (
                    <pre className="mt-2 text-[10px] text-slate-500 font-mono leading-tight whitespace-pre-wrap">
                      {String(error.stack)}
                    </pre>
                  )}
                </div>
              </div>
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="border-slate-700 text-slate-300 hover:bg-slate-900"
              >
                Fechar Diálogo
              </Button>
            </div>
          )}
        >
          <PublishToMercadoLivreDialogContent key={product?.id} product={product} open={open} onOpenChange={onOpenChange} />
        </ErrorBoundary>
      </DialogContent>
    </Dialog>
  );
}

function PublishToMercadoLivreDialogContent({ product, open, onOpenChange }: Props) {
  // Defensive check: if product is missing, show a clear message instead of crashing
  if (!product) {
    throw new Error("Dados do produto não fornecidos ao diálogo.");
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  const qc = useQueryClient();
  const predictFn = useServerFn(predictMercadoLivreCategory);
  const publishFn = useServerFn(publishProductToMercadoLivre);
  const integrationFn = useServerFn(getMercadoLivreIntegration);
  const generateDescFn = useServerFn(generateMercadoLivreDescription);
  const getCategoryAttrsFn = useServerFn(getMercadoLivreCategoryAttributes);

  const [activeTab, setActiveTab] = useState("info");

  // Status da integração: bloqueia publicação se expirado
  const integrationQuery = useQuery({
    queryKey: ["mercadolivre", "integration-status"],
    queryFn: () => integrationFn(),
    enabled: open,
    staleTime: 30_000,
  });
  const isExpired =
    integrationQuery.data?.status === "expired" ||
    integrationQuery.data?.status === "disconnected" ||
    integrationQuery.data?.status === "credentials_only";

  // Preço sugerido do Mercado Livre (mesma fórmula do card "Preços por canal")
  const pricingQuery = useQuery({
    queryKey: ["pricing", "product-intelligence", product?.company_id, product?.id],
    queryFn: () =>
      getProductPricingIntelligence({
        data: { companyId: product?.company_id, productId: product?.id },
      }),
    enabled: open && Boolean(product?.company_id && product?.id),
    staleTime: 60_000,
  });
  const channelSettingsQuery = useQuery({
    queryKey: ["pricing", "channel-settings", product?.company_id, product?.id],
    queryFn: () =>
      getProductChannelSettings({
        data: { companyId: product?.company_id, productId: product?.id },
      }),
    enabled: open && Boolean(product?.company_id && product?.id),
    staleTime: 60_000,
  });

  const mlSuggestedPrice = useMemo(() => {
    const snap = pricingQuery.data;
    if (!snap) return null;
    const costTotal = (snap.product?.costTotalCents ?? 0) / 100;
    const currentStorePrice = (snap.product?.currentPriceCents ?? 0) / 100;
    const targetMarginPct = snap.targetMarginPct;
    const mlChan = channelSettingsQuery.data?.channels?.ml;
    const globalStrategy = channelSettingsQuery.data?.globalStrategy ?? "policy";
    const strategy = mlChan?.strategy ?? globalStrategy;
    // Taxa do canal — catálogo canônico do motor, com override da empresa.
    const channelFee = resolveChannelFee("ml", mlChan);
    const fixedCost = channelFee.fixedFee;
    const marginPct =
      typeof mlChan?.marginPct === "number" && mlChan.marginPct >= 0
        ? mlChan.marginPct
        : targetMarginPct;
    const feePct = channelFee.feePct;
    let raw = 0;
    if (strategy === "keep_store_profit") {
      if (!(currentStorePrice > 0) || currentStorePrice <= costTotal) return null;
      // MOTOR ÚNICO — o preço que preserva o lucro da loja é resolvido pelo motor.
      const solved = solvePriceForTargetProfit(
        {
          companyId: product?.company_id ?? "",
          productId: product?.id ?? "",
          costs: { acquisition: costTotal },
          margins: { minPct: 0, targetPct: marginPct },
          fee: { pct: feePct, fixed: fixedCost, label: "Mercado Livre" },
          module: "products.publish-ml",
        },
        currentStorePrice - costTotal,
      );
      if (solved == null) return null;
      raw = solved;
    } else {
      // MOTOR ÚNICO (FASE 1/2) — nenhuma fórmula local.
      const official = computeOfficialPricing({
        companyId: product?.company_id ?? "",
        productId: product?.id ?? "",
        costs: { acquisition: costTotal },
        margins: { minPct: 0, targetPct: marginPct },
        fee: { pct: feePct, fixed: fixedCost, label: "Mercado Livre" },
        module: "products.publish-ml",
      });
      raw = official.recommendedPrice;
    }
    if (!Number.isFinite(raw) || raw <= 0) return null;
    // Arredonda para o próximo múltiplo terminado em .90
    const base = Math.floor(raw);
    const candidate = base + 0.9;
    return candidate + 1e-9 >= raw ? candidate : base + 1.9;
  }, [pricingQuery.data, channelSettingsQuery.data, product?.company_id, product?.id]);

  const rawProductPrice = Number(product?.price || 0);
  const initialTitle = useMemo(() => (product?.name || "").slice(0, 60), [product]);
  const [title, setTitle] = useState(initialTitle);
  const [targetProfit, setTargetProfit] = useState<number | null>(null);
  const [walletTarget, setWalletTarget] = useState<string>(rawProductPrice > 0 ? rawProductPrice.toString() : "");
  const [price, setPrice] = useState<number>(rawProductPrice);
  const [priceTouched, setPriceTouched] = useState(false);
  const getSettingsFn = useServerFn(getMercadoLivreSettings);
  const { data: mlSettings } = useQuery({
    queryKey: ["mercadolivre-settings"],
    queryFn: () => getSettingsFn(),
    staleTime: 60_000,
  });

  const settings = mlSettings || DEFAULT_ML_SETTINGS;

  const [usingMlSuggested, setUsingMlSuggested] = useState(false);
  const [descCopied, setDescCopied] = useState(false);

  const [quantity, setQuantity] = useState<number>(
    Math.max(1, Math.floor(Number(product?.stock || 0))),
  );
  const [description, setDescription] = useState(product?.description || "");
  const [categoryId, setCategoryId] = useState("");
  const [categoryLabel, setCategoryLabel] = useState("");
  const [categorySearch, setCategorySearch] = useState(initialTitle);
  const [suggestions, setSuggestions] = useState<CategoryHit[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [autoSuggested, setAutoSuggested] = useState(false);
  const [listingType, setListingType] = useState<ListingType>("gold_special");
  const [condition, setCondition] = useState<Condition>("new");

  // Ficha técnica estendida (bolsas/vestuário) — enviada como attributes extras.
  const [productType, setProductType] = useState(""); // usado no gerador SEO
  const [gender, setGender] = useState("");
  const [material, setMaterial] = useState("");
  const [bagType, setBagType] = useState("");
  const [style, setStyle] = useState("");
  const [color, setColor] = useState("");
  // Marca (BRAND) e Modelo (MODEL) editáveis antes de enviar ao ML.
  const [brand, setBrand] = useState<string>("Generica");
  const [model, setModel] = useState<string>(() => {
    const currentModel = (product?.model || "").trim();
    if (!currentModel) {
      const words = (product?.name || "").slice(0, 60).split(/\s+/).filter(w => w.length > 2);
      return words[0] || "Padrão";
    }
    return currentModel;
  });
  // Atributos opcionais otimizados (aumentam a nota do anúncio).
  // Enviados sempre no payload — com defaults, sobrescritos pela IA/usuário.
  const [pattern, setPattern] = useState("Liso");
  const [withZipper, setWithZipper] = useState("Sim");
  const [ageGroup, setAgeGroup] = useState("Adultos");
  const [season, setSeason] = useState("Permanente");

  // Seleção de fotos (até 5). Guarda os `path` no bucket product-images.
  const [selectedPhotoPaths, setSelectedPhotoPaths] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);

  const [localImageUrls, setLocalImageUrls] = useState<Map<string, string>>(new Map());
  const [imgErrorMap, setImgErrorMap] = useState<Map<string, boolean>>(new Map());
  const [videoUrl, setVideoUrl] = useState((product as any)?.video_url ?? "");
  const autoRanRef = useRef(false);
  
  // Fotos do produto — para permitir seleção manual (até 5) no diálogo.
  const photosQuery = useQuery({
    queryKey: ["product-images", product?.id],
    queryFn: () => productImagesService.list(product?.id ?? ""),
    enabled: open && !!product?.id,
    staleTime: 60_000,
  });
  const photoPaths = useMemo(
    () =>
      (photosQuery.data ?? [])
        .map((img) => (img as { path: string | null }).path)
        .filter((p): p is string => !!p),
    [photosQuery.data],
  );
  const photoSignedUrlsQuery = useQuery({
    queryKey: ["product-images-signed", product?.id, photoPaths.join("|")],
    queryFn: () => productImagesService.signedUrls(photoPaths, 60 * 60),
    enabled: open && photoPaths.length > 0 && !!product?.id,
    staleTime: 60_000,
  });
  const photoUrlByPath = useMemo(() => {
    const map = new Map<string, string>();
    const isInvalid = (u: string) => typeof u === 'string' && (
      u.toLowerCase().startsWith('failed') || 
      u.toLowerCase().startsWith('error') || 
      u.toLowerCase().includes('background...')
    );
    
    // Primeiro as URLs assinadas do banco
    for (const it of photoSignedUrlsQuery.data ?? []) {
      if (it.path && it.signedUrl && !isInvalid(it.signedUrl)) {
        map.set(it.path, it.signedUrl);
      }
    }
    // Depois as URLs locais (IA, geradas ou recém-upadas) que sobrescrevem ou complementam
    localImageUrls.forEach((url, path) => {
      if (!isInvalid(url)) {
        map.set(path, url);
      }
    });
    return map;
  }, [photoSignedUrlsQuery.data, localImageUrls]);

  // Imagens para override (sem remoção de fundo, apenas envio direto)
  const imageOverrides = useMemo(() => {
    const overrides: Record<string, string> = {};
    localImageUrls.forEach((url, path) => {
      const isInvalid = (u: string) => typeof u === 'string' && (
        u.toLowerCase().startsWith('failed') || 
        u.toLowerCase().startsWith('error') || 
        u.toLowerCase().includes('background...')
      );
      if (url.startsWith('http') && !isInvalid(url)) {
        overrides[path] = url;
      }
    });
    return overrides;
  }, [localImageUrls]);

  // Atributos estendidos (extraídos da ficha técnica preenchida)
  const extraAttributes = useMemo(() => {
    const list: Array<{ id: string; value_name: string }> = [];
    const push = (id: string, value: string) => {
      const v = value.trim();
      if (v) list.push({ id, value_name: v });
    };
    push("GENDER", gender || "Feminino");
    push("MAIN_MATERIAL", material);
    push("BAG_TYPE", bagType);
    push("STYLE", style);
    push("PATTERN_NAME", pattern || "Liso");
    push("WITH_ZIPPER", withZipper || "Sim");
    push("AGE_GROUP", ageGroup || "Adultos");
    push("SEASON", season || "Permanente");
    return list;
  }, [gender, material, bagType, style, pattern, withZipper, ageGroup, season]);

  const publish = useMutation({
    mutationFn: async () => {
      const productId = product?.id;
      if (!productId) throw new Error("ID do produto não encontrado");
      return await publishFn({
        data: {
          productId: productId,
          categoryId,
          listingTypeId: listingType,
          condition,
          title,
          price,
          availableQuantity: quantity,
          description,
          color: color.trim() || undefined,
          brand: brand.trim() || undefined,
          model: model.trim() || undefined,
          picturePaths: selectedPhotoPaths.length > 0 ? selectedPhotoPaths : undefined,
          imageOverrides,
          extraAttributes: extraAttributes.length > 0 ? extraAttributes : undefined,
          videoUrl: videoUrl.trim() || undefined,
        },
      });
    },
    onSuccess: (res) => {
      toast.success("Anúncio publicado com sucesso no Mercado Livre!", {
        description: res.permalink ?? res.mlItemId,
        action: res.permalink
          ? {
              label: "Abrir",
              onClick: () => window.open(res.permalink!, "_blank", "noopener"),
            }
          : undefined,
      });
      if (product?.id) {
        qc.invalidateQueries({ queryKey: ["product", product.id] });
      }
      qc.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      let errorMessage = "Erro desconhecido na publicação";
      if (err instanceof Error) errorMessage = err.message;
      else if (typeof err === 'string') errorMessage = err;
      else if (err && typeof err === 'object') {
        try { errorMessage = JSON.stringify(err, null, 2); } catch { errorMessage = String(err); }
      }
      toast.error("Erro no Mercado Livre", {
        description: (
          <div className="mt-2 text-xs font-mono bg-slate-900 p-2 rounded text-slate-100 max-h-[300px] overflow-auto whitespace-pre-wrap">
            {errorMessage}
          </div>
        ),
        duration: 15000,
      });
      console.error("[MercadoLivre] Falha na publicação:", errorMessage);
    },
  });


  // Reset state on open logic removed in favor of `key={product?.id}` for initializations.
  // The state is now initialized directly in useState hooks above.
  useEffect(() => {
    if (open) {
      publish.reset();
    }
  }, [open, publish]);

  // Limpeza automática de URLs de erro no estado
  useEffect(() => {
    if (!open) return;
    const isInvalid = (u: string) => typeof u === 'string' && (
      u.toLowerCase().startsWith('failed') || 
      u.toLowerCase().startsWith('error') || 
      u.toLowerCase().includes('background...')
    );
    
    let hasChanges = false;
    const nextLocal = new Map();
    
    localImageUrls.forEach((url, path) => {
      if (isInvalid(url)) {
        hasChanges = true;
      } else {
        nextLocal.set(path, url);
      }
    });

    if (hasChanges) {
      setLocalImageUrls(nextLocal);
    }
  }, [open]); // Removido localImageUrls das dependências para evitar loop infinito

  // Sincronização automática do preço final com base no "No Bolso" e tipo de anúncio
  // Protegido contra loop infinito comparando referências estáveis
  useEffect(() => {
    if (!open) return;
    const desired = Number(walletTarget);
    if (!(desired > 0)) return;

    const isPremium = listingType === "gold_pro";
    const calculatedFinal = calculateMLFinalPrice(desired, listingType, settings);
    const roundedFinal = Math.ceil(calculatedFinal * 100) / 100;

    // Se o preço atual for diferente do calculado, atualiza
    if (Math.abs(price - roundedFinal) > 0.01) {
      setPrice(roundedFinal);
    }
  }, [walletTarget, listingType, open]); // Removido price das dependências

  // Se o preço sugerido do ML estiver disponível e o usuário não tiver definido um alvo "No Bolso",
  // aplica como padrão (só se o usuário ainda não editou manualmente).
  useEffect(() => {
    if (!open || priceTouched || walletTarget !== "") return;
    if (mlSuggestedPrice && mlSuggestedPrice > 0) {
      setPrice(mlSuggestedPrice);
      setUsingMlSuggested(true);
    }
  }, [open, priceTouched, mlSuggestedPrice, walletTarget]);

  async function runPredict(query: string, opts?: { auto?: boolean }) {
    if (!query.trim()) return;
    setIsSuggesting(true);
    try {
      const hits = await predictFn({ data: { title: query } });
      setSuggestions(hits);
      if (opts?.auto && hits.length > 0) {
        const top = hits[0];
        setCategoryId(top.categoryId);
        setCategoryLabel(`${top.categoryId} — ${top.categoryName}`);
        setAutoSuggested(true);
      } else if (!opts?.auto && hits.length === 0) {
        toast.info("Nenhuma categoria encontrada.");
      }
    } catch (err) {
      if (!opts?.auto) {
        toast.error(err instanceof Error ? err.message : "Falha ao buscar categoria");
      }
    } finally {
      setIsSuggesting(false);
    }
  }

  // Auto-suggest category on open based on product title
  useEffect(() => {
    if (!open || autoRanRef.current) return;
    const t = (product?.name ?? "").trim();
    if (!t) return;
    autoRanRef.current = true;
    void runPredict(t, { auto: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

  // Debounced search when user types in category search box
  useEffect(() => {
    if (!open) return;
    const q = categorySearch.trim();
    if (!q || q.length < 3) return;
    const handle = setTimeout(() => {
      void runPredict(q);
    }, 400);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorySearch, open]);

  const [attrLoading, setAttrLoading] = useState(false);
  useEffect(() => {
    if (!open || !categoryId) return;
    
    async function autoFillAttributes() {
      setAttrLoading(true);
      try {
        const attrs = await getCategoryAttrsFn({ data: { categoryId } });
        // Mapeamento automático básico para campos obrigatórios comuns
        // se eles estiverem vazios.
        const findVal = (id: string, search: string[]) => {
          const attr = attrs.find((a: any) => a.id === id);
          if (!attr || !attr.values) return "";
          const match = attr.values.find((v: any) => 
            search.some(s => v.name.toLowerCase().includes(s.toLowerCase()))
          );
          return match?.name || attr.values[0]?.name || "";
        };

        if (!gender) setGender(findVal("GENDER", ["Feminino", "Mulher", "Femea"]));
        if (!material) setMaterial(findVal("MAIN_MATERIAL", ["Sintético", "Couro", "Lona"]));
        if (!pattern) setPattern(findVal("PATTERN_NAME", ["Liso", "Solido"]));
        if (!ageGroup) setAgeGroup(findVal("AGE_GROUP", ["Adulto", "Adultos"]));
        if (!withZipper) setWithZipper(findVal("WITH_ZIPPER", ["Sim", "Yes"]));
        if (!season) setSeason(findVal("SEASON", ["Permanente", "Toda"]));
        setBrand("Generica");
        
        toast.info("Atributos obrigatórios pré-preenchidos para esta categoria.");
      } catch (err) {
        console.warn("Falha ao buscar atributos da categoria", err);
      } finally {
        setAttrLoading(false);
      }
    }

    void autoFillAttributes();
  }, [categoryId, open]);

  // Fotos do produto — para permitir seleção manual (até 5) no diálogo.

  // Ao carregar fotos, pré-seleciona até 5 primeiras (se ainda não escolheu).
  useEffect(() => {
    if (!open) return;
    if (selectedPhotoPaths.length > 0) return;
    // Pega até 5 fotos registradas no produto (Capa + Detalhes)
    if (photoPaths.length === 0) return;
    setSelectedPhotoPaths(photoPaths.slice(0, 5));
  }, [open, photoPaths, selectedPhotoPaths.length]);

  function togglePhoto(path: string) {
    setSelectedPhotoPaths((prev) => {
      if (prev.includes(path)) return prev.filter((p) => p !== path);
      if (prev.length >= 5) {
        toast.info("Você pode selecionar no máximo 5 fotos.");
        return prev;
      }
      return [...prev, path];
    });
  }

  const uploadPhoto = useMutation({
    mutationFn: async ({ file, slotIndex }: { file: File; slotIndex: number }) => {
      const nextPosition = photosQuery.data?.length ?? 0;
      if (!product?.company_id || !product?.id) throw new Error("Dados da empresa ou produto não encontrados");
      const path = await productImagesService.upload(product.company_id, product.id, file);
      
      // Get the signed URL to show immediately
      const tempUrls = await productImagesService.signedUrls([path], 60 * 60 * 24);
      const url = tempUrls[0]?.signedUrl;
      
      if (!url) throw new Error("Falha ao gerar URL da imagem");

      // Save the local URL mapping for immediate display
      setLocalImageUrls(prev => new Map(prev).set(path, url));

      // Create the record in the database
      await productImagesService.createRecord(product.company_id, product.id, path, nextPosition);

      return path;
    },
    onSuccess: (path, { slotIndex }) => {
      setSelectedPhotoPaths((prev) => {
        const newPaths = [...prev];
        if (slotIndex < newPaths.length) {
          newPaths[slotIndex] = path;
        } else if (newPaths.length < 5) {
          newPaths.push(path);
        }
        return newPaths;
      });
      if (product?.id) {
        qc.invalidateQueries({ queryKey: ["product-images", product.id] });
      }
      qc.invalidateQueries({ queryKey: ["product-images-signed"] });
      toast.success("Foto adicionada com sucesso.");
    },
    onError: (err) => {
      toast.error("Falha no processamento", { description: (err as Error).message });
    },
    onSettled: () => setUploadingSlot(null),
  });

  function openFilePicker(slotIndex: number) {
    setUploadingSlot(slotIndex);
    fileInputRef.current?.click();
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) {
      setUploadingSlot(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem.");
      setUploadingSlot(null);
      return;
    }

    if (uploadingSlot !== null && selectedPhotoPaths[uploadingSlot]) {
      const oldPath = selectedPhotoPaths[uploadingSlot];
      setSelectedPhotoPaths(prev => prev.filter(p => p !== oldPath));
    }

    uploadPhoto.mutate({ file, slotIndex: uploadingSlot ?? 0 });
  }

  function movePhoto(index: number, direction: "left" | "right") {
    const newPaths = [...selectedPhotoPaths];
    const newIndex = direction === "left" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newPaths.length) return;
    [newPaths[index], newPaths[newIndex]] = [newPaths[newIndex], newPaths[index]];
    setSelectedPhotoPaths(newPaths);
  }

  const reprocessPhoto = useMutation({
    mutationFn: async ({ path, index }: { path: string; index: number }) => {
      // Pega a URL assinada atual
      const url = photoUrlByPath.get(path);
      if (!url) throw new Error("URL da imagem não encontrada");

      const res = await withRetry(
        () => processProductImages({
          data: {
            images: [{ id: path, url, isMain: index === 0 }],
            enableMultiview: false,
          },
        }),
        {
          onRetry: (err, attempt) => {
            console.warn(`Retry attempt ${attempt} for (re)processProductImages due to error:`, err);
          }
        }
      );

      if (!res.success || !res.processedImages[0]) {
        throw new Error("Falha ao processar imagem");
      }

      // Em um cenário real, o processamento de imagem salvaria no storage e retornaria um novo path ou sobrescreveria.
      // Aqui vamos simular o sucesso e atualizar o cache.
      return res.processedImages[0];
    },
    onSuccess: (processed, { path }) => {
      const isInvalid = (u: string) => typeof u === 'string' && (
        u.toLowerCase().startsWith('failed') || 
        u.toLowerCase().startsWith('error') || 
        u.toLowerCase().includes('background...')
      );
      
      if (processed.processedUrl && !isInvalid(processed.processedUrl)) {
        setLocalImageUrls(prev => {
          const next = new Map(prev);
          next.set(path, processed.processedUrl!);
          return next;
        });
      } else {
        toast.info("A IA não retornou um resultado válido, mantendo original.");
      }
      if (product?.id) {
        qc.invalidateQueries({ queryKey: ["product-images-signed", product.id] });
      }
      toast.success("Imagem tratada com IA com sucesso.");
    },
    onError: (err) => {
      toast.error("Falha ao tratar imagem", { description: (err as Error).message });
    },
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setSelectedPhotoPaths((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);

        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  // Componente interno para item ordenável
  function SortablePhotoItem({ 
    path, 
    index, 
    url, 
    onToggle, 
  }: { 
    path: string; 
    index: number; 
    url?: string;
    onToggle: (p: string) => void;
  }) {
    const isProcessing = (uploadPhoto.isPending && uploadingSlot === index);
    const hasError = imgErrorMap.get(path) === true;

    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: path });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 10 : undefined,
      pointerEvents: isProcessing ? 'none' as const : 'auto' as const,
    };

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`group relative aspect-square overflow-hidden rounded-md border-2 transition-all min-w-[100px] min-h-[100px] sm:min-w-0 sm:min-h-0 ${
          isDragging ? "border-primary opacity-50 scale-105" : "border-primary ring-2 ring-primary/30"
        } ${isProcessing ? "cursor-wait" : ""}`}
      >
        {url && !hasError ? (
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover rounded-lg"
            loading="lazy"
            onError={() => {
              console.error("Erro ao carregar imagem no slot", index + 1, url);
              setImgErrorMap(prev => new Map(prev).set(path, true));
            }}
          />
        ) : (
          <div 
            className="h-full w-full bg-muted cursor-pointer flex items-center justify-center"
            onClick={() => openFilePicker(index)}
          >
            <span className="text-muted-foreground text-[10px] text-center px-1">
              {hasError ? "Erro Carregamento" : "Vazio"}
            </span>
          </div>
        )}
        
        {/* Loader de Otimização */}
        {isProcessing ? (
          <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/70 text-white backdrop-blur-[2px]">
            <Loader2 className="h-8 w-8 animate-spin mb-2 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 text-center drop-shadow-md">Enviando...</span>
          </div>
        ) : null}
        
        {/* Grip handle for drag */}
        {!isProcessing && (
          <div 
            {...attributes} 
            {...listeners}
            className="absolute inset-0 z-10 cursor-grab active:cursor-grabbing"
            title="Arraste para reordenar"
          />
        )}

        {/* Badge de Posição */}
        <span className="absolute left-1 top-1 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm sm:h-4 sm:w-4 sm:text-[9px]">
          {index + 1}
        </span>

        {/* Botão Remover (X) */}
        {!isProcessing && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(path);
            }}
            className="absolute right-1 top-1 z-50 flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow-lg ring-2 ring-white hover:bg-red-600 active:scale-95 transition-all"
            title="Remover foto"
          >
            <X className="h-4 w-4 stroke-[3px]" />
          </button>
        )}

        {/* Botões de Reordenação e IA Overlay */}
        {!isProcessing && (
          <div className="absolute inset-x-0 bottom-0 z-30 flex flex-col gap-1 bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="flex justify-between gap-1">
            <button
              type="button"
              disabled={index === 0}
              onClick={(e) => {
                e.stopPropagation();
                movePhoto(index, "left");
              }}
              className="flex h-5 w-full items-center justify-center rounded bg-white/20 text-white hover:bg-white/40 disabled:opacity-30"
            >
              <ArrowLeft className="h-3 w-3" />
            </button>
            <button
              type="button"
              disabled={index === selectedPhotoPaths.length - 1}
              onClick={(e) => {
                e.stopPropagation();
                movePhoto(index, "right");
              }}
              className="flex h-5 w-full items-center justify-center rounded bg-white/20 text-white hover:bg-white/40 disabled:opacity-30"
            >
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          </div>
        )}
      </div>
    );
  }

  // Monta a ficha técnica estendida enviada como attributes extras ao ML.

  // Sugestão de título SEO no padrão oficial ML:
  // [Tipo de Produto] + [Marca] + [Modelo] + [Atributo Principal]
  // Ex.: "Bolsa Feminina Fabíola Caramelo Transversal"
  function buildSeoTitle() {
    const capitalize = (s: string) =>
      s
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => (w.length <= 2 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(" ");

    const tipo = capitalize(productType.trim() || "Bolsa");
    const resBrand = capitalize(brand.trim() || "T&G");
    const resModel = capitalize(model.trim() || (product?.name ?? "").slice(0, 20));
    const resAttr = capitalize(color.trim() || material.trim() || "Liso");

    let out = [tipo, resBrand, resModel, resAttr].filter(Boolean).join(" ");
    
    // Remove palavras proibidas
    const blacklist = ["promoção", "oferta", "grátis", "original", "lançamento", "barato"];
    out = out.split(" ").filter(w => !blacklist.includes(w.toLowerCase())).join(" ");

    if (out.length > 60) out = out.slice(0, 60).trim();

    if (out.length < 25) {
      toast.info("Preencha Marca e Modelo para um título melhor.");
    }

    setTitle(out);
    toast.success("Título otimizado para o Mercado Livre.");
  }


  const generateDesc = useMutation({
    mutationFn: () =>
      generateDescFn({
        data: {
          title: title.trim(),
          price: price > 0 ? price : undefined,
          categoryLabel: categoryLabel || undefined,
          categoryId: categoryId || undefined,
          brand: (product as { brand?: string | null })?.brand ?? undefined,
          productName: product?.name,
          productDetails: product?.description ?? undefined,
          supplier: (product as any)?.supplier || (product as any)?.brand_supplier,
        },
      }),
    onSuccess: (res) => {
      setDescription(res.description);
      if (res.title) setTitle(res.title);
      const attrs = res.attributes;
      if (attrs) {
        if (attrs.product_type) setProductType(attrs.product_type);
        if (attrs.gender) setGender(attrs.gender);
        if (attrs.bag_type) setBagType(attrs.bag_type);
        if (attrs.material) setMaterial(attrs.material);
        if (attrs.style) setStyle(attrs.style);
        if (attrs.color) setColor(attrs.color);
        if (attrs.pattern) setPattern(attrs.pattern);
        if (attrs.with_zipper) setWithZipper(attrs.with_zipper);
        if (attrs.age_group) setAgeGroup(attrs.age_group);
        if (attrs.season) setSeason(attrs.season);
      }
      if (res.title && res.title.trim().length >= 35) {
        setTitle(res.title.slice(0, 60));
      }
      toast.success("Título, descrição e ficha técnica gerados com IA");
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Falha ao gerar descrição");
    },
  });

  const validation = useMemo(() => {
    return validateMercadoLivreRequirements({
      ...product,
      name: title,
      price: price,
      stock: quantity,
      selectedPhotoPaths,
      categoryId,
      brand,
      model,
      listingType,
      walletTarget: Number(walletTarget),
    } as any);
  }, [product, title, price, quantity, selectedPhotoPaths, categoryId, brand, model, listingType, walletTarget]);

  const canPublish = validation.isReady && !publish.isPending && !isExpired;

  return (
    <>
      <DialogHeader className="p-4 border-b border-border bg-slate-950/50 backdrop-blur-sm shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
          <div className="space-y-1">
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Anunciar no Mercado Livre
            </DialogTitle>
            <DialogDescription className="text-xs">
              Revise os dados do produto e escolha a modalidade de anúncio.
            </DialogDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            {validation.isReady ? (
              <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1.5 py-1 px-3">
                <Check className="h-3 w-3" />
                Pronto para Publicar
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1.5 py-1 px-3">
                <AlertTriangle className="h-3 w-3" />
                Pendente
              </Badge>
            )}
            <div className="flex items-center gap-2 w-full max-w-[150px]">
              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500" 
                  style={{ width: `${(validation.requirements.filter(r => r?.isValid).length / (validation.requirements?.length || 1)) * 100}%` }}
                />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground whitespace-nowrap">
                {Math.round((validation.requirements.filter(r => r?.isValid).length / (validation.requirements?.length || 1)) * 100)}%
              </span>
            </div>
          </div>
        </div>
      </DialogHeader>

        {isExpired ? (
          <Alert variant="destructive" className="border-destructive/40">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Conexão com o Mercado Livre expirou</AlertTitle>
            <AlertDescription className="flex flex-col gap-3">
              <span>
                Não foi possível renovar automaticamente o token de acesso. Reautorize a conta para
                voltar a publicar e sincronizar anúncios.
              </span>
              <Button
                type="button"
                variant="outline"
                className="w-fit border-destructive/40 text-destructive hover:bg-destructive/10"
                asChild
              >
                <a href="/configuracoes?tab=integracoes">Reautorizar conta Mercado Livre</a>
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}
        <div className={`flex-1 overflow-hidden flex flex-col ${isExpired ? "pointer-events-none opacity-50" : ""}`}>
          <Tabs defaultValue="info" value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 flex-shrink-0 border-b border-border bg-slate-950/50 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-1">
                    {validation.requirements.map((req, idx) => (
                      <div 
                        key={req?.id || idx} 
                        className={`h-2 w-6 rounded-full border border-background ${req?.isValid ? 'bg-success' : req?.critical ? 'bg-destructive/40' : 'bg-muted'}`}
                        title={req?.label}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {validation.requirements.filter(r => r?.isValid).length}/{validation.requirements.length} Requisitos
                  </span>
                </div>
                <div className="flex gap-1.5 overflow-hidden">
                  {validation.requirements.filter(r => !r?.isValid && r?.critical).slice(0, 2).map(req => (
                    <Badge key={req?.id} variant="outline" className="text-[9px] py-0 h-4 border-destructive/30 text-destructive bg-destructive/5">
                      Falta {req?.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <TabsList className="grid w-full grid-cols-3 h-10 bg-slate-900/50 p-1">
                <TabsTrigger value="info" className="text-xs sm:text-sm gap-1.5">📦 Dados & Fotos</TabsTrigger>
                <TabsTrigger value="price" className="text-xs sm:text-sm gap-1.5">💰 Preço & Estoque</TabsTrigger>
                <TabsTrigger value="desc" className="text-xs sm:text-sm gap-1.5">📝 Ficha & Descrição</TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <TabsContent value="info" className="m-0 space-y-4 p-4 focus-visible:outline-none">
                {/* Título */}
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="ml-title">Título do anúncio</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 text-xs"
                      onClick={buildSeoTitle}
                      title="Gera no padrão [Tipo] [Gênero/Estilo] [Modelo] [Cor]"
                    >
                      <Wand2 className="h-3.5 w-3.5 text-primary" /> Título otimizado (SEO)
                    </Button>
                  </div>
                  <Input
                    id="ml-title"
                    value={title}
                    maxLength={60}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {title.length}/60 caracteres · padrão ML: <strong>Tipo + Gênero/Estilo + Modelo + Cor</strong>
                  </p>
                </div>

                {/* Categoria */}
                <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="ml-category-search" className="flex items-center gap-1.5 text-sm font-semibold">
                      Categoria do Mercado Livre
                      {autoSuggested && categoryId ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          <Sparkles className="h-3 w-3" /> Sugerida
                        </span>
                      ) : null}
                    </Label>
                    {categoryId ? (
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => {
                          setCategoryId("");
                          setCategoryLabel("");
                          setAutoSuggested(false);
                        }}
                      >
                        Trocar
                      </button>
                    ) : null}
                  </div>

                  {categoryId ? (
                    <div className="flex items-center justify-between rounded-md border border-primary/30 bg-primary/5 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">{categoryLabel || categoryId}</p>
                          <p className="text-[11px] text-muted-foreground">{categoryId}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="ml-category-search"
                          className="pl-9"
                          placeholder="Pesquise por nome (ex.: Bolsas, Mochilas)"
                          value={categorySearch}
                          onChange={(e) => setCategorySearch(e.target.value)}
                        />
                        {isSuggesting ? (
                          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        ) : null}
                      </div>

                      {suggestions.length > 0 ? (
                        <div className="max-h-52 overflow-y-auto rounded-md border border-border bg-background">
                          {suggestions.map((s) => (
                            <button
                              key={s.categoryId}
                              type="button"
                              onClick={() => {
                                setCategoryId(s.categoryId);
                                setCategoryLabel(`${s.categoryName}`);
                                setAutoSuggested(false);
                              }}
                              className="flex w-full items-start justify-between gap-3 border-b border-border/60 px-3 py-2 text-left text-sm last:border-0 hover:bg-accent"
                            >
                              <div className="min-w-0">
                                <p className="truncate font-medium">{s.categoryName}</p>
                                {s.domainName ? (
                                  <p className="truncate text-xs text-muted-foreground">{s.domainName}</p>
                                ) : null}
                              </div>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {s.categoryId}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : !isSuggesting && categorySearch.trim().length >= 3 ? (
                        <p className="text-xs text-muted-foreground">Nenhuma categoria encontrada.</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Digite 3+ caracteres para buscar.</p>
                      )}
                    </>
                  )}
                </div>

                {/* Fotos */}
                <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold">Fotos do anúncio</Label>
                    <span className="text-xs text-muted-foreground">{selectedPhotoPaths.length}/5 selecionadas</span>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} />
                  
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={selectedPhotoPaths} strategy={rectSortingStrategy}>
                        {Array.from({ length: 5 }).map((_, slot) => {
                          const path = selectedPhotoPaths[slot];
                          const url = path ? photoUrlByPath.get(path) : undefined;
                          const isUploadingHere = uploadPhoto.isPending && uploadingSlot === slot;
                          
                          if (path) {
                            return (
                              <SortablePhotoItem key={path} path={path} index={slot} url={url} onToggle={togglePhoto} />
                            );
                          }
                          
                          return (
                            <button
                              key={`slot-${slot}`}
                              type="button"
                              onClick={() => openFilePicker(slot)}
                              disabled={uploadPhoto.isPending}
                              className="flex aspect-square min-w-[100px] h-[100px] items-center justify-center rounded-md border-2 border-dashed border-border bg-background/50 text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-60"
                            >
                              {isUploadingHere ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="text-2xl">+</span>}
                            </button>
                          );
                        })}
                      </SortableContext>
                    </DndContext>
                  </div>

                  {(() => {
                    const unselected = photoPaths.filter((p) => !selectedPhotoPaths.includes(p));
                    if (unselected.length === 0) return null;
                    return (
                      <div className="mt-1 grid gap-1.5">
                        <p className="text-[10px] font-medium text-muted-foreground">Fotos do produto (clique para incluir):</p>
                        <div className="flex gap-1.5 overflow-x-auto pb-1">
                          {unselected.map((path) => {
                            const url = photoUrlByPath.get(path);
                            return (
                              <button
                                key={path}
                                type="button"
                                onClick={() => togglePhoto(path)}
                                className="aspect-square w-12 h-12 overflow-hidden rounded border border-border hover:border-primary shrink-0"
                              >
                                {url ? <img src={url} alt="" className="h-full w-full object-cover" /> : <div className="h-full w-full bg-muted" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Vídeo */}
                <div className="grid gap-2 border-t border-border pt-4">
                  <Label htmlFor="ml-video" className="flex items-center gap-2 text-sm font-semibold">
                    Vídeo (YouTube)
                    <Badge variant="outline" className="text-[9px] py-0 h-4">Opcional</Badge>
                  </Label>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Input
                      id="ml-video"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                    />
                    {videoUrl && (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) && (
                      <div className="w-full sm:w-32 aspect-video bg-black rounded-md overflow-hidden shrink-0">
                        {(() => {
                          const getYoutubeId = (url: string) => {
                            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                            const match = url.match(regExp);
                            return (match && match[2].length === 11) ? match[2] : null;
                          };
                          const videoId = getYoutubeId(videoUrl);
                          return videoId ? <img src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} alt="Preview" className="w-full h-full object-contain" /> : null;
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="price" className="m-0 space-y-4 p-6 focus-visible:outline-none">
                <div className="grid gap-4">
                  {validation.requirements.find(r => r.id === "price_formula")?.isValid === false && (
                    <Alert variant="destructive" className="py-2 bg-destructive/10 border-destructive/20">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle className="text-xs font-bold uppercase">Preço Insuficiente</AlertTitle>
                      <AlertDescription className="text-[11px]">
                        O preço de venda atual não cobre as taxas de comissão e o frete fixo/grátis ({formatCurrency(settings.freeShippingValue)}). 
                        Aumente o preço ou escolha uma modalidade com menor custo.
                      </AlertDescription>
                    </Alert>
                  )}
                  {/* Cards de Modalidade */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(() => {
                      const desired = Number(walletTarget);
                      const isPremium = listingType === "gold_pro";
                      const classicFinal = calculateMLFinalPrice(desired, "gold_special", settings);
                      const classicShipping = classicFinal >= settings.freeShippingThreshold ? settings.freeShippingValue : 0;
                      const classicFixedFee = (!isPremium && classicFinal < settings.freeShippingThreshold && classicFinal > 0) ? settings.fixedFeeValue : 0;
                      
                      const premiumFinal = calculateMLFinalPrice(desired, "gold_pro", settings);
                      const premiumShipping = premiumFinal >= settings.freeShippingThreshold ? settings.freeShippingValue : 0;

                      return (
                        <>
                          <button
                            type="button"
                            onClick={() => setListingType("gold_special")}
                            className={`flex flex-col gap-3 p-4 rounded-xl border-2 text-left transition-all relative ${
                              listingType === "gold_special"
                                ? "border-primary bg-primary/5 ring-2 ring-primary/10 shadow-sm"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Clássico</span>
                              {listingType === "gold_special" && <Check className="h-4 w-4 text-primary" />}
                            </div>
                            <div>
                              <span className="text-xl font-black text-primary">{classicFinal > 0 ? formatCurrency(classicFinal) : "---"}</span>
                              <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-muted-foreground">Comissão ({(settings.classicFeePercent * 100).toFixed(1)}%)</span>
                                  <span className="font-medium">-{classicFinal > 0 ? formatCurrency(classicFinal * settings.classicFeePercent) : "---"}</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-muted-foreground">Frete (Fixo/Gratis)</span>
                                   <span className="font-medium">-{classicShipping > 0 ? formatCurrency(classicShipping) : (classicFixedFee > 0 ? formatCurrency(classicFixedFee) : "R$ 0,00")}</span>
                                </div>
                                <div className="flex justify-between text-[10px] pt-1 border-t border-primary/10 font-semibold text-primary/80">
                                  <span>Líquido a receber</span>
                                  <span>{classicFinal > 0 ? formatCurrency(desired) : "---"}</span>
                                </div>
                              </div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setListingType("gold_pro")}
                            className={`flex flex-col gap-3 p-4 rounded-xl border-2 text-left transition-all relative ${
                              listingType === "gold_pro"
                                ? "border-primary bg-primary/5 ring-2 ring-primary/10 shadow-sm"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Premium 💳</span>
                              <Badge className="text-[8px] h-3.5 px-1 bg-amber-500 hover:bg-amber-600 border-none">Destaque</Badge>
                            </div>
                            <div>
                              <span className="text-xl font-black text-primary">{premiumFinal > 0 ? formatCurrency(premiumFinal) : "---"}</span>
                              <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-muted-foreground">Comissão ({(settings.premiumFeePercent * 100).toFixed(1)}%)</span>
                                  <span className="font-medium">-{premiumFinal > 0 ? formatCurrency(premiumFinal * settings.premiumFeePercent) : "---"}</span>
                                </div>
                                <div className="flex justify-between text-[10px]">
                                  <span className="text-muted-foreground">Frete (Fixo/Gratis)</span>
                                  <span className="font-medium">-{premiumShipping > 0 ? formatCurrency(premiumShipping) : "R$ 0,00"}</span>
                                </div>
                                <div className="flex justify-between text-[10px] pt-1 border-t border-primary/10 font-semibold text-primary/80">
                                  <span>Líquido a receber</span>
                                  <span>{premiumFinal > 0 ? formatCurrency(desired) : "---"}</span>
                                </div>
                              </div>
                            </div>
                          </button>
                        </>
                      );
                    })()}
                  </div>

                  {/* Input de Preço Final e Quanto recebe */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="grid gap-2 p-3 bg-muted/20 rounded-xl border border-dashed border-border">
                      <Label htmlFor="ml-price" className="text-xs font-semibold text-muted-foreground uppercase tracking-tight">
                        Preço Final de Venda
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id="ml-price"
                          type="number"
                          step="0.01"
                          className={`h-12 font-mono text-xl font-black bg-background border-2 focus-visible:ring-primary ${
                            validation.requirements.find(r => r.id === "price_formula")?.isValid === false 
                            ? "border-destructive focus-visible:ring-destructive" 
                            : ""
                          }`}
                          value={price}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setPrice(val);
                            setPriceTouched(true);
                            setUsingMlSuggested(false);
                            
                            // Re-calcula o líquido reverso para exibição visual imediata
                            const calculatedNet = calculateMLNetValue(val, listingType, settings);
                            setWalletTarget(Math.max(0, calculatedNet).toFixed(2));
                          }}
                        />
                        {usingMlSuggested && !priceTouched && (
                          <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 shrink-0">
                            <Sparkles className="h-3 w-3 mr-1" /> Sugerido
                          </Badge>
                        )}
                        {priceTouched && !usingMlSuggested && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-[10px] border-amber-500/30 text-amber-600 hover:bg-amber-50"
                            onClick={() => {
                              setPriceTouched(false);
                              // Isso vai disparar o useEffect de sincronização
                              const desired = Number(walletTarget);
                              if (desired > 0) {
                                const isPremium = listingType === "gold_pro";
                                const feePct = isPremium ? 0.15 : 0.135; 
                                const shipping = desired >= 79 ? 24.65 : 0;
                                let calculatedFinal = isPremium 
                                  ? (desired + shipping) / 0.85 
                                  : (desired + shipping) / (1 - feePct);
                                
                                if (!isPremium && calculatedFinal < 79) {
                                  calculatedFinal = (desired + 6.5 + shipping) / (1 - feePct);
                                }
                                
                                const roundedFinal = Math.ceil(calculatedFinal * 100) / 100;
                                setPrice(roundedFinal);
                              }
                            }}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" /> Reverter à Fórmula
                          </Button>
                        )}
                      </div>
                      {validation.requirements.find(r => r.id === "price_formula")?.isValid === false && (
                        <p className="text-[10px] text-destructive font-medium animate-in fade-in slide-in-from-top-1">
                          {validation.requirements.find(r => r.id === "price_formula")?.message}
                        </p>
                      )}
                    </div>

                    <div className={`grid gap-2 p-3 rounded-xl border border-dashed transition-colors ${
                      validation.requirements.find(r => r.id === "price_formula")?.isValid === false
                      ? "bg-destructive/5 border-destructive/30"
                      : "bg-success/5 border-success/30"
                    }`}>
                      <Label className={`text-xs font-semibold uppercase tracking-tight ${
                        validation.requirements.find(r => r.id === "price_formula")?.isValid === false
                        ? "text-destructive"
                        : "text-success"
                      }`}>
                        Quanto você recebe (Líquido)
                      </Label>
                      <div className={`flex items-center gap-2 h-12 px-3 bg-background/50 rounded-lg border ${
                        validation.requirements.find(r => r.id === "price_formula")?.isValid === false
                        ? "border-destructive/20"
                        : "border-success/20"
                      }`}>
                        <span className={`font-mono text-xl font-black ${
                          validation.requirements.find(r => r.id === "price_formula")?.isValid === false
                          ? "text-destructive"
                          : "text-success"
                        }`}>
                          {walletTarget ? formatCurrency(Number(walletTarget)) : "---"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Estoque e Condição */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="ml-qty">Estoque disponível</Label>
                      <Input
                        id="ml-qty"
                        type="number"
                        min={1}
                        value={quantity}
                        onChange={(e) => setQuantity(Number(e.target.value))}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Condição</Label>
                      <Select value={condition} onValueChange={(v) => setCondition(v as Condition)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">Novo</SelectItem>
                          <SelectItem value="used">Usado</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="desc" className="m-0 space-y-4 p-6 focus-visible:outline-none">
                {/* Ficha Técnica - Grid */}
                <div className="grid gap-2 rounded-lg border border-border bg-muted/20 p-3">
                  <Label className="text-sm font-semibold">Ficha Técnica (Atributos)</Label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="ml-attr-type" className="text-[10px] text-muted-foreground uppercase">Tipo</Label>
                      <Input id="ml-attr-type" value={productType} onChange={(e) => setProductType(e.target.value)} placeholder="Bolsa" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ml-attr-brand" className="text-[10px] text-muted-foreground uppercase">Marca *</Label>
                      <Input id="ml-attr-brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Generica" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ml-attr-model" className="text-[10px] text-muted-foreground uppercase">Modelo</Label>
                      <Input id="ml-attr-model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="Padrão" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ml-attr-gender" className="text-[10px] text-muted-foreground uppercase">Gênero</Label>
                      <Select value={gender || undefined} onValueChange={setGender}>
                        <SelectTrigger id="ml-attr-gender"><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Feminino">Feminino</SelectItem>
                          <SelectItem value="Masculino">Masculino</SelectItem>
                          <SelectItem value="Sem gênero">Sem gênero</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ml-attr-material" className="text-[10px] text-muted-foreground uppercase">Material</Label>
                      <Input id="ml-attr-material" value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="Couro" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="ml-attr-color" className="text-[10px] text-muted-foreground uppercase">Cor</Label>
                      <Input id="ml-attr-color" value={color} onChange={(e) => setColor(e.target.value)} placeholder="Preta" />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">* Marca é obrigatória para evitar erros de publicação.</p>
                </div>

                {/* Descrição */}
                <div className="grid gap-4">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="ml-desc" className="text-sm font-semibold">Descrição do Anúncio</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[10px]"
                        onClick={async () => {
                          await navigator.clipboard.writeText(description);
                          setDescCopied(true);
                          toast.success("Copiado!");
                          setTimeout(() => setDescCopied(false), 2000);
                        }}
                        disabled={!description.trim()}
                      >
                        {descCopied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                        {descCopied ? "Copiado" : "Copiar"}
                      </Button>
                    </div>

                    <Button
                      type="button"
                      variant="default"
                      className="w-full h-12 text-sm font-bold bg-gradient-to-r from-primary to-primary/80 hover:opacity-90 shadow-lg group transition-all"
                      onClick={() => generateDesc.mutate()}
                      disabled={generateDesc.isPending || !title.trim()}
                    >
                      {generateDesc.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Gerando descrição otimizada...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-5 w-5 text-amber-300 group-hover:scale-110 transition-transform" />
                          ✨ Gerar Descrição Otimizada com IA
                        </>
                      )}
                    </Button>
                  </div>

                  <Textarea
                    id="ml-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={12}
                    className="font-sans text-sm leading-relaxed resize-none focus-visible:ring-primary/30"
                    placeholder="A descrição profissional aparecerá aqui..."
                  />
                  
                  <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                    <span>Dica: Descrições diretas e com benefícios vendem mais.</span>
                    <span className={description.length > 50000 ? "text-destructive font-bold" : ""}>
                      {description.length.toLocaleString()} / 50.000
                    </span>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        <DialogFooter className="px-4 py-4 border-t border-border bg-slate-950/50 backdrop-blur-sm shrink-0">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={publish.isPending}
              className="w-full sm:w-auto h-11"
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => publish.mutate()} 
              disabled={!canPublish}
              className="w-full sm:w-auto h-11 px-8 font-bold"
            >
              {publish.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Publicando…
                </>
              ) : (
                <>
                  <ExternalLink className="mr-2 h-4 w-4" /> Publicar no Mercado Livre
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
    </>
  );
}
