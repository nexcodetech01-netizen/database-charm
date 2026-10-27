/**
 * Rede de segurança das fotos leves (27/10/2026): se a versão leve de uma
 * foto (`….w400.webp`) ainda não existir — foto antiga, antes de rodar
 * "Otimizar fotos" —, qualquer <img> do app volta sozinha para a original.
 */
const VARIANT_RE = /\.w\d+\.webp(?=$|\?)/;

let installed = false;

export function installImageVariantFallback(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener(
    "error",
    (event) => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement)) return;
      const src = img.currentSrc || img.src;
      if (!VARIANT_RE.test(src) || img.dataset.variantFallback) return;
      img.dataset.variantFallback = "pending";
      img.removeAttribute("srcset");
      img.src = src.replace(VARIANT_RE, "");
    },
    true,
  );
}

/**
 * Para `onError` de componentes que escondem a imagem quebrada: devolve
 * true quando o erro foi só da versão leve e a original já está sendo
 * tentada (não esconder ainda).
 */
export function isVariantRetry(img: EventTarget | null): boolean {
  if (!(img instanceof HTMLImageElement)) return false;
  if (img.dataset.variantFallback === "pending") {
    img.dataset.variantFallback = "done";
    return true;
  }
  return false;
}
