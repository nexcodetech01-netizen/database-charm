/**
 * A câmera lê o mesmo código várias vezes por segundo. Só deixa passar um
 * código igual depois de `ms` milissegundos (outro código passa na hora).
 */
export function createCodeDebouncer(ms = 2500) {
  let last = "";
  let at = -Infinity;
  return (raw: string, now: number = Date.now()): boolean => {
    const code = raw.trim();
    if (!code) return false;
    if (code === last && now - at < ms) return false;
    last = code;
    at = now;
    return true;
  };
}

/** Mensagem amigável para os erros mais comuns de câmera. */
export function cameraErrorMessage(err: unknown): string {
  const name = (err as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "A câmera foi bloqueada. Permita o uso da câmera para este site (ícone do cadeado na barra de endereço) e tente de novo.";
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return "Nenhuma câmera encontrada neste aparelho.";
  if (name === "NotReadableError")
    return "A câmera está sendo usada por outro aplicativo. Feche o outro app e tente de novo.";
  return "Não foi possível abrir a câmera.";
}
