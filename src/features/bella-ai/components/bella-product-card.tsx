import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { ProductThumb } from "@/features/products/components/product-thumb";

interface Props {
  productId: string;
  name: string;
  /** Caminho no storage (product_images.position = 0 / products.cover_image_path). */
  coverImagePath?: string | null;
  /** URL já assinada, quando disponível (recomendado em listas). */
  signedUrl?: string | null;
  price?: number | null;
  reason?: string | null;
  /** Rota destino do botão. Padrão: detalhe do produto. */
  actionLabel?: string;
  actionTo?: string;
  actionParams?: Record<string, string>;
}

/**
 * Cartão canônico para qualquer recomendação de produto feita pela Bella.
 *
 * Requisito NexOS 3.0 / IMG-001: recomendações de produto NUNCA são apenas
 * texto — sempre trazem imagem, nome, preço e um botão de ação.
 */
export function BellaProductCard({
  productId,
  name,
  coverImagePath,
  signedUrl,
  price,
  reason,
  actionLabel = "Ver produto",
  actionTo = "/produtos/$productId",
  actionParams,
}: Props) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
      <ProductThumb
        signedUrl={signedUrl ?? undefined}
        path={signedUrl === undefined ? coverImagePath ?? null : undefined}
        alt={name}
        size="md"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        {price != null ? (
          <p className="text-xs tabular-nums text-muted-foreground">
            {formatCurrency(Number(price))}
          </p>
        ) : null}
        {reason ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{reason}</p>
        ) : null}
      </div>
      <Button asChild size="sm" variant="secondary" className="shrink-0">
        <Link to={actionTo} params={actionParams ?? { productId }}>
          {actionLabel}
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
