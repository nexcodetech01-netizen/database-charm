import { createFileRoute, notFound, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Copy,
  Share2,
  Package,
  LayoutGrid,
  Search,
  Eye,
  AlertCircle,
  Loader2,
  Grid,
  List,
  Filter,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, getInstallmentPlan, PAYMENT_CONDITIONS_LEGEND } from "@/lib/format";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import type {
  PublicCollection,
  PublicCollectionProduct,
} from "@/features/catalog/types";
import { loadPublicCollection } from "@/features/catalog/lib/public-collection.functions";
import { toCustomerReference } from "@/lib/customer-reference";
import {
  AvailabilityBadge,
  resolveAvailability,
} from "@/features/catalog/components/availability-badge";
import { QuickViewDialog } from "@/features/catalog/components/quick-view-dialog";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

const PAGE_SIZE = 24;

const SORT_OPTIONS = [
  { value: "relevancia", label: "Relevância" },
  { value: "menor_preco", label: "Menor preço" },
  { value: "maior_preco", label: "Maior preço" },
  { value: "mais_disponiveis", label: "Mais disponíveis" },
] as const;

const searchSchema = z.object({
  preview: fallback(z.string(), "").default(""),
  q: fallback(z.string(), "").default(""),
  marca: fallback(z.string(), "").default(""),
  cat: fallback(z.string(), "all").default("all"),
  disp: fallback(z.string(), "todos").default("todos"),
  ord: fallback(z.string(), "relevancia").default("relevancia"),
  min: fallback(z.number(), 0).default(0),
  max: fallback(z.number(), 0).default(0),
  view: fallback(z.enum(["grid", "list"]), "grid").default("grid"),
  page: fallback(z.number().int(), 1).default(1),
});

function truncate(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export const Route = createFileRoute("/catalogo/colecao/$slug")({
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ preview: search.preview === "1" }),
  loader: ({ params, deps }) =>
    loadPublicCollection({
      data: { slug: params.slug, preview: deps.preview },
    }),
  head: ({ params, loaderData }) => {
    const collection = loaderData?.collection ?? null;
    const origin = loaderData?.origin ?? "";
    const pageUrl = origin
      ? `${origin}/catalogo/colecao/${encodeURIComponent(params.slug)}`
      : undefined;

    if (!collection) {
      const title = "Coleção indisponível";
      const description =
        "Esta coleção não existe ou não está mais ativa no catálogo.";
      const meta: Array<Record<string, string>> = [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ];
      if (pageUrl) meta.push({ property: "og:url", content: pageUrl });
      return {
        meta,
        links: pageUrl ? [{ rel: "canonical", href: pageUrl }] : undefined,
      };
    }

    const title = `${collection.name} — ${collection.company_name}`;
    const rawDesc =
      collection.description?.trim() ||
      `Coleção ${collection.name} com ${collection.products.length} produto${collection.products.length === 1 ? "" : "s"} de ${collection.company_name}.`;
    const description = truncate(rawDesc, 160);
    const image =
      collection.cover_url ?? collection.products[0]?.cover_url ?? undefined;

    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: collection.company_name },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    if (pageUrl) meta.push({ property: "og:url", content: pageUrl });
    if (image) {
      meta.push(
        { property: "og:image", content: image },
        { property: "og:image:alt", content: collection.name },
        { name: "twitter:image", content: image },
      );
    }

    return {
      meta,
      links: pageUrl ? [{ rel: "canonical", href: pageUrl }] : undefined,
    };
  },
  component: PublicCollectionPage,
  errorComponent: () => <CollectionErrorState />,
  notFoundComponent: () => <CollectionNotFoundState />,
});

async function fetchPublicCollection(
  slug: string,
  preview: boolean,
): Promise<PublicCollection> {
  const qs = preview ? "?preview=1" : "";
  const res = await fetch(
    `/api/public/catalog/${encodeURIComponent(slug)}${qs}`,
  );
  if (res.status === 404) throw notFound();
  if (!res.ok) throw new Error("Falha ao carregar a coleção");
  return res.json();
}

function sortProducts(
  products: PublicCollectionProduct[],
  ord: string,
): PublicCollectionProduct[] {
  const copy = [...products];
  switch (ord) {
    case "menor_preco":
      return copy.sort((a, b) => a.price - b.price);
    case "maior_preco":
      return copy.sort((a, b) => b.price - a.price);
    case "mais_disponiveis":
      return copy.sort((a, b) => b.stock - a.stock);
    default:
      return copy;
  }
}

function PublicCollectionPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const isPreview = search.preview === "1";

  const { data, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["public-collection", slug, isPreview],
    queryFn: () => fetchPublicCollection(slug, isPreview),
    initialData: Route.useLoaderData().collection || undefined,
    staleTime: 60_000,
    retry: 1,
  });

  const [q, setQ] = useState(search.q);
  const [quickViewId, setQuickViewId] = useState<string | null>(null);
  const [showPriceFilter, setShowPriceFilter] = useState(search.min > 0 || search.max > 0);

  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const p of data?.products ?? []) {
      if (p.brand) set.add(p.brand);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const categories = useMemo(() => {
    if (data?.categories && data.categories.length > 0) {
      return data.categories;
    }
    // Fallback para extração dinâmica se o payload estiver vazio
    const set = new Set<string>();
    for (const p of data?.products ?? []) {
      if (p.category_name) set.add(p.category_name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const priceRange = useMemo(() => {
    const list = data?.products ?? [];
    if (list.length === 0) return { min: 0, max: 0 };
    const prices = list.map((p) => p.price);
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices)),
    };
  }, [data]);

  const filtered = useMemo(() => {
    const list = data?.products ?? [];
    const term = search.q.trim().toLowerCase();
    const base = list.filter((p) => {
      if (term) {
        const ref = toCustomerReference(p.sku ?? "").toLowerCase();
        const haystack = [
          p.name,
          p.brand ?? "",
          p.sku ?? "",
          ref,
          p.barcode ?? "",
          p.category_name ?? "",
          ...(p.tags ?? []),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (search.marca && p.brand !== search.marca) return false;
      if (search.cat !== "all" && p.category_name !== search.cat) return false;
      if (search.disp === "disponivel" && p.stock <= 0) return false;
      if (search.disp === "esgotado" && p.stock > 0) return false;
      if (search.min > 0 && p.price < search.min) return false;
      if (search.max > 0 && p.price > search.max) return false;
      return true;
    });
    return sortProducts(base, search.ord);
  }, [data, search.q, search.marca, search.cat, search.disp, search.ord, search.min, search.max]);

  const currentPage = Math.max(1, search.page);
  const visibleCount = Math.min(filtered.length, currentPage * PAGE_SIZE);
  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const url = typeof window !== "undefined" ? window.location.href : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado com os filtros atuais");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      await navigator
        .share({ title: data?.name ?? "Coleção", url })
        .catch(() => {});
    } else {
      copyLink();
    }
  }

  function updateSearch(patch: Record<string, unknown>, resetPage = true) {
    navigate({
      search: (prev: any) => ({
        ...prev,
        ...patch,
        ...(resetPage ? { page: 1 } : {}),
      }),
      replace: true,
    });
  }

  if (isLoading) {
    return <CollectionSkeleton />;
  }

  if (isError || !data) {
    return <CollectionErrorState onRetry={() => refetch()} />;
  }

  const isScheduled = data.status === "scheduled";

  // Search params to forward to product links, so back preserves filters
  const forwardSearch: Record<string, string | number> = {};
  if (isPreview) forwardSearch.preview = "1";
  if (search.q) forwardSearch.q = search.q;
  if (search.marca) forwardSearch.marca = search.marca;
  if (search.disp && search.disp !== "todos") forwardSearch.disp = search.disp;
  if (search.ord && search.ord !== "relevancia") forwardSearch.ord = search.ord;
  if (currentPage > 1) forwardSearch.page = currentPage;

  return (
    <div className="min-h-screen bg-background">
      {isPreview && (
        <div className="border-b bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 text-xs font-medium">
            <Eye className="h-3.5 w-3.5" />
            Modo de pré-visualização
            {isScheduled && (
              <span className="text-muted-foreground">
                · Coleção agendada, ainda não pública
              </span>
            )}
          </div>
        </div>
      )}

      <header className="relative border-b bg-card/50 backdrop-blur-sm overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-50" />
        
        <div className="mx-auto max-w-5xl px-4 py-12 relative">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div className="flex-1 space-y-4">
              <div 
                className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold text-primary tracking-[0.2em] uppercase"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              >
                {data.company_name}
              </div>
              <h1 
                className="text-4xl font-extrabold tracking-tight sm:text-6xl text-foreground"
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              >
                {data.name}
              </h1>
              {data.description && (
                <p className="max-w-2xl text-base md:text-lg text-muted-foreground/80 leading-relaxed font-medium">
                  {data.description}
                </p>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={copyLink}
                className="rounded-xl h-10 border-border/50 hover:bg-accent/50 transition-all active:scale-95"
              >
                <Copy className="mr-2 h-4 w-4" /> 
                <span className="hidden sm:inline">Copiar Link</span>
              </Button>
              <Button 
                size="sm" 
                onClick={share}
                className="rounded-xl h-10 bg-primary hover:bg-primary/90 shadow-md shadow-primary/20 transition-all active:scale-95"
              >
                <Share2 className="mr-2 h-4 w-4" /> 
                <span>Compartilhar</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {data.cover_url && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <div className="overflow-hidden rounded-xl">
            <img
              src={data.cover_url}
              alt={data.name}
              className="aspect-[21/9] w-full object-cover"
            />
          </div>
        </div>
      )}

      {data.products.length > 0 && (
        <div className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
          <div className="mx-auto max-w-5xl px-4 py-4">
            <div className="flex flex-col gap-5">
              {/* Toolbar: Search and Filters */}
              <div className="flex flex-col lg:flex-row items-center gap-3">
                <div className="relative w-full lg:flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/70" />
                  <Input
                    value={q}
                    onChange={(e) => {
                      const v = e.target.value;
                      setQ(v);
                      updateSearch({ q: v });
                    }}
                    placeholder="O que você está procurando?"
                    className="pl-10 h-11 rounded-2xl border-border/40 bg-muted/30 focus:bg-background transition-all"
                  />
                </div>
                
                <div className="flex w-full lg:w-auto items-center gap-2 overflow-x-auto pb-1 lg:pb-0 scrollbar-hide">
                  <Select
                    value={search.marca || "all"}
                    onValueChange={(v) =>
                      updateSearch({ marca: v === "all" ? "" : v })
                    }
                  >
                    <SelectTrigger className="h-11 min-w-[130px] rounded-2xl border-border/40 bg-muted/30">
                      <SelectValue placeholder="Marca" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as Marcas</SelectItem>
                      {brands.map((b) => (
                        <SelectItem key={b} value={b}>{b}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={search.disp}
                    onValueChange={(v) => updateSearch({ disp: v })}
                  >
                    <SelectTrigger className="h-11 min-w-[130px] rounded-2xl border-border/40 bg-muted/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Disponibilidade</SelectItem>
                      <SelectItem value="disponivel">Disponíveis</SelectItem>
                      <SelectItem value="esgotado">Esgotados</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button
                    variant={showPriceFilter ? "secondary" : "outline"}
                    size="sm"
                    className="h-11 rounded-2xl px-4 border-border/40"
                    onClick={() => setShowPriceFilter(!showPriceFilter)}
                  >
                    <Filter className="h-4 w-4 mr-2" /> Preço
                  </Button>

                  <div className="flex bg-muted/50 p-1 rounded-2xl">
                    <Button
                      variant={search.view === "grid" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-9 w-10 rounded-xl px-0 shadow-none"
                      onClick={() => updateSearch({ view: "grid" })}
                    >
                      <Grid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={search.view === "list" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-9 w-10 rounded-xl px-0 shadow-none"
                      onClick={() => updateSearch({ view: "list" })}
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Price Slider Drawer-like UI */}
              {showPriceFilter && priceRange.max > priceRange.min && (
                <div className="bg-muted/30 p-5 rounded-2xl border border-border/40 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-foreground/80">Faixa de Preço</span>
                    <span className="text-sm font-bold text-primary bg-primary/10 px-3 py-1 rounded-full">
                      {formatCurrency(search.min || priceRange.min)} — {formatCurrency(search.max || priceRange.max)}
                    </span>
                  </div>
                  <Slider
                    key={`price-${search.min ?? "min"}-${search.max ?? "max"}`}
                    defaultValue={[search.min || priceRange.min, search.max || priceRange.max]}
                    min={priceRange.min}
                    max={priceRange.max}
                    step={1}
                    onValueCommit={([min, max]) => updateSearch({ min, max })}
                    className="py-2"
                  />
                </div>
              )}

              {/* Categories Navigation */}
              {categories.length > 0 && (
                <div className="relative pt-2">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      onClick={() => updateSearch({ cat: "all" })}
                      className={cn(
                        "px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-300 border",
                        search.cat === "all"
                          ? "bg-primary text-primary-foreground border-primary shadow-[0_4px_12px_rgba(var(--primary-rgb),0.3)] scale-105"
                          : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10 hover:text-foreground"
                      )}
                      style={{ fontFamily: 'Montserrat, sans-serif' }}
                    >
                      Todas
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c}
                        onClick={() => updateSearch({ cat: c })}
                        className={cn(
                          "px-5 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-300 border",
                          search.cat === c
                            ? "bg-primary text-primary-foreground border-primary shadow-[0_4px_12px_rgba(var(--primary-rgb),0.3)] scale-105"
                            : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10 hover:text-foreground"
                        )}
                        style={{ fontFamily: 'Montserrat, sans-serif' }}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-2">
                <span className="bg-muted px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-tight">
                  {filtered.length} {filtered.length === 1 ? "Item" : "Itens"}
                </span>
                {isFetching && (
                  <span className="inline-flex items-center gap-1.5 text-primary animate-pulse">
                    <Loader2 className="h-3 w-3 animate-spin" /> Atualizando...
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Select
                  value={search.ord}
                  onValueChange={(v) => updateSearch({ ord: v })}
                >
                  <SelectTrigger className="h-8 w-auto min-w-[150px] text-xs border-none bg-transparent hover:bg-muted/50 focus:ring-0 rounded-lg transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl px-4 py-6">
        {data.products.length === 0 ? (
          <div className="grid place-items-center py-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">
              Esta coleção ainda não possui produtos.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyResults
            search={search}
            onReset={() => {
              setQ("");
              updateSearch({
                q: "",
                marca: "",
                cat: "all",
                disp: "todos",
                ord: "relevancia",
                min: 0,
                max: 0,
              });
            }}
            onClearQ={() => {
              setQ("");
              updateSearch({ q: "" });
            }}
            onClearMarca={() => updateSearch({ marca: "" })}
            onClearCat={() => updateSearch({ cat: "all" })}
            onClearDisp={() => updateSearch({ disp: "todos" })}
            onClearOrd={() => updateSearch({ ord: "relevancia" })}
            onClearPrice={() => updateSearch({ min: 0, max: 0 })}
          />
        ) : (
          <>
            <div
              className={cn(
                "grid gap-6",
                search.view === "grid"
                  ? "grid-cols-2 lg:grid-cols-4"
                  : "grid-cols-1"
              )}
            >
              {visible.map((p) => {
                const outOfStock = p.stock <= 0;
                const plan = getInstallmentPlan(p.price);
                const availability = resolveAvailability(p.stock, {
                  presale: isPreview,
                });

                if (search.view === "list") {
                  return (
                    <Card
                      key={p.id}
                      className="group overflow-hidden rounded-2xl border-border/40 bg-card/40 backdrop-blur-sm transition-all hover:shadow-lg hover:border-primary/20"
                    >
                      <div className="flex flex-col sm:flex-row h-full">
                        <div
                          className="relative aspect-square sm:w-48 w-full shrink-0 overflow-hidden bg-muted/30 cursor-pointer"
                          onClick={() => setQuickViewId(p.id)}
                        >
                          {p.cover_url ? (
                            <img
                              src={p.cover_url}
                              alt={p.name}
                              loading="lazy"
                              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                            />
                          ) : (
                            <div className="grid h-full w-full place-items-center">
                              <Package className="h-10 w-10 text-muted-foreground/30" />
                            </div>
                          )}
                          {(data.show_stock || availability !== "available") && (
                            <AvailabilityBadge
                              kind={availability}
                              size="sm"
                              className="absolute left-2 top-2"
                            />
                          )}
                        </div>
                        <div className="flex flex-col flex-1 p-5 justify-between min-w-0">
                          <div>
                            <div className="flex justify-between items-start gap-4">
                              <div className="space-y-1.5 min-w-0">
                                {data.show_brand && p.brand && (
                                  <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary/80">
                                    {p.brand}
                                  </div>
                                )}
                                <h3
                                  className="line-clamp-2 text-base font-bold text-foreground/90 cursor-pointer hover:text-primary transition-colors"
                                  onClick={() => setQuickViewId(p.id)}
                                >
                                  {p.name}
                                </h3>
                              </div>
                              {data.show_price && (
                                <div className="text-right shrink-0">
                                  <div className="text-lg font-black tracking-tight text-foreground">
                                    {formatCurrency(p.price)}
                                  </div>
                                  {data.show_installments && plan && (
                                    <div className="text-[10px] text-muted-foreground font-semibold">
                                      {plan.label}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <p className="mt-3 text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                              {p.description || "Toque para ver mais detalhes sobre este produto premium."}
                            </p>
                          </div>
                          
                          <div className="flex gap-3 mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-10 rounded-xl text-xs font-bold border-border/60"
                              onClick={() => setQuickViewId(p.id)}
                            >
                              Visualizar
                            </Button>
                            <Button
                              asChild
                              size="sm"
                              className="flex-1 h-10 rounded-xl text-xs font-bold bg-primary hover:bg-primary/90 shadow-md shadow-primary/20"
                              disabled={outOfStock}
                            >
                              <Link
                                to="/catalogo/colecao/$slug/produto/$productId"
                                params={{ slug: data.slug, productId: p.id }}
                                search={(prev: any) => prev}
                              >
                                {data.cta_mode === "whatsapp" ? "Pedir Agora" : "Comprar"}
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                }

                return (
                  <Card
                    key={p.id}
                    className="group overflow-hidden rounded-2xl border-border/40 bg-card/40 backdrop-blur-sm transition-all hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20"
                  >
                    <div
                      className="relative aspect-[4/5] w-full overflow-hidden bg-muted/30 cursor-pointer"
                      onClick={() => setQuickViewId(p.id)}
                    >
                      {p.cover_url ? (
                        <img
                          src={p.cover_url}
                          alt={p.name}
                          loading="lazy"
                          className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center">
                          <Package className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                      )}
                      
                      {/* Overlay gradient */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {(data.show_stock || availability !== "available") && (
                        <AvailabilityBadge
                          kind={availability}
                          size="sm"
                          className="absolute left-3 top-3 shadow-lg"
                        />
                      )}
                      
                      <div className="absolute bottom-3 left-3 right-3 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                        <Button
                          size="sm"
                          className="w-full rounded-xl bg-white/90 text-black hover:bg-white backdrop-blur-md shadow-xl font-bold tracking-tight"
                          onClick={(e) => {
                            e.stopPropagation();
                            setQuickViewId(p.id);
                          }}
                        >
                          Visualização Rápida
                        </Button>
                      </div>
                    </div>
                    
                    <CardContent className="space-y-3 p-4">
                      <div className="space-y-1">
                        {data.show_brand && p.brand && (
                          <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary/80">
                            {p.brand}
                          </div>
                        )}
                        <h3
                          className="line-clamp-2 text-sm font-semibold leading-snug cursor-pointer hover:text-primary transition-colors min-h-[2.5rem] text-foreground/90"
                          onClick={() => setQuickViewId(p.id)}
                        >
                          {p.name}
                        </h3>
                      </div>
                      
                      <div className="flex flex-col gap-0.5">
                        {data.show_price && (
                          <div 
                            className="text-lg font-black tracking-tight text-foreground"
                            style={{ fontFamily: 'Montserrat, sans-serif' }}
                          >
                            {formatCurrency(p.price)}
                          </div>
                        )}
                        {data.show_installments && data.show_price && plan && (
                          <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                            <span className="h-1 w-1 rounded-full bg-primary/40" />
                            {plan.label}
                          </div>
                        )}
                      </div>
                      
                      <div className="pt-1">
                        <Button
                          asChild
                          variant="outline"
                          size="sm"
                          className="w-full h-9 rounded-xl text-xs font-bold border-border/60 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95"
                          disabled={outOfStock}
                        >
                          <Link
                            to="/catalogo/colecao/$slug/produto/$productId"
                            params={{ slug: data.slug, productId: p.id }}
                            search={(prev: any) => prev}
                          >
                            Ver Detalhes
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {hasMore && (
              <div className="mt-16 flex flex-col items-center justify-center gap-4">
                <div className="h-px w-24 bg-gradient-to-r from-transparent via-border to-transparent" />
                <Button
                  variant="outline"
                  size="lg"
                  className="rounded-2xl px-10 h-14 border-border/60 font-bold hover:bg-accent hover:border-primary/30 transition-all shadow-sm active:scale-95"
                  onClick={() =>
                    updateSearch({ page: currentPage + 1 }, false)
                  }
                >
                  Ver mais produtos
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({filtered.length - visibleCount} restantes)
                  </span>
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      <QuickViewDialog
        slug={slug}
        productId={quickViewId}
        preview={isPreview}
        onOpenChange={(open) => !open && setQuickViewId(null)}
      />

      <footer className="relative border-t bg-card/50 py-16 overflow-hidden">
        {/* Decorative background for footer */}
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent opacity-30" />
        
        <div className="relative mx-auto max-w-5xl px-4 text-center space-y-8">
          <div className="space-y-3">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Informações de Compra</h4>
            <p className="px-6 max-w-2xl mx-auto leading-relaxed text-xs text-muted-foreground/80 italic">
              {PAYMENT_CONDITIONS_LEGEND}
            </p>
          </div>
          
          <div className="flex flex-col items-center gap-6">
            <div className="flex items-center justify-center gap-4">
              <div className="h-px w-12 bg-border/40" />
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-background/50 border border-border/40 backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                <p className="font-bold tracking-widest uppercase text-[9px] text-foreground/70">Catálogo Premium · NexOS</p>
              </div>
              <div className="h-px w-12 bg-border/40" />
            </div>
            
            <p className="text-[10px] text-muted-foreground/50">
              © {new Date().getFullYear()} {data.company_name}. Todos os direitos reservados.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface EmptyResultsProps {
  search: {
    q: string;
    marca: string;
    cat: string;
    disp: string;
    ord: string;
    min: number;
    max: number;
  };
  onReset: () => void;
  onClearQ: () => void;
  onClearMarca: () => void;
  onClearCat: () => void;
  onClearDisp: () => void;
  onClearOrd: () => void;
  onClearPrice: () => void;
}

function EmptyResults({
  search,
  onReset,
  onClearQ,
  onClearMarca,
  onClearCat,
  onClearDisp,
  onClearOrd,
  onClearPrice,
}: EmptyResultsProps) {
  const chips: { label: string; onClear: () => void }[] = [];
  if (search.q) chips.push({ label: `Busca: "${search.q}"`, onClear: onClearQ });
  if (search.cat && search.cat !== "all")
    chips.push({ label: `Categoria: ${search.cat}`, onClear: onClearCat });
  if (search.marca)
    chips.push({ label: `Marca: ${search.marca}`, onClear: onClearMarca });
  if (search.min > 0 || search.max > 0)
    chips.push({ label: `Preço: ${formatCurrency(search.min)} - ${formatCurrency(search.max)}`, onClear: onClearPrice });
  if (search.disp && search.disp !== "todos") {
    chips.push({
      label:
        search.disp === "disponivel"
          ? "Apenas disponíveis"
          : "Apenas esgotados",
      onClear: onClearDisp,
    });
  }
  if (search.ord && search.ord !== "relevancia") {
    const label =
      SORT_OPTIONS.find((o) => o.value === search.ord)?.label ?? search.ord;
    chips.push({ label: `Ordem: ${label}`, onClear: onClearOrd });
  }

  return (
    <div className="mx-auto grid max-w-md place-items-center py-16 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
        <Search className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-4 text-base font-semibold">Nenhum resultado encontrado</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Não encontramos produtos com os filtros atuais. Ajuste a busca ou
        remova algum filtro para ver mais opções.
      </p>

      {chips.length > 0 && (
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={c.onClear}
              className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {c.label}
              <span aria-hidden className="text-muted-foreground/70">×</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Button size="sm" onClick={onReset}>
          Limpar filtros e voltar para Relevância
        </Button>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Dica: tente termos mais curtos ou desative filtros de disponibilidade.
      </p>
    </div>
  );
}


function CollectionSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-card">
        <div className="mx-auto max-w-5xl px-4 py-6">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-8 w-2/3" />
          <Skeleton className="mt-2 h-4 w-full max-w-md" />
          <div className="mt-4 flex gap-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <Skeleton className="aspect-[21/9] w-full rounded-xl" />
      </div>
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-5 w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CollectionErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="max-w-sm text-center">
        <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
        <h1 className="mt-3 text-lg font-semibold">
          Não conseguimos carregar a coleção
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Verifique sua conexão e tente novamente em alguns instantes.
        </p>
        {onRetry && (
          <Button className="mt-4" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  );
}

function CollectionNotFoundState() {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6">
      <div className="max-w-sm text-center">
        <LayoutGrid className="mx-auto h-10 w-10 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">Coleção indisponível</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Esta coleção não existe ou não está mais ativa no catálogo.
        </p>
      </div>
    </div>
  );
}
