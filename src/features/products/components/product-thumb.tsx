import { Package } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSignedImageUrls } from "../hooks/use-products";

const SIZE_CLASS = {
  xs: "h-8 w-8 rounded-md",
  sm: "h-10 w-10 rounded-md",
  md: "h-14 w-14 rounded-lg",
  lg: "h-24 w-24 rounded-xl",
  xl: "h-40 w-40 rounded-2xl",
} as const;

const ICON_CLASS = {
  xs: "h-3.5 w-3.5",
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-7 w-7",
  xl: "h-10 w-10",
} as const;

export type ProductThumbSize = keyof typeof SIZE_CLASS;

interface Props {
  /** URL já assinada (preferido em listas — evita queries duplicadas). */
  signedUrl?: string | null;
  /** URL externa direta (ex: hospedagem externa ou legado). */
  image_url?: string | null;
  /** Caminho no storage. Só use quando NÃO houver forma de agregar em lote. */
  path?: string | null;
  alt?: string;
  size?: ProductThumbSize;
  className?: string;
}

/**
 * Miniatura padronizada da imagem principal de um produto.
 *
 * - Reaproveita `useSignedImageUrls` quando recebe `path`.
 * - Em listas, prefira agregar todos os `cover_image_path` do dataset em um
 *   único `useSignedImageUrls([...])` e passar o `signedUrl` já resolvido —
 *   isso evita N assinaturas independentes.
 * - Sem imagem: mostra placeholder padrão do sistema (ícone Package).
 */
export function ProductThumb({
  signedUrl,
  image_url,
  path,
  alt = "Produto",
  size = "sm",
  className,
}: Props) {
  const shouldFetch = signedUrl === undefined && !!path;
  const { data: signed = [] } = useSignedImageUrls(
    shouldFetch ? [path!] : [],
    THUMB_WIDTH[size],
  );
  const url = signedUrl ?? signed[0]?.signedUrl ?? image_url ?? null;

  return (
    <div
      className={cn(
        "grid shrink-0 place-items-center overflow-hidden border border-border bg-muted",
        SIZE_CLASS[size],
        className,
      )}
      aria-hidden={!url}
    >
      {url ? (
        <img src={url} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      ) : (
        <Package className={cn("text-muted-foreground", ICON_CLASS[size])} />
      )}
    </div>
  );
}
