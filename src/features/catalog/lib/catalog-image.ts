/**
 * Fotos do catálogo público no tamanho certo.
 *
 * O catálogo carregava a foto original (às vezes 2–5 MB) até na grade, onde
 * ela aparece do tamanho de um cartão. Aqui pedimos a versão redimensionada
 * (endpoint de transformação do Supabase, WebP quando o navegador aceita),
 * com 1x/2x para telas retina, e caímos para a original se a transformação
 * não estiver disponível.
 */
import type { ImgHTMLAttributes, SyntheticEvent } from "react";
import {
  withImageTransform,
  withoutImageTransform,
} from "@/features/products/services/product-images.service";

type ImgProps = Pick<
  ImgHTMLAttributes<HTMLImageElement>,
  "src" | "srcSet" | "loading" | "decoding" | "onError" | "sizes"
> & { fetchPriority?: "high" | "low" | "auto" };

function fallbackToOriginal(e: SyntheticEvent<HTMLImageElement>) {
  const img = e.currentTarget;
  if (img.dataset.fallback === "1") return;
  img.dataset.fallback = "1";
  img.removeAttribute("srcset");
  img.src = withoutImageTransform(img.currentSrc || img.src);
}

/**
 * @param width largura exibida (em px CSS); a versão 2x é pedida no srcset.
 * @param eager true para as primeiras fotos visíveis (carregam já).
 */
export function catalogImgProps(
  url: string | null | undefined,
  width: number,
  options: { eager?: boolean } = {},
): ImgProps {
  if (!url) return { src: undefined };
  const one = withImageTransform(url, width);
  const two = withImageTransform(url, width * 2);
  const transformed = one !== url;
  return {
    src: one,
    srcSet: transformed ? `${one} 1x, ${two} 2x` : undefined,
    loading: options.eager ? "eager" : "lazy",
    decoding: "async",
    fetchPriority: options.eager ? "high" : undefined,
    onError: transformed ? fallbackToOriginal : undefined,
  };
}
