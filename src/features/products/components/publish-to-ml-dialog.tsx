import { useEffect, useMemo, useRef, useState } from "react";
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
import { generateMercadoLivreDescription } from "@/lib/mercadolivre-ai.functions";
import { getMercadoLivreIntegration } from "@/lib/mercadolivre.functions";

import { getProductPricingIntelligence } from "@/features/pricing/lib/product-pricing.functions";
import { getProductChannelSettings } from "@/features/pricing/lib/channel-settings.functions";
import { productImagesService } from "@/features/products/services/product-images.service";
import { formatCurrency } from "@/lib/format";
import { AlertTriangle, Wand2 } from "lucide-react";
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
  const qc = useQueryClient();
  const predictFn = useServerFn(predictMercadoLivreCategory);
  const publishFn = useServerFn(publishProductToMercadoLivre);
  const integrationFn = useServerFn(getMercadoLivreIntegration);
  const generateDescFn = useServerFn(generateMercadoLivreDescription);

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

  const autoRanRef = useRef(false);

  // Reset state on open
  useEffect(() => {
    if (open) {
      const t = (product.name ?? "").slice(0, 60);
      setTitle(t);
      setPrice(Number(product.price ?? 0));
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
      setModel("");
      setPattern("Liso");
      setWithZipper("Sim");
      setAgeGroup("Adultos");
      setSeason("Permanente");
      setSelectedPhotoPaths([]);
      autoRanRef.current = false;
    }
  }, [open, product]);

  // Assim que o preço sugerido do ML fica disponível, aplica como padrão
  // (só se o usuário ainda não editou manualmente).
  useEffect(() => {
    if (!open || priceTouched) return;
    if (mlSuggestedPrice && mlSuggestedPrice > 0) {
      setPrice(mlSuggestedPrice);
      setUsingMlSuggested(true);
    }
  }, [open, priceTouched, mlSuggestedPrice]);

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
    for (const it of photoSignedUrlsQuery.data ?? []) {
      if (it.path && it.signedUrl) map.set(it.path, it.signedUrl);
    }
    return map;
  }, [photoSignedUrlsQuery.data]);

  // Ao carregar fotos, pré-seleciona até 5 primeiras (se ainda não escolheu).
  useEffect(() => {
    if (!open) return;
    if (selectedPhotoPaths.length > 0) return;
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
    mutationFn: async (file: File) => {
      const nextPosition = photosQuery.data?.length ?? 0;
      const path = await productImagesService.upload(product.company_id, product.id, file);
      await productImagesService.createRecord(product.company_id, product.id, path, nextPosition);
      return path;
    },
    onSuccess: (path) => {
      setSelectedPhotoPaths((prev) =>
        prev.includes(path) || prev.length >= 5 ? prev : [...prev, path],
      );
      qc.invalidateQueries({ queryKey: ["product-images", product.id] });
      toast.success("Foto adicionada ao anúncio.");
    },
    onError: (err) => {
      toast.error("Não foi possível subir a foto", { description: (err as Error).message });
    },
    onSettled: () => setUploadingSlot(null),
  });

  function openFilePicker(slotIndex: number) {
    if (selectedPhotoPaths.length >= 5) {
      toast.info("Você pode selecionar no máximo 5 fotos.");
      return;
    }
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
    uploadPhoto.mutate(file);
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
  // [Tipo de Produto] + [Gênero] + [Material/Estilo] + [Modelo] + [Cor]
  // Ex.: "Bolsa Feminina Transversal Em Couro Sintético Fabíola Caramelo"
  function buildSeoTitle() {
    const capitalize = (s: string) =>
      s
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map((w) => (w.length <= 2 ? w : w.charAt(0).toUpperCase() + w.slice(1)))
        .join(" ");

    const tipo = capitalize(productType.trim() || "Bolsa");
    const genero = capitalize(gender.trim() || "Feminino");

    // Material/Estilo — combina os dois com "Em" quando houver material.
    const mat = capitalize(material.trim());
    const est = capitalize(bagType.trim() || style.trim());
    let materialEstilo = "";
    if (est && mat) materialEstilo = `${est} Em ${mat}`;
    else if (mat) materialEstilo = `Em ${mat}`;
    else if (est) materialEstilo = est;

    // Modelo — usa o nome do produto, removendo termos já presentes no título.
    const rawModelo = (product.name ?? "").trim();
    const stripTokens = new Set(
      [tipo, genero, mat, est, color.trim()]
        .filter(Boolean)
        .flatMap((t) => t.toLowerCase().split(/\s+/)),
    );
    const modelo = capitalize(
      rawModelo
        .split(/\s+/)
        .filter((w) => w && !stripTokens.has(w.toLowerCase()))
        .join(" "),
    );

    const cor = capitalize(color.trim());

    const orderedParts = [tipo, genero, materialEstilo, modelo, cor].filter(
      (s) => s && s.length > 0,
    );

    let out = orderedParts.join(" ").replace(/\s+/g, " ").trim();

    // Garante mínimo de ~40 caracteres com complementos neutros aceitos pelo ML.
    const fillers = ["Original", "Alta Qualidade", "Envio Rápido"];
    let i = 0;
    while (out.length < 40 && i < fillers.length) {
      const candidate = `${out} ${fillers[i]}`.trim();
      if (candidate.length > 60) break;
      out = candidate;
      i += 1;
    }

    if (out.length > 60) out = out.slice(0, 60).trim();

    if (out.length < 35) {
      toast.info(
        "Preencha Tipo, Gênero, Material e Cor para gerar um título com pelo menos 35 caracteres.",
      );
      return;
    }

    setTitle(out);
    toast.success("Título otimizado para o Mercado Livre.");
  }

  const publish = useMutation({
    mutationFn: () =>
      publishFn({
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
          extraAttributes: extraAttributes.length > 0 ? extraAttributes : undefined,
        },
      }),

    onSuccess: (res) => {
      toast.success("Anúncio publicado no Mercado Livre", {
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
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Falha ao publicar no Mercado Livre");
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

  const canPublish =
    !isExpired &&
    !!categoryId &&
    !!title.trim() &&
    price > 0 &&
    quantity > 0 &&
    description.length <= 50000 &&
    !publish.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Anunciar no Mercado Livre
          </DialogTitle>
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

        <div className={`grid gap-4 ${isExpired ? "pointer-events-none opacity-50" : ""}`}>
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
              <Label>Fotos do anúncio</Label>
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
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, slot) => {
                const path = selectedPhotoPaths[slot];
                const url = path ? photoUrlByPath.get(path) : undefined;
                const isUploadingHere = uploadPhoto.isPending && uploadingSlot === slot;
                if (path) {
                  return (
                    <button
                      key={`slot-${slot}`}
                      type="button"
                      onClick={() => togglePhoto(path)}
                      title="Clique para remover esta foto do anúncio"
                      className="group relative aspect-square overflow-hidden rounded-md border-2 border-primary ring-2 ring-primary/30 transition"
                    >
                      {url ? (
                        <img
                          src={url}
                          alt=""
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="h-full w-full bg-muted" />
                      )}
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground shadow">
                        {slot + 1}
                      </span>
                    </button>
                  );
                }
                return (
                  <button
                    key={`slot-${slot}`}
                    type="button"
                    onClick={() => openFilePicker(slot)}
                    disabled={uploadPhoto.isPending}
                    className="flex aspect-square items-center justify-center rounded-md border-2 border-dashed border-border bg-background/50 text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
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
                  <div className="grid grid-cols-8 gap-1.5">
                    {unselected.map((path) => {
                      const url = photoUrlByPath.get(path);
                      return (
                        <button
                          key={path}
                          type="button"
                          onClick={() => togglePhoto(path)}
                          className="aspect-square overflow-hidden rounded border border-border transition hover:border-primary"
                        >
                          {url ? (
                            <img
                              src={url}
                              alt=""
                              className="h-full w-full object-cover"
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ml-price" className="flex items-center gap-1.5">
                Preço (BRL)
                {usingMlSuggested && !priceTouched ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    <Sparkles className="h-3 w-3" /> Sugerido do Mercado Livre
                  </span>
                ) : null}
              </Label>
              <Input
                id="ml-price"
                type="number"
                min={0.01}
                step="0.01"
                value={price}
                onChange={(e) => {
                  setPrice(Number(e.target.value));
                  setPriceTouched(true);
                  setUsingMlSuggested(false);
                }}
              />
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {pricingQuery.isLoading ? (
                  <span className="inline-flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Calculando preço sugerido…
                  </span>
                ) : mlSuggestedPrice ? (
                  <>
                    <span>Sugerido ML: {formatCurrency(mlSuggestedPrice)}</span>
                    {priceTouched && Math.abs(price - mlSuggestedPrice) > 0.005 ? (
                      <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => {
                          setPrice(mlSuggestedPrice);
                          setPriceTouched(false);
                          setUsingMlSuggested(true);
                        }}
                      >
                        Usar sugerido
                      </button>
                    ) : null}
                  </>
                ) : (
                  <span>Referência (tabela): {formatCurrency(rawProductPrice)}</span>
                )}
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ml-qty">Estoque disponível</Label>
              <Input
                id="ml-qty"
                type="number"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Sistema: {Number(product.stock ?? 0)} un
              </p>
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

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={publish.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={() => publish.mutate()} disabled={!canPublish}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
