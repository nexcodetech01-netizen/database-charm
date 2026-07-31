/**
 * Normalização de nomes/textos livres (pt-BR).
 *
 * Regras:
 * - Trim e colapso de espaços múltiplos.
 * - Capitaliza primeira letra de cada palavra preservando acentos.
 * - Mantém artigos/preposições curtos em minúsculo quando NO MEIO da frase.
 * - Não altera strings totalmente numéricas.
 * - Não deve ser aplicada em e-mail, senha, SKU, códigos, URLs ou documentos
 *   (CPF/CNPJ/CEP/telefone). O componente/hook decide onde aplicar.
 */

const LOWER_WORDS = new Set([
  "de",
  "da",
  "do",
  "das",
  "dos",
  "e",
  "em",
  "para",
  "com",
]);

/** Colapsa espaços internos e faz trim. */
export function collapseSpaces(v: string): string {
  return v.replace(/\s+/g, " ").trim();
}

/** Capitaliza uma palavra preservando acentos e caracteres unicode. */
function capitalizeWord(word: string): string {
  if (!word) return word;
  // Preserva palavras com hífen: "são-paulo" -> "São-Paulo"
  if (word.includes("-")) {
    return word.split("-").map(capitalizeWord).join("-");
  }
  const first = word.charAt(0).toLocaleUpperCase("pt-BR");
  const rest = word.slice(1).toLocaleLowerCase("pt-BR");
  return first + rest;
}

/**
 * Aplica title case pt-BR:
 * - Primeira e última palavra sempre capitalizadas.
 * - Palavras em LOWER_WORDS ficam minúsculas quando no meio.
 * - Não altera strings totalmente numéricas.
 */
export function toTitleCasePtBr(input: string | null | undefined): string {
  if (input == null) return "";
  const cleaned = collapseSpaces(String(input));
  if (!cleaned) return "";
  // Não altera valores puramente numéricos (ex.: "123", "12 34").
  if (/^[\d\s]+$/.test(cleaned)) return cleaned;

  const words = cleaned.split(" ");
  return words
    .map((w, i) => {
      const lower = w.toLocaleLowerCase("pt-BR");
      const isEdge = i === 0 || i === words.length - 1;
      if (!isEdge && LOWER_WORDS.has(lower)) return lower;
      return capitalizeWord(w);
    })
    .join(" ");
}

/**
 * Handler onBlur pronto para inputs controlados.
 *
 * Uso:
 *   <Input
 *     value={form.name}
 *     onChange={(e) => setForm({ ...form, name: e.target.value })}
 *     onBlur={handleTitleCaseBlur((v) => setForm({ ...form, name: v }))}
 *   />
 */
export function handleTitleCaseBlur(
  setter: (next: string) => void,
): (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void {
  return (e) => {
    const current = e.currentTarget.value;
    const next = toTitleCasePtBr(current);
    if (next !== current) setter(next);
  };
}
