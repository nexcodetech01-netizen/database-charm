/**
 * Inferência automática de categoria a partir do nome/descrição do produto.
 * Baseada em palavras-chave (sem custo de IA por item).
 *
 * A ordem importa: regras mais específicas vêm antes das genéricas
 * (ex.: "Mochila" antes de "Bolsa").
 */

type Rule = { category: string; keywords: string[] };

const RULES: Rule[] = [
  { category: "Mochila", keywords: ["mochila", "backpack"] },
  { category: "Carteira", keywords: ["carteira", "wallet", "porta-cartão", "porta cartao", "porta-cartoes"] },
  { category: "Necessaire", keywords: ["necessaire", "nécessaire", "necessária"] },
  { category: "Clutch", keywords: ["clutch"] },
  { category: "Pochete", keywords: ["pochete", "fanny"] },
  { category: "Bolsa Baguete", keywords: ["baguete"] },
  { category: "Bolsa Tote", keywords: ["tote"] },
  { category: "Bolsa Hobo", keywords: ["hobo"] },
  { category: "Bolsa Sacola", keywords: ["sacola", "shopper"] },
  { category: "Bolsa Transversal", keywords: ["transversal", "crossbody", "tiracolo"] },
  { category: "Bolsa Shoulder", keywords: ["shoulder"] },
  { category: "Bolsa Baú", keywords: ["baú", "bau"] },
  { category: "Bolsa Social", keywords: ["social"] },
  { category: "Bolsa", keywords: ["bolsa", "bag"] },
  { category: "Relógio", keywords: ["relógio", "relogio", "watch"] },
  { category: "Cinto", keywords: ["cinto", "belt"] },
  { category: "Óculos", keywords: ["óculos", "oculos", "sunglasses"] },
  { category: "Chaveiro", keywords: ["chaveiro"] },
  { category: "Sapato", keywords: ["sapato", "tênis", "tenis", "sandália", "sandalia", "sapatilha", "chinelo"] },
  { category: "Acessório", keywords: ["acessório", "acessorio", "pulseira", "colar", "brinco", "anel"] },
];

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/** Nome canônico usado quando nenhuma palavra-chave casa. */
export const FALLBACK_CATEGORY_NAME = "Outros";

/** Retorna o nome canônico da categoria inferida, ou `null` se nada casar. */
export function inferCategoryName(...sources: (string | null | undefined)[]): string | null {
  const haystack = normalize(sources.filter(Boolean).join(" "));
  if (!haystack) return null;
  for (const rule of RULES) {
    for (const kw of rule.keywords) {
      const n = normalize(kw);
      const re = new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
      if (re.test(haystack)) return rule.category;
    }
  }
  return null;
}

/**
 * Igual a `inferCategoryName`, mas cai para "Outros" quando nada casa,
 * sinalizando via `matched=false` para que o chamador exiba aviso de revisão.
 */
export function inferCategoryWithFallback(
  ...sources: (string | null | undefined)[]
): { name: string; matched: boolean } {
  const inferred = inferCategoryName(...sources);
  return inferred
    ? { name: inferred, matched: true }
    : { name: FALLBACK_CATEGORY_NAME, matched: false };
}
