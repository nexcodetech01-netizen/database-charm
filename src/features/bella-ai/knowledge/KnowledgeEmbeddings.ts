/**
 * KnowledgeEmbeddings — chamada ao Lovable AI Gateway para gerar embeddings.
 *
 * SEMPRE server-side (LOVABLE_API_KEY nunca vai ao cliente).
 * Modelo: openai/text-embedding-3-small (1536 dims, indexado direto no pgvector).
 */

export const KNOWLEDGE_EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const KNOWLEDGE_EMBEDDING_DIMS = 1536;

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
const BATCH_SIZE = 64;

export interface EmbedResult {
  vectors: number[][];
  usage: { promptTokens: number };
}

export async function embedTexts(
  inputs: string[],
  apiKey: string,
): Promise<EmbedResult> {
  if (!apiKey) throw new Error("LOVABLE_API_KEY não configurado.");
  if (inputs.length === 0) return { vectors: [], usage: { promptTokens: 0 } };

  const vectors: number[][] = new Array(inputs.length);
  let promptTokens = 0;

  for (let i = 0; i < inputs.length; i += BATCH_SIZE) {
    const batch = inputs.slice(i, i + BATCH_SIZE);
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: KNOWLEDGE_EMBEDDING_MODEL,
        input: batch,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
      throw new Error(`Embedding falhou (${res.status}): ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as {
      data: { embedding: number[]; index: number }[];
      usage?: { prompt_tokens?: number };
    };
    for (const row of json.data) {
      vectors[i + row.index] = row.embedding;
    }
    promptTokens += json.usage?.prompt_tokens ?? 0;
  }

  return { vectors, usage: { promptTokens } };
}
