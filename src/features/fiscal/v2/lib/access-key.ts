/**
 * Fiscal v2 — Chave de acesso da NF-e (camada de apresentação).
 *
 * A SEFAZ define a chave com exatamente 44 dígitos. Alguns provedores
 * (e o próprio XML, no atributo `Id`) devolvem a chave prefixada com
 * "NFe", resultando em 47 caracteres. Esse prefixo é interno ao XML e
 * NUNCA deve ser exibido, copiado ou usado em nomes de arquivo.
 *
 * Sprint P0.6.3: apenas normalização de exibição. Nada é reescrito no
 * banco — a chave armazenada é preservada como está.
 */

const KEY_LENGTH = 44;

/**
 * Normaliza a chave para os 44 dígitos oficiais.
 * Remove prefixo "NFe"/"NFC", espaços e separadores.
 * Retorna `null` quando não há chave utilizável.
 */
export function normalizeAccessKey(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;
  // "NFe" + 44 dígitos → o replace acima já descarta as letras.
  if (digits.length > KEY_LENGTH) return digits.slice(-KEY_LENGTH);
  return digits;
}

/** Chave pronta para exibição/cópia; `fallback` quando ausente. */
export function formatAccessKey(raw: unknown, fallback = "—"): string {
  return normalizeAccessKey(raw) ?? fallback;
}

/** A chave possui os 44 dígitos exigidos pela SEFAZ? */
export function isValidAccessKey(raw: unknown): boolean {
  return normalizeAccessKey(raw)?.length === KEY_LENGTH;
}
