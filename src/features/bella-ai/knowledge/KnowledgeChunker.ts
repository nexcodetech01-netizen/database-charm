/**
 * KnowledgeChunker — divide texto longo em chunks para embedding.
 *
 * Estratégia: janelas por parágrafo com sobreposição, respeitando
 * um teto de caracteres. Puro (sem I/O) — testável isoladamente.
 */

export interface ChunkOptions {
  /** Tamanho alvo por chunk em caracteres. */
  targetSize?: number;
  /** Sobreposição entre chunks em caracteres. */
  overlap?: number;
  /** Tamanho mínimo — chunks menores são descartados/mesclados. */
  minSize?: number;
}

const DEFAULTS: Required<ChunkOptions> = {
  targetSize: 900,
  overlap: 120,
  minSize: 120,
};

export interface TextChunk {
  index: number;
  content: string;
  tokenEstimate: number;
}

/** Estimativa grosseira de tokens (~4 chars por token). */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

/** Normaliza whitespace preservando quebras de parágrafo. */
export function normalizeText(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkText(input: string, options: ChunkOptions = {}): TextChunk[] {
  const opts = { ...DEFAULTS, ...options };
  const text = normalizeText(input);
  if (!text) return [];

  const chunks: TextChunk[] = [];
  let start = 0;
  let index = 0;
  const size = opts.targetSize;
  const overlap = Math.min(opts.overlap, Math.floor(size / 2));

  while (start < text.length) {
    let end = Math.min(start + size, text.length);
    // Tenta quebrar em fim de sentença/parágrafo próximo.
    if (end < text.length) {
      const window = text.slice(start, end);
      const lastBreak = Math.max(
        window.lastIndexOf("\n\n"),
        window.lastIndexOf(". "),
        window.lastIndexOf("! "),
        window.lastIndexOf("? "),
      );
      if (lastBreak > size * 0.5) end = start + lastBreak + 1;
    }
    const slice = text.slice(start, end).trim();
    if (slice.length >= opts.minSize || start === 0) {
      chunks.push({
        index: index++,
        content: slice,
        tokenEstimate: estimateTokens(slice),
      });
    } else if (chunks.length > 0) {
      // Anexa resto ao último chunk.
      const last = chunks[chunks.length - 1];
      last.content = `${last.content}\n${slice}`.trim();
      last.tokenEstimate = estimateTokens(last.content);
    }
    if (end >= text.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
