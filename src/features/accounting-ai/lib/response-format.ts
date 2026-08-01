/**
 * Bella Contadora — Padrão de resposta (Sprint 7.4).
 *
 * Funções puras de FORMATAÇÃO. Não leem dados, não calculam nada e não
 * decidem conteúdo: apenas garantem que toda resposta da Bella siga a
 * mesma estrutura e a mesma linguagem.
 *
 *   Resumo → Explicação → Evidências → Recomendação
 */

export const BELLA_SECTION_LABELS = {
  summary: "Resumo",
  explanation: "Explicação",
  evidence: "Evidências",
  recommendation: "Recomendação",
} as const;

export type BellaSectionKey = keyof typeof BELLA_SECTION_LABELS;

export interface BellaSections {
  summary?: string | null;
  explanation?: string | null;
  evidence?: string | null;
  recommendation?: string | null;
}

/** Ordem canônica dos blocos — usada por todas as respostas. */
export const BELLA_SECTION_ORDER: BellaSectionKey[] = [
  "summary",
  "explanation",
  "evidence",
  "recommendation",
];

const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu;

/** Espaços, quebras e pontuação duplicada. */
export function collapse(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?])/g, "$1")
    .replace(/([.!?])\1+/g, "$1")
    .trim();
}

/** No máximo um emoji por resposta — o restante é ruído visual. */
export function limitEmoji(text: string, max = 1): string {
  let seen = 0;
  return collapse(
    text.replace(EMOJI, (match) => {
      seen += 1;
      return seen <= max ? match : "";
    }),
  );
}

/** Remove frases repetidas (mesma frase dita por duas skills). */
export function dedupeSentences(text: string): string {
  const parts = text.split(/(?<=[.!?])\s+/);
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const part of parts) {
    const sentence = part.trim();
    if (!sentence) continue;
    const key = sentence
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kept.push(sentence);
  }
  return kept.join(" ");
}

/** Higiene final de qualquer texto exibido pela Bella. */
export function polish(text: string): string {
  return collapse(limitEmoji(dedupeSentences(collapse(text))));
}

/** Monta os blocos na ordem canônica, ignorando os vazios. */
export function formatSections(sections: BellaSections): string {
  const blocks: string[] = [];
  for (const key of BELLA_SECTION_ORDER) {
    const value = sections[key];
    if (!value) continue;
    const clean = collapse(value);
    if (!clean) continue;
    blocks.push(
      key === "summary" ? clean : `${BELLA_SECTION_LABELS[key]}: ${clean}`,
    );
  }
  return polish(blocks.join(" "));
}

/** Lista numerada usada no bloco de explicação. */
export function numbered(items: readonly string[]): string {
  return items.map((item, index) => `${index + 1}. ${collapse(item)}`).join(" ");
}

/** Lista de evidências (rótulo: valor) separada por ponto médio. */
export function evidenceList(items: readonly { label: string; value: string }[]): string {
  return items.map((e) => `${e.label}: ${e.value}`).join(" · ");
}
