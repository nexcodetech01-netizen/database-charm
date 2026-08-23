import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageCircle, Package, Share2, Copy, X } from "lucide-react";
import { formatCurrency, getInstallmentPlan } from "@/lib/format";
import { toast } from "sonner";
import { getQuickViewProduct } from "../lib/quick-view.functions";
import { FramedImage } from "@/components/media/framed-image";
import { AvailabilityBadge, resolveAvailability } from "./availability-badge";
import { useState } from "react";

interface QuickViewDialogProps {
  slug: string;
  productId: string | null;
  preview?: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickViewDialog({
  slug,
  productId,
  preview = false,
  onOpenChange,
}: QuickViewDialogProps) {
  const getProduct = useServerFn(getQuickViewProduct);
  const [activeImage, setActiveImage] = useState(0);

  const { data: product, isLoading } = useQuery({
    queryKey: ["quick-view", slug, productId, preview],
    queryFn: () => getProduct({ data: { slug, productId: productId!, preview } }),
    enabled: !!productId,
  });

  const url = typeof window !== "undefined" ? window.location.origin + `/catalogo/colecao/${slug}/produto/${productId}` : "";

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    } catch {
      toast.error("Não foi possível copiar o link");
    }
  };

  const share = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      await navigator.share({ title: product?.product?.name ?? "Produto", url }).catch(() => {});
    } else {
      copyLink();
    }
  };

  const buildWhatsAppLink = (phone: string, productName: string, price: number, url: string) => {
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
  };

  if (!productId) return null;

  return (
    <Dialog open={!!productId} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 overflow-hidden sm:rounded-2xl">
        {isLoading ? (
          <div className="grid gap-6 p-6 sm:grid-cols-2">
            <Skeleton className="aspect-square w-full rounded-xl" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ) : product?.product ? (
          <div className="grid h-full sm:grid-cols-2">
            <div className="relative bg-muted">
              <FramedImage
                src={product.product.images[activeImage]?.url ?? product.product.images[0]?.url}
                alt={product.product.name}
                aspect="square"
                containerClassName="w-full h-full"
                imgClassName="w-full h-full object-cover"
                fallback={<Package className="h-12 w-12 text-muted-foreground" />}
              />
              {product.product.images.length > 1 && (
                <div className="absolute bottom-4 left-4 right-4 flex gap-2 overflow-x-auto pb-2">
                  {product.product.images.map((img, i) => (
                    <button
                      key={img.path}
                      onClick={() => setActiveImage(i)}
                      className={`w-12 h-12 rounded-md border-2 shrink-0 ${
                        i === activeImage ? "border-primary" : "border-transparent"
                      } bg-background overflow-hidden`}
                    >
                      <img src={img.url} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex flex-col p-6 sm:p-8">
              <div className="flex justify-between items-start mb-2">
                <div>
                  {product.product.brand && (
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      {product.product.brand}
                    </div>
                  )}
                  <DialogTitle 
                    className="text-2xl font-extrabold leading-tight tracking-tight"
                    style={{ fontFamily: 'Montserrat, sans-serif' }}
                  >
                    {product.product.name}
                  </DialogTitle>
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={copyLink}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={share}>
                    <Share2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="mt-4 flex items-baseline gap-2">
                <div className="text-3xl font-bold text-primary">
                  {formatCurrency(product.product.price)}
                </div>
                {product.product.stock > 0 && (
                  <AvailabilityBadge kind={resolveAvailability(product.product.stock)} />
                )}
              </div>

              {getInstallmentPlan(product.product.price) && (
                <Badge variant="secondary" className="mt-2 w-fit bg-primary/10 text-primary border-none">
                  {getInstallmentPlan(product.product.price)?.label}
                </Badge>
              )}

              <div className="mt-6 flex-1">
                <h4 className="text-sm font-semibold text-foreground mb-2">Descrição</h4>
                <p className="text-sm text-muted-foreground line-clamp-6 whitespace-pre-line">
                  {product.product.description || "Nenhuma descrição disponível."}
                </p>
              </div>

              <div className="mt-8 space-y-3">
                {product.product.cta === "whatsapp" && product.product.whatsapp_phone ? (
                  <Button asChild size="lg" className="w-full text-base font-semibold">
                    <a
                      href={buildWhatsAppLink(
                        product.product.whatsapp_phone,
                        product.product.name,
                        product.product.price,
                        url
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="mr-2 h-5 w-5" />
                      Pedir no WhatsApp
                    </a>
                  </Button>
                ) : (
                  <Button size="lg" className="w-full text-base font-semibold" disabled>
                    Indisponível no momento
                  </Button>
                )}
                <Button variant="outline" size="lg" className="w-full" onClick={() => onOpenChange(false)}>
                  Continuar navegando
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-12 text-center">
            <p>Produto não encontrado.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
