import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCatalogTheme } from "@/features/catalog/hooks/use-catalog-theme";
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
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, PAYMENT_CONDITIONS_LEGEND } from "@/lib/format";
import { calcParcela, maxInstallmentsFor, calcPrecoCartao } from "@/lib/pricing/card-price";
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
import { brandStyle } from "@/features/storefront/lib/brand";
import { catalogImgProps } from "@/features/catalog/lib/catalog-image";

const PAGE_SIZE = 24;

const SORT_OPTIONS = [
  { value: "novidades", label: "Novidades" },
  { value: "menor_preco", label: "Menor preço" },
  { value: "maior_preco", label: "Maior preço" },
  { value: "relevancia", label: "Ordem da loja" },
] as const;

const searchSchema = z.object({
  preview: fallback(z.string(), "").default(""),
  q: fallback(z.string(), "").default(""),
  marca: fallback(z.string(), "").default(""),
  cat: fallback(z.string(), "all").default("all"),
  disp: fallback(z.string(), "todos").default("todos"),
  ord: fallback(z.string(), "novidades").default("novidades"),
  tam: fallback(z.string(), "").default(""),
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

// `notFound()` do TanStack Router só é reconhecido quando lançado dentro do
// loader/beforeLoad da rota. Essa busca roda dentro do `queryFn` do
// useQuery (client-side, pra refletir dados atualizados), então um 404 real
// precisa de um erro próprio que o componente saiba distinguir de uma falha
// de rede/servidor — senão a coleção "não existe" cai no mesmo estado de
// "não conseguimos carregar", com botão de tentar novamente que não resolve
// nada.
class CollectionNotFoundError extends Error {
  constructor() {
    super("collection_not_found");
    this.name = "CollectionNotFoundError";
  }
}

async function fetchPublicCollection(
  slug: string,
  preview: boolean,
): Promise<PublicCollection> {
  const qs = preview ? "?preview=1" : "";
  const res = await fetch(
    `/api/public/catalog/${encodeURIComponent(slug)}${qs}`,
  );
  if (res.status === 404) throw new CollectionNotFoundError();
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
    case "novidades":
      return copy.sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""));
    default:
      return copy;
  }
}

function PublicCollectionPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const isPreview = search.preview === "1";

  const { data, error, isLoading, isError, isFetching, refetch } = useQuery({
    queryKey: ["public-collection", slug, isPreview],
    queryFn: () => fetchPublicCollection(slug, isPreview),
    initialData: Route.useLoaderData().collection || undefined,
    staleTime: 60_000,
    // Não faz sentido tentar de novo automaticamente quando a coleção
    // simplesmente não existe — só re-tenta em falhas de rede/servidor.
    retry: (failureCount, err) =>
      !(err instanceof CollectionNotFoundError) && failureCount < 1,
  });
  useCatalogTheme(data?.catalog_theme);

  const [q, setQ] = useState(search.q);

  const brands = useMemo(() => {
    const set = new Set<string>();
    for (const p of data?.products ?? []) if (p.brand) set.add(p.brand);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  // Tamanhos presentes na coleção, na ordem de vestir (PP → GG → números).
  const sizes = useMemo(() => {
    const set = new Set<string>();
    for (const p of data?.products ?? []) if (p.size) set.add(p.size.toUpperCase());
    return Array.from(set).sort((a, b) => sizeRank(a) - sizeRank(b));
  }, [data]);

  const categories = useMemo(() => {
    if (data?.categories && data.categories.length > 0) return data.categories;
    const set = new Set<string>();
    for (const p of data?.products ?? []) if (p.category_name) set.add(p.category_name);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filtered = useMemo(() => {
    const list = data?.products ?? [];
    const term = normalizeText(search.q.trim());
    const base = list.filter((p) => {
      if (term) {
        const ref = toCustomerReference(p.sku ?? "");
        const haystack = normalizeText(
          [
            p.name,
            p.brand ?? "",
            p.model ?? "",
            p.color ?? "",
            p.size ?? "",
            p.sku ?? "",
            ref,
            p.category_name ?? "",
            ...(p.tags ?? []),
          ].join(" "),
        );
        if (!term.split(/\s+/).every((t) => haystack.includes(t))) return false;
      }
      if (search.marca && p.brand !== search.marca) return false;
      if (search.tam && (p.size ?? "").toUpperCase() !== search.tam) return false;
      if (search.cat !== "all" && p.category_name !== search.cat) return false;
      if (search.min > 0 && p.price < search.min) return false;
      if (search.max > 0 && p.price > search.max) return false;
      return true;
    });
    return sortProducts(base, search.ord);
  }, [data, search.q, search.marca, search.tam, search.cat, search.ord, search.min, search.max]);

  const currentPage = Math.max(1, search.page);
  const visibleCount = Math.min(filtered.length, currentPage * PAGE_SIZE);
  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const url = typeof window !== "undefined" ? window.location.href : "";

  async function share() {
    const nav: Navigator | undefined = typeof navigator !== "undefined" ? navigator : undefined;
    if (nav && typeof nav.share === "function") {
      await nav.share({ title: data?.name ?? "Coleção", url }).catch(() => {});
      return;
    }
    try {
      await nav?.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
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

  if (isLoading) return <CollectionSkeleton />;
  if (error instanceof CollectionNotFoundError) return <CollectionNotFoundState />;
  if (isError || !data) return <CollectionErrorState onRetry={() => refetch()} />;

  const isScheduled = data.status === "scheduled";
  const anyFilter = !!(search.q || search.marca || search.tam || search.cat !== "all");
  const whatsHref =
    data.whatsapp_phone && data.cta === "whatsapp"
      ? `https://wa.me/${data.whatsapp_phone}?text=${encodeURIComponent(
          `Olá! Vi o catálogo "${data.name}" e queria tirar uma dúvida.`,
        )}`
      : null;

  return (
    <div className={`${data.catalog_theme === "dark" ? "dark " : ""}min-h-screen bg-background pb-24`} style={brandStyle(data.brand_color)}>
      {isPreview && (
        <div className="border-b bg-amber-500/10 text-amber-900 dark:text-amber-200">
          <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 text-xs font-medium">
            <Eye className="h-3.5 w-3.5" />
            Modo de pré-visualização
            {isScheduled && (
              <span className="text-muted-foreground">· Coleção agendada, ainda não pública</span>
            )}
          </div>
        </div>
      )}

      {/* Topo fixo: loja, busca e filtros sempre à mão no celular */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto max-w-5xl px-4 pt-3">
          <div className="flex items-center gap-3">
            {data.logo_url ? (
              <img
                {...catalogImgProps(data.logo_url, 80, { eager: true })}
                alt={data.company_name}
                className="h-10 w-10 shrink-0 rounded-full border border-border bg-white object-contain dark:bg-background p-0.5"
              />
            ) : (
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {initials(data.company_name)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold leading-tight">{data.company_name}</p>
              <p className="truncate text-xs text-muted-foreground">{data.name}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 shrink-0 rounded-full"
              onClick={() => void share()}
              aria-label="Compartilhar catálogo"
            >
              <Share2 className="h-5 w-5" />
            </Button>
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                updateSearch({ q: e.target.value });
              }}
              placeholder="Buscar marca, cor ou estampa…"
              className="h-11 rounded-xl bg-card pl-9 pr-9 text-[15px]"
              inputMode="search"
              aria-label="Buscar no catálogo"
            />
            {q ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-muted"
                onClick={() => {
                  setQ("");
                  updateSearch({ q: "" });
                }}
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {/* Filtros de um toque: tamanho, marca, categoria */}
          <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Chip active={!anyFilter} onClick={() => { setQ(""); updateSearch({ q: "", marca: "", tam: "", cat: "all" }); }}>
              Todos
            </Chip>
            {sizes.map((s) => (
              <Chip key={`t-${s}`} active={search.tam === s} onClick={() => updateSearch({ tam: search.tam === s ? "" : s })}>
                {s}
              </Chip>
            ))}
            {brands.length > 1 &&
              brands.map((b) => (
                <Chip key={`m-${b}`} active={search.marca === b} onClick={() => updateSearch({ marca: search.marca === b ? "" : b })}>
                  {b}
                </Chip>
              ))}
            {categories.length > 1 &&
              categories.map((c) => (
                <Chip key={`c-${c}`} active={search.cat === c} onClick={() => updateSearch({ cat: search.cat === c ? "all" : c })}>
                  {c}
                </Chip>
              ))}
          </div>
        </div>
      </header>

      {data.cover_url && !anyFilter && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <img
            {...catalogImgProps(data.cover_url, 1024, { eager: true })}
            alt={data.name}
            className="aspect-[21/9] w-full rounded-2xl object-cover"
          />
        </div>
      )}
      {data.description && !anyFilter ? (
        <p className="mx-auto max-w-5xl px-4 pt-3 text-sm text-muted-foreground">{data.description}</p>
      ) : null}

      <main className="mx-auto max-w-5xl px-4 pt-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "peça" : "peças"}
            {isFetching ? <Loader2 className="ml-2 inline h-3 w-3 animate-spin" /> : null}
          </p>
          <select
            value={search.ord}
            onChange={(e) => updateSearch({ ord: e.target.value })}
            className="h-8 rounded-lg border border-border bg-card px-2 text-xs"
            aria-label="Ordenar"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {data.products.length === 0 ? (
          <div className="grid place-items-center py-16 text-center">
            <Package className="h-10 w-10 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Esta coleção ainda não possui produtos.</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyResults
            search={search}
            onReset={() => {
              setQ("");
              updateSearch({ q: "", marca: "", tam: "", cat: "all", disp: "todos", ord: "novidades", min: 0, max: 0 });
            }}
            onClearQ={() => {
              setQ("");
              updateSearch({ q: "" });
            }}
            onClearMarca={() => updateSearch({ marca: "" })}
            onClearCat={() => updateSearch({ cat: "all" })}
            onClearDisp={() => updateSearch({ disp: "todos" })}
            onClearOrd={() => updateSearch({ ord: "novidades" })}
            onClearPrice={() => updateSearch({ min: 0, max: 0 })}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
              {visible.map((p, cardIndex) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  data={data}
                  eager={cardIndex < 4}
                  isPreview={isPreview}
                />
              ))}
            </div>

            {hasMore && (
              <div className="mt-8 flex justify-center">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-12 rounded-xl px-8"
                  onClick={() => updateSearch({ page: currentPage + 1 }, false)}
                >
                  Ver mais peças ({filtered.length - visibleCount})
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="mx-auto mt-12 max-w-5xl space-y-2 border-t border-border/60 px-4 py-8 text-center">
        {data.show_price ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">{PAYMENT_CONDITIONS_LEGEND}</p>
        ) : null}
        <p className="text-[11px] text-muted-foreground/70">
          © {new Date().getFullYear()} {data.company_name}
        </p>
      </footer>

      {whatsHref ? (
        <a
          href={whatsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-black/20 transition-transform active:scale-95"
        >
          <MessageCircle className="h-5 w-5" /> WhatsApp
        </a>
      ) : null}
    </div>
  );
}

const NEW_DAYS = 7;

/** Cartão da vitrine: foto grande (troca para a 2ª ao passar o mouse), cor · tamanho, preço. */
function ProductCard({
  product: p,
  data,
  eager,
  isPreview,
}: {
  product: PublicCollectionProduct;
  data: PublicCollection;
  eager: boolean;
  isPreview: boolean;
}) {
  const search = Route.useSearch();
  // Só leva os filtros em uso (link curto, e "voltar" mantém a vitrine igual).
  const linkSearch: Record<string, string | number> = {};
  if (isPreview) linkSearch.preview = "1";
  if (search.q) linkSearch.q = search.q;
  if (search.marca) linkSearch.marca = search.marca;
  if (search.tam) linkSearch.tam = search.tam;
  if (search.ord && search.ord !== "novidades") linkSearch.ord = search.ord;
  if (search.page > 1) linkSearch.page = search.page;
  const variant = [p.color, p.size].filter(Boolean).join(" · ");
  const title = cardTitle(p, data.show_brand);
  const isNew =
    !!p.created_at && Date.now() - new Date(p.created_at).getTime() < NEW_DAYS * 86_400_000;
  const isLast = p.stock === 1;
  const cardPrice = calcPrecoCartao(p.price, {
    cardFeePercent: data.card_fee_percent,
    maxInstallments: data.installment_max ?? 3,
    active: data.card_price_active,
  });
  const count = maxInstallmentsFor(cardPrice, {
    maxInstallments: data.installment_max ?? 3,
    minInstallmentAmount: data.installment_min_amount ?? 0,
  });

  return (
    <Link
      to="/catalogo/colecao/$slug/produto/$productId"
      params={{ slug: data.slug, productId: p.id }}
      search={linkSearch as never}
      className="group block"
    >
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-muted">
        {p.cover_url ? (
          <>
            <img
              {...catalogImgProps(p.cover_url, 400, { eager })}
              alt={p.name}
              className={cn(
                "absolute inset-0 h-full w-full object-cover transition-opacity duration-300",
                p.second_url && "group-hover:opacity-0",
              )}
            />
            {p.second_url ? (
              <img
                {...catalogImgProps(p.second_url, 400)}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              />
            ) : null}
          </>
        ) : (
          <div className="grid h-full w-full place-items-center">
            <Package className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        {isPreview && p.stock <= 0 ? (
          <span className="absolute left-2 top-2 rounded-md bg-background/95 px-1.5 py-0.5 text-[10px] font-semibold">
            Pré-venda
          </span>
        ) : isLast && data.show_stock ? (
          <span className="absolute left-2 top-2 rounded-md bg-background/95 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm">
            Última
          </span>
        ) : isNew ? (
          <span className="absolute left-2 top-2 rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground shadow-sm">
            Novo
          </span>
        ) : null}
        {(p.image_count ?? 0) > 1 ? (
          <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1" aria-hidden="true">
            {Array.from({ length: Math.min(p.image_count ?? 0, 5) }, (_, i) => (
              <span key={i} className={cn("h-1.5 w-1.5 rounded-full bg-white shadow", i === 0 ? "opacity-100" : "opacity-60")} />
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-2 space-y-0.5 px-0.5">
        <p className="line-clamp-2 text-[13px] font-medium leading-snug">{title}</p>
        {variant ? <p className="text-xs text-muted-foreground">{variant}</p> : null}
        {data.show_price ? (
          <>
            <p className="pt-0.5 text-[15px] font-bold">{formatCurrency(p.price)}</p>
            {data.show_installments && data.card_price_active && count > 1 ? (
              <p className="text-[11px] text-muted-foreground">
                ou {count}x de {formatCurrency(calcParcela(cardPrice, count))}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </Link>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "h-9 shrink-0 rounded-full border px-4 text-[13px] font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG", "XGG", "EG", "EGG", "ÚNICO"];
function sizeRank(s: string): number {
  const i = SIZE_ORDER.indexOf(s.toUpperCase());
  if (i >= 0) return i;
  const n = Number(s);
  return Number.isFinite(n) ? 100 + n : 1000;
}

function normalizeText(v: string): string {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "•"
  );
}

/**
 * Título curto do cartão: marca + estampa quando o cadastro tem esses
 * campos ("Oakley · Costas Oakley"); senão, o nome do produto.
 */
function cardTitle(p: PublicCollectionProduct, showBrand: boolean): string {
  if (showBrand && p.brand) return [p.brand, p.model].filter(Boolean).join(" · ");
  return p.name;
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
