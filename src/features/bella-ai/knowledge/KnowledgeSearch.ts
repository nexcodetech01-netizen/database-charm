/**
 * KnowledgeSearch — helpers puros para montar o contexto RAG a partir
 * de hits retornados pela busca vetorial.
 *
 * A regra de ouro: nunca enviar documentos completos ao modelo, apenas os
 * trechos vencedores com metadados suficientes para citação.
 */

import type { KnowledgeSearchHit } from "./types";

export interface BuildContextOptions {
  /** Máximo de caracteres do contexto final. */
  maxChars?: number;
  /** Prefixo por trecho — ajuda o modelo a citar a fonte. */
  headerFormatter?: (hit: KnowledgeSearchHit, position: number) => string;
}

const DEFAULT_MAX_CHARS = 3500;

function defaultHeader(hit: KnowledgeSearchHit, position: number): string {
  const cat = hit.documentCategory ? ` · ${hit.documentCategory}` : "";
  return `[${position}] ${hit.documentTitle}${cat} (score ${(hit.similarity * 100).toFixed(0)}%)`;
}

export function buildContextText(
  hits: KnowledgeSearchHit[],
  options: BuildContextOptions = {},
): string {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const header = options.headerFormatter ?? defaultHeader;
  const parts: string[] = [];
  let total = 0;
  hits.forEach((hit, i) => {
    const block = `${header(hit, i + 1)}\n${hit.content.trim()}`;
    if (total + block.length + 2 > maxChars) return;
    parts.push(block);
    total += block.length + 2;
  });
  return parts.join("\n\n");
}

export function summarizeHits(hits: KnowledgeSearchHit[]): {
  topScore: number | null;
  documentIds: string[];
} {
  if (hits.length === 0) return { topScore: null, documentIds: [] };
  const docIds = Array.from(new Set(hits.map((h) => h.documentId)));
  return { topScore: hits[0]?.similarity ?? null, documentIds: docIds };
}
