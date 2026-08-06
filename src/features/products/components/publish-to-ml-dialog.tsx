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
  publishProductToMercadoLivre,
  predictMercadoLivreCategory,
} from "@/lib/mercadolivre-publish.functions";
import { processProductImages } from "@/features/products/lib/image-processing.functions";
import { generateMercadoLivreDescription } from "@/lib/mercadolivre-ai.functions";
import { getMercadoLivreIntegration, getMercadoLivreCategoryAttributes } from "@/lib/mercadolivre.functions";
import { validateMercadoLivreRequirements } from "@/features/products/utils/ml-validation";
import { withRetry } from "@/lib/retry";

import { getProductPricingIntelligence } from "@/features/pricing/lib/product-pricing.functions";
import { getProductChannelSettings } from "@/features/pricing/lib/channel-settings.functions";
import { productImagesService } from "@/features/products/services/product-images.service";
import { formatCurrency } from "@/lib/format";
import { AlertTriangle, Wand2, Info } from "lucide-react";
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
    queryKey: ["pricing", "product-intelligence", product.company_id, product.id],
    queryFn: () =>
      getProductPricingIntelligence({
        data: { companyId: product.company_id, productId: product.id },
      }),
    enabled: open && Boolean(product.company_id && product.id),
    staleTime: 60_000,
  });
  const channelSettingsQuery = useQuery({
    queryKey: ["pricing", "channel-settings", product.company_id, product.id],
    queryFn: () =>
      getProductChannelSettings({
        data: { companyId: product.company_id, productId: product.id },
      }),
    enabled: open && Boolean(product.company_id && product.id),
    staleTime: 60_000,
  });

  const mlSuggestedPrice = useMemo(() => {
    const snap = pricingQuery.data;
    if (!snap) return null;
    const costTotal = snap.product.costTotalCents / 100;
    const currentStorePrice = snap.product.currentPriceCents / 100;
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
          companyId: product.company_id,
          productId: product.id,
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
        companyId: product.company_id,
        productId: product.id,
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
  }, [pricingQuery.data, channelSettingsQuery.data, product.company_id, product.id]);

  const rawProductPrice = Number(product.price ?? 0);
  const initialTitle = useMemo(() => (product.name ?? "").slice(0, 60), [product]);
  const [title, setTitle] = useState(initialTitle);
  const [targetProfit, setTargetProfit] = useState<number | null>(null);
  const [walletTarget, setWalletTarget] = useState<string>("");
  const [price, setPrice] = useState<number>(rawProductPrice);
  const [priceTouched, setPriceTouched] = useState(false);
  const [usingMlSuggested, setUsingMlSuggested] = useState(false);
  const [descCopied, setDescCopied] = useState(false);

  const [quantity, setQuantity] = useState<number>(
    Math.max(1, Math.floor(Number(product.stock ?? 0))),
  );
  const [description, setDescription] = useState(product.description ?? "");
  const [categoryId, setCategoryId] = useState("");
  const [categoryLabel, setCategoryLabel] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
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
  // Marca (BRAND) e Modelo (MODEL) editáveis antes de enviar ao ML. Marca é
  // obrigatória pela API — o backend faz fallback para "T&G" quando vazia.
  const [brand, setBrand] = useState<string>("");
  const [model, setModel] = useState<string>("");
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
  const [videoUrl, setVideoUrl] = useState("");
  const autoRanRef = useRef(false);

  // Reset state on open
  useEffect(() => {
    if (open) {
      const t = (product.name ?? "").slice(0, 60);
      setTitle(t);
      const rawPrice = Number(product.price ?? 0);
      setPrice(rawPrice);
      setWalletTarget(rawPrice > 0 ? rawPrice.toString() : "");
      setPriceTouched(false);
      setUsingMlSuggested(false);
      setQuantity(Math.max(1, Math.floor(Number(product.stock ?? 0))));
      setDescription(product.description ?? "");
      setCategoryId("");
      setCategoryLabel("");
      setCategorySearch(t);
      setSuggestions([]);
      setAutoSuggested(false);
      setProductType("");
      setGender("");
      setMaterial("");
      setBagType("");
      setStyle("");
      setColor("");
      setBrand(((product as { brand?: string | null }).brand ?? "").trim() || "T&G");
      const currentModel = ((product as any).model ?? "").trim();
      if (!currentModel) {
        // Extrai a primeira palavra significativa do título se modelo estiver vazio
        const words = t.split(/\s+/).filter(w => w.length > 2);
        setModel(words[0] || "Padrão");
      } else {
        setModel(currentModel);
      }
      setPattern("Liso");
      setWithZipper("Sim");
      setAgeGroup("Adultos");
      setSeason("Permanente");
      setSelectedPhotoPaths([]);
      setLocalImageUrls(new Map());
      setImgErrorMap(new Map());
      
      setVideoUrl((product as any).video_url ?? "");
      autoRanRef.current = false;
    }
  }, [open, product]);

  // Limpeza automática de URLs de erro no estado
  useEffect(() => {
    if (!open) return;
    const isInvalid = (u: string) => typeof u === 'string' && (
      u.toLowerCase().startsWith('failed') || 
      u.toLowerCase().startsWith('error') || 
      u.toLowerCase().includes('background...')
    );
    
    let hasChanges = false;
    const nextLocal = new Map(localImageUrls);
    
    localImageUrls.forEach((url, path) => {
      if (isInvalid(url)) {
        nextLocal.delete(path);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      console.warn("Limpando URLs de erro detectadas no estado local");
      setLocalImageUrls(nextLocal);
    }
  }, [localImageUrls, open]);

  // Sincronização automática do preço final com base no "No Bolso" e tipo de anúncio
  useEffect(() => {
    if (!open) return;
    const desired = Number(walletTarget);
    if (!(desired > 0)) return;

    const isPremium = listingType === "gold_pro";
    const feePct = isPremium ? 0.185 : 0.135;
    const fixedFee = desired < 79 && desired > 0 ? 6.5 : 0;
    const shipping = desired >= 79 ? 23.5 : 0;
    const calculatedFinal = (desired + fixedFee + shipping) / (1 - feePct);
    const roundedFinal = Number(calculatedFinal.toFixed(2));

    // Se o preço atual for diferente do calculado, atualiza
    if (Math.abs(price - roundedFinal) > 0.01) {
      setPrice(roundedFinal);
    }
  }, [walletTarget, listingType, open]);

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
    const t = (product.name ?? "").trim();
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
        if (!brand || brand === "Genérico") setBrand(findVal("BRAND", ["T&G", "Genérica"]));
        
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
  const photosQuery = useQuery({
    queryKey: ["product-images", product.id],
    queryFn: () => productImagesService.list(product.id),
    enabled: open,
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
    queryKey: ["product-images-signed", product.id, photoPaths.join("|")],
    queryFn: () => productImagesService.signedUrls(photoPaths, 60 * 60),
    enabled: open && photoPaths.length > 0,
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
      qc.invalidateQueries({ queryKey: ["product-images", product.id] });
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
      qc.invalidateQueries({ queryKey: ["product-images-signed", product.id] });
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
    const resModel = capitalize(model.trim() || (product.name ?? "").slice(0, 20));
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

  const imageOverrides = useMemo(() => {
    const overrides: Record<string, string> = {};
    localImageUrls.forEach((url, path) => {
      // Consideramos override qualquer URL que não seja a original do bucket
      // ou que venha explicitamente do processamento IA
      if (url.startsWith('http')) {
        overrides[path] = url;
      }
    });
    return overrides;
  }, [localImageUrls]);

  const publish = useMutation({
    mutationFn: async () => {
      try {
        return await publishFn({
          data: {
            productId: product.id,
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
      } catch (err) {
        // Intercepta erros de rede ou do servidor antes que eles cheguem ao onError do useMutation
        // se houver lógica de dump no caminho do servidor.
        throw err;
      }
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
      qc.invalidateQueries({ queryKey: ["product", product.id] });
      qc.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    },
    onError: (err: any) => {
      // Exibe a mensagem real retornada pela API do Mercado Livre (sanitizada no handler)
      const message = err instanceof Error ? err.message : "Erro desconhecido na publicação";
      
      toast.error("Erro no Mercado Livre", {
        description: message,
        duration: 8000,
      });
      
      console.error("[MercadoLivre] Falha na publicação:", message);
    },
  });

  const generateDesc = useMutation({
    mutationFn: () =>
      generateDescFn({
        data: {
          title: title.trim(),
          price: price > 0 ? price : undefined,
          categoryLabel: categoryLabel || undefined,
          categoryId: categoryId || undefined,
          brand: (product as { brand?: string | null }).brand ?? undefined,
          productName: product.name,
          productDetails: product.description ?? undefined,
        },
      }),
    onSuccess: (res) => {
      setDescription(res.description);
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
    });
  }, [product, title, price, quantity, selectedPhotoPaths, categoryId, brand, model]);

  const canPublish = validation.isReady && !publish.isPending && !isExpired;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 sm:p-6 pb-2 shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              Anunciar no Mercado Livre
            </DialogTitle>
            {validation.isReady ? (
              <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1.5 py-1 px-3">
                <Check className="h-3 w-3" />
                Pronto para Publicar
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 gap-1.5 py-1 px-3">
                <AlertTriangle className="h-3 w-3" />
                Pendente
              </Badge>
            )}
          </div>
          <DialogDescription>
            Revise os dados do produto e escolha a categoria e o tipo de anúncio antes de publicar.
          </DialogDescription>
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

        <div className={`flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 ${isExpired ? "pointer-events-none opacity-50" : ""}`}>
          <div className="grid gap-2 p-3 bg-muted/20 border border-border rounded-lg">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Check className="h-4 w-4 text-primary" /> Requisitos de Publicação
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
              {validation.requirements.map((req) => (
                <div key={req.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    {req.isValid ? (
                      <Check className="h-3 w-3 text-success" />
                    ) : req.critical ? (
                      <AlertTriangle className="h-3 w-3 text-destructive" />
                    ) : (
                      <Info className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className={`text-[11px] font-medium ${req.isValid ? 'text-success' : req.critical ? 'text-destructive' : 'text-muted-foreground'}`}>
                      {req.label}
                    </span>
                  </div>
                  {!req.isValid && (
                    <span className="text-[10px] text-muted-foreground line-clamp-1 pl-4">
                      {req.message}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

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
            <p className="text-xs text-muted-foreground">
              {title.length}/60 caracteres · padrão ML:{" "}
              <strong>Tipo + Gênero/Estilo + Modelo + Cor</strong>
            </p>
            {title.trim().length > 0 && title.trim().length < 35 ? (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Título curto ({title.trim().length}/35+). Para aumentar a nota de qualidade,
                acrescente detalhes como tipo, gênero, modelo ou cor.
              </p>
            ) : null}
          </div>

          {/* Fotos do anúncio — 5 slots fixos: selecionadas + botão de upload */}
          <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-4">
                <Label>Fotos do anúncio</Label>
              </div>
              <span className="text-xs text-muted-foreground">
                {selectedPhotoPaths.length}/5 selecionadas
              </span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelected}
            />
            <div className="flex sm:grid sm:grid-cols-5 gap-2 overflow-x-auto sm:overflow-x-visible pb-2 sm:pb-0 scrollbar-hide">
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={selectedPhotoPaths}
                  strategy={rectSortingStrategy}
                >
                  {Array.from({ length: 5 }).map((_, slot) => {
                    const path = selectedPhotoPaths[slot];
                    const url = path ? photoUrlByPath.get(path) : undefined;
                    const isUploadingHere = uploadPhoto.isPending && uploadingSlot === slot;
                    
                    if (path) {
                      return (
                        <SortablePhotoItem
                          key={path}
                          path={path}
                          index={slot}
                          url={url}
                          onToggle={togglePhoto}
                        />
                      );
                    }
                    
                    return (
                      <button
                        key={`slot-${slot}`}
                        type="button"
                        onClick={() => openFilePicker(slot)}
                        disabled={uploadPhoto.isPending}
                        className="flex aspect-square min-w-[100px] min-h-[100px] sm:min-w-0 sm:min-h-0 items-center justify-center rounded-md border-2 border-dashed border-border bg-background/50 text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
                        title={`Adicionar foto ${slot + 1}`}
                      >
                        {isUploadingHere ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <span className="text-2xl leading-none">+</span>
                        )}
                      </button>
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>

            {/* Fotos já cadastradas no produto que ainda não foram selecionadas */}
            {(() => {
              const unselected = photoPaths.filter((p) => !selectedPhotoPaths.includes(p));
              if (unselected.length === 0) return null;
              return (
                <div className="mt-1 grid gap-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground">
                    Fotos já cadastradas neste produto (clique para incluir):
                  </p>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 sm:grid sm:grid-cols-8 sm:overflow-x-visible">
                    {unselected.map((path) => {
                      const url = photoUrlByPath.get(path);
                      return (
                        <button
                          key={path}
                          type="button"
                          onClick={() => togglePhoto(path)}
                          className="aspect-square w-12 h-12 sm:w-auto sm:h-auto overflow-hidden rounded border border-border transition hover:border-primary shrink-0"
                        >
                          {url ? (
                            <img
                              src={url}
                              alt=""
                              className="h-full w-full object-cover rounded"
                              loading="lazy"
                            />
                          ) : (
                            <div className="h-full w-full bg-muted" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <p className="text-[11px] text-muted-foreground">
              A primeira foto (slot 1) será a capa do anúncio. Anúncios com 4–5 fotos tendem a
              atingir notas mais altas no Mercado Livre.
            </p>

            {/* Campo de Vídeo do Mercado Livre */}
            <div className="mt-4 grid gap-2 border-t border-border pt-4">
              <Label htmlFor="ml-video" className="flex items-center gap-2">
                Vídeo do Anúncio (YouTube)
                <Badge variant="outline" className="text-[10px] py-0 h-4">Apenas YouTube</Badge>
              </Label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Input
                    id="ml-video"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="pr-10"
                  />
                  {videoUrl && (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Check className="h-4 w-4 text-success" />
                    </div>
                  )}
                </div>
                {videoUrl && (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) ? (
                  <div className="w-full sm:w-40 aspect-video bg-black rounded-md overflow-hidden relative group">
                    {(() => {
                      const getYoutubeId = (url: string) => {
                        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
                        const match = url.match(regExp);
                        return (match && match[2].length === 11) ? match[2] : null;
                      };
                      const videoId = getYoutubeId(videoUrl);
                      if (videoId) {
                        return (
                          <img 
                            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`} 
                            alt="Preview do vídeo"
                            className="w-full h-full object-contain bg-black opacity-70"
                            onError={(e) => {
                              // Se falhar o mqdefault, tenta o default básico
                              (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${videoId}/default.jpg`;
                            }}
                          />
                        );
                      }
                      return null;
                    })()}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="bg-red-600 rounded-full p-2 text-white shadow-lg">
                        <Smartphone className="h-4 w-4" />
                      </div>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setVideoUrl("")}
                      className="absolute top-1 right-1 bg-black/50 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : videoUrl ? (
                  <p className="text-[10px] text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    O Mercado Livre aceita apenas links do YouTube.
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-4 border-t border-border pt-4">
            <div className="flex flex-col sm:grid sm:grid-cols-2 gap-4 items-end">
              <div className="grid gap-2 w-full">
                <Label htmlFor="ml-wallet-target" className="flex items-center gap-1.5 text-primary font-semibold text-sm sm:text-base">
                  Quanto você quer receber no bolso? (R$)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">R$</span>
                  <Input
                    id="ml-wallet-target"
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0,00"
                    className="h-11 pl-9 border-primary/40 text-lg focus-visible:ring-primary font-bold"
                    value={walletTarget}
                    onChange={(e) => setWalletTarget(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid gap-2 w-full">
                <Label htmlFor="ml-qty" className="font-semibold text-sm sm:text-base">Estoque disponível</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="ml-qty"
                    type="number"
                    min={1}
                    step={1}
                    className="h-11"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                  />
                  <Badge variant="secondary" className="h-11 px-3 whitespace-nowrap">
                    Físico: {Number(product.stock ?? 0)}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(() => {
                const desired = Number(walletTarget);
                // Preços calculados para exibição nos cards
                const isPremium = listingType === "gold_pro";
                const classicFeePct = 0.135;
                const classicFixedFee = desired < 79 && desired > 0 ? 6.5 : 0;
                const classicShipping = desired >= 79 ? 23.5 : 0;
                const classicFinal = desired > 0 ? (desired + classicFixedFee + classicShipping) / (1 - classicFeePct) : 0;

                const premiumFeePct = 0.185;
                const premiumFinal = desired > 0 ? (desired + classicFixedFee + classicShipping) / (1 - premiumFeePct) : 0;

                return (
                  <>
                    <button
                      type="button"
                      onClick={() => setListingType("gold_special")}
                      className={`flex flex-col gap-2 p-4 rounded-xl border-2 text-left transition-all relative min-h-[44px] ${
                        listingType === "gold_special"
                          ? "border-primary bg-primary/5 ring-4 ring-primary/10 shadow-md"
                          : "border-border hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Anúncio Clássico</span>
                        {listingType === "gold_special" && <Check className="h-4 w-4 text-primary" />}
                      </div>
                      <span className="text-lg sm:text-xl font-black text-primary">
                        {classicFinal > 0 ? formatCurrency(classicFinal) : "---"}
                      </span>
                      <p className="text-[9px] sm:text-[10px] leading-tight text-muted-foreground">
                        Comissão 13,5% | Parcelado c/ juros
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setListingType("gold_pro")}
                      className={`flex flex-col gap-2 p-4 rounded-xl border-2 text-left transition-all relative min-h-[44px] ${
                        listingType === "gold_pro"
                          ? "border-primary bg-primary/5 ring-4 ring-primary/10 shadow-md"
                          : "border-border hover:border-primary/40 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Anúncio Premium 💳</span>
                        <Badge className="text-[8px] sm:text-[9px] h-3.5 px-1 bg-amber-500 hover:bg-amber-600 border-none">Destaque</Badge>
                      </div>
                      <span className="text-lg sm:text-xl font-black text-primary">
                        {premiumFinal > 0 ? formatCurrency(premiumFinal) : "---"}
                      </span>
                      <p className="text-[9px] sm:text-[10px] leading-tight text-muted-foreground">
                        12x Sem Juros + Exposição Máxima
                      </p>
                    </button>
                  </>
                );
              })()}
            </div>

            <div className="grid gap-2 p-4 bg-muted/30 rounded-xl border border-dashed border-border">
              <div className="flex items-center justify-between">
                <Label htmlFor="ml-price" className="text-sm font-semibold text-muted-foreground">
                  Preço Final de Venda (BRL)
                </Label>
                {usingMlSuggested && !priceTouched && (
                  <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">
                    <Sparkles className="h-3 w-3 mr-1" /> Sugerido
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Input
                  id="ml-price"
                  type="number"
                  min={0.01}
                  step="0.01"
                  className="h-12 font-mono text-lg sm:text-xl font-black text-foreground bg-background border-2 focus-visible:ring-primary"
                  value={price}
                  onChange={(e) => {
                    setPrice(Number(e.target.value));
                    setPriceTouched(true);
                    setUsingMlSuggested(false);
                  }}
                />
                <div className="flex flex-col text-[10px] text-muted-foreground whitespace-nowrap bg-background px-3 py-1.5 rounded-lg border border-border">
                  <span className="font-bold">Taxa ML: {listingType === "gold_pro" ? "18,5%" : "13,5%"}</span>
                  <span>Frete Grátis: {Number(walletTarget) >= 79 ? "Sim" : "Não"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="ml-category-search" className="flex items-center gap-1.5">
                Categoria do Mercado Livre
                {autoSuggested && categoryId ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    <Sparkles className="h-3 w-3" /> Sugerida automaticamente
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
                  <p className="text-xs text-muted-foreground">
                    Nenhuma categoria encontrada. Refine a busca.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Digite pelo menos 3 caracteres para buscar.
                  </p>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Tipo de anúncio</Label>
              <Select value={listingType} onValueChange={(v) => setListingType(v as ListingType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gold_special">Clássico (gold_special)</SelectItem>
                  <SelectItem value="gold_pro">Premium (gold_pro)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Condição</Label>
              <Select value={condition} onValueChange={(v) => setCondition(v as Condition)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">Novo</SelectItem>
                  <SelectItem value="used">Usado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ficha técnica estendida — melhora a nota de qualidade em Moda/Bolsas */}
          <div className="grid gap-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <Label>Ficha técnica (opcional, aumenta a nota do anúncio)</Label>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ml-attr-type" className="text-xs font-normal text-muted-foreground">
                  Tipo de produto
                </Label>
                <Input
                  id="ml-attr-type"
                  placeholder="Ex.: Bolsa"
                  value={productType}
                  onChange={(e) => setProductType(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="ml-attr-gender"
                  className="text-xs font-normal text-muted-foreground"
                >
                  Gênero (GENDER)
                </Label>
                <Select value={gender || undefined} onValueChange={setGender}>
                  <SelectTrigger id="ml-attr-gender">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Feminino">Feminino</SelectItem>
                    <SelectItem value="Masculino">Masculino</SelectItem>
                    <SelectItem value="Sem gênero">Sem gênero</SelectItem>
                    <SelectItem value="Infantil">Infantil</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="ml-attr-bagtype"
                  className="text-xs font-normal text-muted-foreground"
                >
                  Tipo de bolsa (BAG_TYPE)
                </Label>
                <Input
                  id="ml-attr-bagtype"
                  placeholder="Ex.: Tote, Sacola, Mochila"
                  value={bagType}
                  onChange={(e) => setBagType(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="ml-attr-material"
                  className="text-xs font-normal text-muted-foreground"
                >
                  Material (MATERIAL)
                </Label>
                <Input
                  id="ml-attr-material"
                  placeholder="Ex.: Couro sintético"
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="ml-attr-style"
                  className="text-xs font-normal text-muted-foreground"
                >
                  Estilo (STYLE)
                </Label>
                <Input
                  id="ml-attr-style"
                  placeholder="Ex.: Casual, Elegante"
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="ml-attr-color"
                  className="text-xs font-normal text-muted-foreground"
                >
                  Cor (COLOR)
                </Label>
                <Input
                  id="ml-attr-color"
                  placeholder="Ex.: Caramelo"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="ml-attr-brand"
                  className="text-xs font-normal text-muted-foreground"
                >
                  Marca (BRAND) *
                </Label>
                <Input
                  id="ml-attr-brand"
                  placeholder="Ex.: T&G"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="ml-attr-model"
                  className="text-xs font-normal text-muted-foreground"
                >
                  Modelo (MODEL)
                </Label>
                <Input
                  id="ml-attr-model"
                  placeholder="Ex.: Fabíola"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Marca é obrigatória — se ficar em branco, publicamos como <strong>T&amp;G</strong>{" "}
              (marca oficial). O Mercado Livre recusa &quot;Genérica&quot; ou &quot;Sem marca&quot;.
            </p>
            <p className="text-[11px] text-muted-foreground">
              Estes campos são enviados como atributos oficiais do Mercado Livre e ajudam o anúncio
              a atingir nota de qualidade 80+.
            </p>
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="ml-desc">Descrição</Label>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 text-xs"
                  onClick={async () => {
                    const text = description.trim();
                    if (!text) {
                      toast.error("Nada para copiar ainda.");
                      return;
                    }
                    try {
                      if (navigator.clipboard?.writeText) {
                        await navigator.clipboard.writeText(text);
                      } else {
                        const ta = document.createElement("textarea");
                        ta.value = text;
                        ta.style.position = "fixed";
                        ta.style.opacity = "0";
                        document.body.appendChild(ta);
                        ta.select();
                        const ok = document.execCommand("copy");
                        document.body.removeChild(ta);
                        if (!ok) throw new Error("execCommand copy falhou");
                      }
                      setDescCopied(true);
                      toast.success("Descrição copiada para a área de transferência.");
                      window.setTimeout(() => setDescCopied(false), 2000);
                    } catch (err) {
                      toast.error(
                        `Não foi possível copiar: ${err instanceof Error ? err.message : "erro desconhecido"}`,
                      );
                    }
                  }}
                  disabled={!description.trim() || generateDesc.isPending}
                >
                  {descCopied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" /> Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" /> Copiar
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => generateDesc.mutate()}
                  disabled={generateDesc.isPending || !title.trim()}
                >
                  {generateDesc.isPending ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Gerando…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-primary" /> Gerar com IA
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_240px]">
              <Textarea
                id="ml-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={10}
                placeholder="Descrição do produto (pré-preenchida do cadastro)"
                disabled={generateDesc.isPending}
              />

              {/* Pré-visualização mobile em tempo real */}
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Smartphone className="h-3.5 w-3.5" />
                  Pré-visualização mobile
                </div>
                <div className="w-[220px] rounded-[28px] border-[6px] border-neutral-800 bg-neutral-900 shadow-lg dark:border-neutral-700">
                  <div className="mx-auto mt-1 h-1 w-10 rounded-full bg-neutral-700" />
                  <div className="m-1 h-[340px] overflow-hidden rounded-[20px] bg-background">
                    <div className="border-b bg-muted/40 px-3 py-2">
                      <p className="line-clamp-2 text-[11px] font-semibold leading-tight">
                        {title.trim() || "Título do anúncio"}
                      </p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {price > 0 ? formatCurrency(price) : "R$ 0,00"}
                      </p>
                    </div>
                    <div className="h-[280px] overflow-y-auto px-3 py-2">
                      {generateDesc.isPending && !description ? (
                        <div className="flex h-full items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Gerando…
                        </div>
                      ) : description.trim() ? (
                        <p className="whitespace-pre-wrap break-words text-[10px] leading-snug text-foreground">
                          {description}
                        </p>
                      ) : (
                        <p className="text-[10px] italic text-muted-foreground">
                          A descrição aparecerá aqui conforme você digita ou gera com IA.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {(() => {
              const HARD_LIMIT = 50000;
              const RECOMMENDED = 5000;
              const len = description.length;
              const overHard = len > HARD_LIMIT;
              const overSoft = len > RECOMMENDED;
              return (
                <div className="flex items-start justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {generateDesc.isPending
                      ? "A IA está montando uma descrição otimizada para o Mercado Livre…"
                      : overHard
                        ? `Excede o limite do Mercado Livre (${HARD_LIMIT.toLocaleString("pt-BR")} caracteres). Reduza antes de publicar.`
                        : overSoft
                          ? `Acima do recomendado (${RECOMMENDED.toLocaleString("pt-BR")} caracteres). Textos mais curtos convertem melhor.`
                          : "Pré-preenchida a partir do cadastro. Clique em ‘Gerar com IA’ para criar um texto pronto para o Mercado Livre."}
                  </p>
                  <span
                    className={`shrink-0 text-xs tabular-nums ${
                      overHard
                        ? "text-destructive font-medium"
                        : overSoft
                          ? "text-amber-600 dark:text-amber-500"
                          : "text-muted-foreground"
                    }`}
                    aria-live="polite"
                  >
                    {len.toLocaleString("pt-BR")} / {HARD_LIMIT.toLocaleString("pt-BR")}
                  </span>
                </div>
              );
            })()}
          </div>
        </div>

        <DialogFooter className="p-4 sm:p-6 border-t border-border bg-background shrink-0">
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:justify-end">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={publish.isPending}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Cancelar
            </Button>
            <Button 
              onClick={() => publish.mutate()} 
              disabled={!canPublish}
              className="w-full sm:w-auto min-h-[44px]"
            >
              {publish.isPending ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Publicando…
                </>
              ) : (
                <>
                  <ExternalLink className="mr-1.5 h-4 w-4" /> Publicar no Mercado Livre
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
