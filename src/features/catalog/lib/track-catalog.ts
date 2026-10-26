import type { CatalogEventType } from "./catalog-events";

/**
 * Registra visita / peça vista / clique no WhatsApp no catálogo público.
 * Não conta: modo pré-visualização e quem está logado no NexOS neste
 * navegador (a própria loja olhando o catálogo).
 */
const VISITOR_KEY = "nexos-catalog-visitor";

function visitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(
        /[^A-Za-z0-9_-]/g,
        "",
      );
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return `anon${Date.now()}`;
  }
}

function isStaffBrowser(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i) ?? "";
      if (k.startsWith("sb-") && k.endsWith("-auth-token")) return true;
    }
  } catch {
    /* sem acesso ao storage: conta normalmente */
  }
  return false;
}

export function trackCatalog(
  event: CatalogEventType,
  opts: { slug: string; productId?: string | null; preview?: boolean },
) {
  if (typeof window === "undefined" || opts.preview || isStaffBrowser()) return;
  const body = JSON.stringify({
    slug: opts.slug,
    event,
    product_id: opts.productId ?? null,
    visitor_id: visitorId(),
    referrer: document.referrer ? new URL(document.referrer).hostname : null,
  });
  try {
    // keepalive: o clique no WhatsApp sai da página logo em seguida.
    void fetch("/api/public/catalog/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* métrica nunca atrapalha o cliente */
  }
}
