/**
 * Recuperação de "versão antiga aberta".
 *
 * Depois de um Publish, os arquivos de cada tela ganham nomes novos e os
 * antigos deixam de existir. Quem estava com o sistema aberto continua com a
 * versão antiga carregada: ao trocar de menu, o navegador tenta baixar a tela
 * pelo nome antigo, falha, e a navegação fica parada ("travou").
 *
 * Aqui detectamos esse erro e recarregamos a página uma vez, já na tela de
 * destino, para pegar a versão nova. Uma trava evita recarregar em loop.
 */
const GUARD_KEY = "nexos:chunk-reload-at";
const GUARD_MS = 20_000;

const CHUNK_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Loading chunk [\w-]+ failed|ChunkLoadError/i;

export function isChunkLoadError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? `${err.name} ${err.message}`
      : typeof err === "string"
        ? err
        : ((err as { message?: string } | null)?.message ?? "");
  return CHUNK_ERROR.test(msg);
}

/** Recarrega (uma vez a cada 20 s) para buscar a versão publicada. */
export function reloadForNewVersion(targetHref?: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(sessionStorage.getItem(GUARD_KEY) || 0);
    if (Date.now() - last < GUARD_MS) return false;
    sessionStorage.setItem(GUARD_KEY, String(Date.now()));
  } catch {
    // sessionStorage indisponível: recarrega mesmo assim (melhor que travar).
  }
  if (targetHref && targetHref !== window.location.href) window.location.assign(targetHref);
  else window.location.reload();
  return true;
}

let installed = false;

export function installChunkRecovery(getPendingHref?: () => string | undefined): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  // Vite avisa quando não consegue pré-carregar um arquivo de tela.
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    reloadForNewVersion(getPendingHref?.());
  });

  // Import dinâmico que falhou e não foi tratado.
  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) reloadForNewVersion(getPendingHref?.());
  });
}
