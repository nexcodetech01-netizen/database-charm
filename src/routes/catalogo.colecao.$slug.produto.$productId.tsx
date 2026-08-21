import { useMemo, useState } from "react";
import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Copy,
  Package,
  Share2,
  MessageCircle,
  CreditCard,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, getInstallmentPlan } from "@/lib/format";
import type { PublicProductDetail } from "@/features/catalog/types";
import { loadPublicProduct } from "@/features/catalog/lib/public-product.functions";
import {
  AvailabilityBadge,
  resolveAvailability,
} from "@/features/catalog/components/availability-badge";
import { ProductLightbox } from "@/features/catalog/components/product-lightbox";
import { ProductReviews } from "@/features/catalog/components/product-reviews";
import { FramedImage } from "@/components/media/framed-image";

const productSearchSchema = z.object({
  preview: fallback(z.string(), "").default(""),
  q: fallback(z.string(), "").default(""),
  marca: fallback(z.string(), "").default(""),
  disp: fallback(z.string(), "").default(""),
  ord: fallback(z.string(), "").default(""),
  page: fallback(z.number().int(), 1).default(1),
});

function truncate(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

export const Route = createFileRoute("/catalogo/colecao/$slug/produto/$productId")({
  validateSearch: zodValidator(productSearchSchema),
  loaderDeps: ({ search }) => ({ preview: search.preview === "1" }),
  loader: ({ params, deps }) =>
    loadPublicProduct({
      data: {
        slug: params.slug,
        productId: params.productId,
        preview: deps.preview,
      },
    }),
  head: ({ params, loaderData }) => {
    const product = loaderData?.product ?? null;
    const origin = loaderData?.origin ?? "";
    const pageUrl = origin
      ? `${origin}/catalogo/colecao/${encodeURIComponent(
          params.slug,
        )}/produto/${encodeURIComponent(params.productId)}`
      : undefined;

    if (!product) {
      const fallbackTitle = "Produto indisponível";
      const fallbackDesc =
        "Este produto não existe ou não está mais disponível na coleção.";
      const meta = [
        { title: fallbackTitle },
        { name: "description", content: fallbackDesc },
        { name: "robots", content: "noindex" },
        { property: "og:title", content: fallbackTitle },
        { property: "og:description", content: fallbackDesc },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
        { name: "twitter:title", content: fallbackTitle },
        { name: "twitter:description", content: fallbackDesc },
      ];
      if (pageUrl) meta.push({ property: "og:url", content: pageUrl });
      return {
        meta,
        links: pageUrl ? [{ rel: "canonical", href: pageUrl }] : undefined,
      };
    }

    const title = `${product.name} — ${product.company_name}`;
    const priceLabel = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(product.price);
    const baseDesc =
      product.description?.trim() ||
      `${product.name}${product.brand ? ` da ${product.brand}` : ""} por ${priceLabel} na coleção ${product.collection.name}.`;
    const description = truncate(baseDesc, 160);
    const image = product.images[0]?.url;

    const meta: Array<Record<string, string>> = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "product" },
      { property: "og:site_name", content: product.company_name },
      { property: "og:locale", content: "pt_BR" },
      { property: "product:price:amount", content: product.price.toFixed(2) },
      { property: "product:price:currency", content: "BRL" },
      {
        property: "product:availability",
        content: product.stock > 0 ? "in stock" : "out of stock",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: title },
      { name: "twitter:description", content: description },
    ];
    if (pageUrl) meta.push({ property: "og:url", content: pageUrl });
    if (image) {
      meta.push(
        { property: "og:image", content: image },
        { property: "og:image:alt", content: product.name },
        { name: "twitter:image", content: image },
      );
    }
    if (product.brand) {
      meta.push({ property: "product:brand", content: product.brand });
    }

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.name,
      description,
      image: product.images.map((img) => img.url),
      brand: product.brand
        ? { "@type": "Brand", name: product.brand }
        : undefined,
      offers: {
        "@type": "Offer",
        priceCurrency: "BRL",
        price: product.price.toFixed(2),
        availability:
          product.stock > 0
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
        url: pageUrl,
        seller: { "@type": "Organization", name: product.company_name },
      },
    };

    return {
      meta,
      links: pageUrl ? [{ rel: "canonical", href: pageUrl }] : undefined,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(jsonLd),
        },
      ],
    };
  },
  component: PublicProductPage,
});

async function fetchProduct(
  slug: string,
  productId: string,
  preview: boolean,
): Promise<PublicProductDetail> {
  const qs = preview ? "?preview=1" : "";
  const res = await fetch(
    `/api/public/catalog/${encodeURIComponent(slug)}/product/${encodeURIComponent(productId)}${qs}`,
  );
  if (res.status === 404) throw notFound();
  if (!res.ok) throw new Error("Falha ao carregar produto");
  return res.json();
}

function buildWhatsAppLink(
  phone: string,
  productName: string,
  price: number,
  url: string,
): string {
  const message = [
    "Olá!",
    "",
    "Tenho interesse neste produto:",
    "",
    `Nome: ${productName}`,
    `Preço: ${formatCurrency(price)}`,
    "",
    `Link do produto: ${url}`,
    "",
    "Gostaria de mais informações.",
  ].join("\n");
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function PublicProductPage() {
  const { slug, productId } = Route.useParams();
  const search = Route.useSearch();
  const isPreview = search.preview === "1";
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-product", slug, productId, isPreview],
    queryFn: () => fetchProduct(slug, productId, isPreview),
    staleTime: 60_000,
    retry: 1,
  });

  const [activeImage, setActiveImage] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [entradaOpen, setEntradaOpen] = useState(false);

  const url = typeof window !== "undefined" ? window.location.href : "";

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  }
  async function share() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      await navigator
        .share({ title: data?.name ?? "Produto", url })
        .catch(() => {});
    } else {
      copyLink();
    }
  }

  const installmentPlan = useMemo(
    () => (data ? getInstallmentPlan(data.price) : null),
    [data],
  );

  // Preserve filter context when returning to the collection
  const collectionSearch: Record<string, string | number> = {};
  if (isPreview) collectionSearch.preview = "1";
  if (search.q) collectionSearch.q = search.q;
  if (search.marca) collectionSearch.marca = search.marca;
  if (search.disp) collectionSearch.disp = search.disp;
  if (search.ord) collectionSearch.ord = search.ord;
  if (search.page && search.page > 1) collectionSearch.page = search.page;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <div className="mx-auto max-w-xl px-4 py-4">
          <Skeleton className="mb-4 h-8 w-40" />
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="max-w-sm text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
          <h1 className="mt-3 text-lg font-semibold">
            Produto indisponível
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Este produto não existe, não está mais disponível ou não conseguimos
            carregá-lo agora.
          </p>
          <div className="mt-4 flex justify-center gap-2">
            <Button variant="outline" onClick={() => refetch()}>
              Tentar novamente
            </Button>
            <Button asChild variant="ghost">
              <Link
                to="/catalogo/colecao/$slug"
                params={{ slug }}
                search={collectionSearch}
              >
                Voltar à coleção
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const outOfStock = data.stock <= 0;
  const cover = data.images[activeImage]?.url ?? data.images[0]?.url ?? null;
  const availability = resolveAvailability(data.stock, { presale: isPreview });
  const showAvailabilityBadge = data.show_stock || availability === "presale";

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Topbar */}
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
          <Button asChild size="sm" variant="ghost">
            <Link
              to="/catalogo/colecao/$slug"
              params={{ slug: data.collection.slug }}
              search={collectionSearch}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {data.collection.name}
            </Link>
          </Button>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" onClick={copyLink} aria-label="Copiar link">
              <Copy className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={share} aria-label="Compartilhar">
              <Share2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>


      <main className="mx-auto max-w-xl px-4 pt-4">
        {/* Galeria */}
        <button
          type="button"
          onClick={() => cover && setLightboxOpen(true)}
          className="group relative block w-full overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={cover ? "Ampliar imagem" : "Sem imagem"}
        >
          <FramedImage
            src={cover}
            alt={data.name}
            framing={data.images[activeImage] ?? data.images[0]}
            aspect="square"
            rounded="xl"
            fallback={<Package className="h-14 w-14 text-muted-foreground" />}
          />
          {showAvailabilityBadge && (
            <AvailabilityBadge
              kind={availability}
              className="absolute left-3 top-3"
            />
          )}
        </button>
        {data.images.length > 1 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {data.images.map((img, i) => (
              <button
                key={img.path}
                type="button"
                onClick={() => setActiveImage(i)}
                onDoubleClick={() => {
                  setActiveImage(i);
                  setLightboxOpen(true);
                }}
                className={`w-16 shrink-0 rounded-md border-2 ${
                  i === activeImage ? "border-primary" : "border-transparent"
                }`}
              >
                <FramedImage
                  src={img.url}
                  framing={img}
                  aspect="square"
                  rounded="sm"
                />
              </button>
            ))}
          </div>
        )}


        {/* Info */}
        <section className="mt-5">
          {data.show_brand && data.brand && (
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {data.brand}
            </div>
          )}
          <h1 className="mt-0.5 text-xl font-bold sm:text-2xl">{data.name}</h1>

          <div className="mt-3 flex items-center gap-2">
            {data.show_price && (
              <div className="text-3xl font-bold">{formatCurrency(data.price)}</div>
            )}
            {showAvailabilityBadge && (
              <AvailabilityBadge kind={availability} />
            )}
          </div>

          {data.show_installments && data.show_price && installmentPlan && (
            <Badge
              variant="secondary"
              className="mt-2 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              {installmentPlan.label}
            </Badge>
          )}
          {data.show_price && data.pix_discount_percent && data.pix_discount_percent > 0 && (
            <div className="mt-1 text-sm text-emerald-600">
              {data.pix_discount_percent}% de desconto no PIX
            </div>
          )}

          {data.description && (
            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
              {data.description}
            </p>
          )}

          <ProductReviews productId={data.id} companyId={data.company_id} />
        </section>

        {data.related.length > 0 && (
          <section className="mt-8">
            <h2 className="text-sm font-semibold">Você também pode gostar</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {data.related.map((r) => {
                return (
                  <Link
                    key={r.id}
                    to="/catalogo/colecao/$slug/produto/$productId"
                    params={{ slug: data.collection.slug, productId: r.id }}
                    search={collectionSearch}
                    className="group overflow-hidden rounded-lg border bg-card"
                  >
                    <div className="relative aspect-square w-full overflow-hidden bg-muted">
                      {r.cover_url ? (
                        <img
                          src={r.cover_url}
                          alt={r.name}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      {(data.show_stock || isPreview) && (
                        <AvailabilityBadge
                          kind={resolveAvailability(r.stock, { presale: isPreview })}
                          size="sm"
                          className="absolute left-1.5 top-1.5"
                        />
                      )}
                    </div>
                    <div className="space-y-0.5 p-2">
                      {data.show_brand && r.brand && (
                        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                          {r.brand}
                        </div>
                      )}
                      <div className="line-clamp-2 text-xs font-medium">{r.name}</div>
                      {data.show_price && (
                        <div className="text-sm font-bold">{formatCurrency(r.price)}</div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}


        <div className="mt-6 border-t pt-4 text-xs text-muted-foreground">
          Vendido por <strong>{data.company_name}</strong>
        </div>
      </main>

      {/* CTA fixo mobile-first */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl">
          <PrimaryCta
            data={data}
            outOfStock={outOfStock}
            currentUrl={url}
            onOpenEntrada={() => setEntradaOpen(true)}
          />
        </div>
      </div>

      <EntradaDialog
        open={entradaOpen}
        onOpenChange={setEntradaOpen}
        product={data}
      />

      <ProductLightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        images={data.images}
        index={activeImage}
        onIndexChange={setActiveImage}
        alt={data.name}
      />
    </div>
  );
}

function PrimaryCta({
  data,
  outOfStock,
  currentUrl,
  onOpenEntrada,
}: {
  data: PublicProductDetail;
  outOfStock: boolean;
  currentUrl: string;
  onOpenEntrada: () => void;
}) {
  if (outOfStock) {
    return (
      <Button size="lg" className="w-full" disabled>
        Esgotado
      </Button>
    );
  }
  if (data.cta === "whatsapp" && data.whatsapp_phone) {
    const href = buildWhatsAppLink(
      data.whatsapp_phone,
      data.name,
      data.price,
      currentUrl,
    );
    return (
      <Button asChild size="lg" className="w-full">
        <a href={href} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="mr-2 h-5 w-5" />
          Comprar pelo WhatsApp
        </a>
      </Button>
    );
  }
  if (data.cta === "entrada") {
    return (
      <Button size="lg" className="w-full" onClick={onOpenEntrada}>
        <CreditCard className="mr-2 h-5 w-5" />
        Pagar entrada
      </Button>
    );
  }
  return (
    <Button size="lg" variant="secondary" className="w-full" disabled>
      Consulte disponibilidade
    </Button>
  );
}

function EntradaDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: PublicProductDetail;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const entradaValue =
    Math.round(product.price * (product.entrada_percent / 100) * 100) / 100;
  const remaining = Math.max(0, product.price - entradaValue);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/public/catalog/entrada", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: product.collection.slug,
          productId: product.id,
          buyerName: name.trim(),
          buyerEmail: email.trim() || undefined,
          buyerPhone: phone.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Falha ao gerar entrada");
      }
      return (await res.json()) as {
        invoice_url: string | null;
      };
    },
    onSuccess: (data) => {
      toast.success("Entrada gerada — abrindo pagamento");
      if (data.invoice_url) {
        window.open(data.invoice_url, "_blank", "noopener,noreferrer");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Não foi possível gerar a entrada");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pagar entrada</DialogTitle>
          <DialogDescription>
            Gere um PIX de entrada para reservar este produto.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Entrada ({product.entrada_percent}%)</span>
            <strong>{formatCurrency(entradaValue)}</strong>
          </div>
          <div className="mt-1 flex justify-between">
            <span className="text-muted-foreground">Saldo restante</span>
            <span>{formatCurrency(remaining)}</span>
          </div>
        </div>

        <div className="grid gap-3">
          <div>
            <Label htmlFor="ent-name">Seu nome</Label>
            <Input
              id="ent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Como devemos te chamar?"
            />
          </div>
          <div>
            <Label htmlFor="ent-email">E-mail (opcional)</Label>
            <Input
              id="ent-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
            />
          </div>
          <div>
            <Label htmlFor="ent-phone">WhatsApp (opcional)</Label>
            <Input
              id="ent-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={name.trim().length < 2 || mutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Gerar PIX
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
