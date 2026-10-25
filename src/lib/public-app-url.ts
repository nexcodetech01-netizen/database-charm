/** Endereço oficial do NexOS — usado nos links enviados por email. */
export const PUBLIC_APP_URL = "https://nexos.nexxcode.com.br";

/**
 * Base dos links de email (redefinir senha, confirmar conta, convite).
 * Se o pedido sair do computador (localhost) ou de um preview, o link iria
 * para um endereço que o celular não abre — então usa sempre o oficial.
 */
export function publicAppOrigin(): string {
  if (typeof window === "undefined") return PUBLIC_APP_URL;
  const host = window.location.hostname;
  const local =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".local") ||
    /^\d+\.\d+\.\d+\.\d+$/.test(host);
  const preview = host.endsWith(".lovableproject.com") || host.includes("preview");
  return local || preview ? PUBLIC_APP_URL : window.location.origin;
}
