/** Texto do erro para a tela; o Supabase devolve objetos, não Error. */
export function describeSaveError(err: unknown): string {
  if (err instanceof Error && err.message) return err.message;
  if (err && typeof err === "object") {
    const e = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const msg = typeof e.message === "string" ? e.message : "";
    if (String(e.code) === "23505" && /purchases_company_id_number_key/.test(msg)) {
      return "Já existe uma compra com este número. Abra a lista de Compras: ela pode já ter sido criada numa tentativa anterior. Se for outra compra, troque o número.";
    }
    if (/row-level security|permission denied/i.test(msg)) {
      return "O banco não permitiu salvar esta alteração (sem permissão ou compra já recebida).";
    }
    const parts = [msg, typeof e.details === "string" ? e.details : "", typeof e.hint === "string" ? e.hint : ""]
      .filter(Boolean);
    if (parts.length) return parts.join(" — ") + (e.code ? ` (código ${String(e.code)})` : "");
  }
  if (typeof err === "string" && err) return err;
  return "Erro desconhecido. Tente novamente.";
}
