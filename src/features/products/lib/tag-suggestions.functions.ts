import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { normalizeTags, MAX_PRODUCT_TAGS } from "@/lib/product-tags";

const Input = z.object({
  name: z.string().min(1),
  category: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  existingTags: z.array(z.string()).optional().default([]),
});

const OutputSchema = z.object({
  tags: z.array(z.string()).min(1).max(MAX_PRODUCT_TAGS),
});

export const suggestProductTags = createServerFn({ method: "POST" })
  // Hardening: consome créditos do LOVABLE_API_KEY — exige sessão.
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => Input.parse(v))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      throw new Error("LOVABLE_API_KEY ausente. Configure a chave para gerar tags automaticamente.");
    }

    const gateway = createLovableAiGatewayProvider(key);

    const context = [
      `Nome: ${data.name}`,
      data.brand ? `Marca: ${data.brand}` : null,
      data.category ? `Categoria: ${data.category}` : null,
      data.description ? `Descrição: ${data.description}` : null,
      data.existingTags && data.existingTags.length
        ? `Tags já existentes (não repetir): ${data.existingTags.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const system = [
      "Você é a Bella, assistente do NexOS especializada em catalogação de produtos de moda e varejo brasileiro.",
      "Sua tarefa é gerar entre 6 e 10 tags curtas em português para o produto informado.",
      "Regras estritas:",
      "- Tags curtas (1 a 3 palavras), em Português (Primeira Letra Maiúscula).",
      "- Extraia atributos objetivos: cor, material, formato, estilo (ex.: Casual, Premium, Festa), ocasião de uso, fecho, alça, marca inspirada.",
      "- Não invente características que não estejam sugeridas pelo nome/descrição.",
      "- Nunca repita tags. Nunca inclua a categoria como tag genérica se ela já for óbvia.",
      "- Não use hashtags, pontuação final, emojis, aspas ou números soltos.",
      "- Se a marca aparecer no nome (ex.: 'Prada'), gere a variação 'Prada Inspired' em vez do nome puro.",
    ].join("\n");

    const { output } = await generateText({
      model: gateway.chatModel("google/gemini-2.5-flash"),
      system,
      prompt: `Produto:\n${context}\n\nRetorne apenas o JSON com a lista de tags.`,
      output: Output.object({ schema: OutputSchema }),
      temperature: 0.4,
    });

    const raw = output?.tags ?? [];
    const tags = normalizeTags(raw).filter(
      (t) => !(data.existingTags ?? []).some((e) => e.toLowerCase() === t.toLowerCase()),
    );

    return { tags };
  });

/**
 * Sugestão de descrição + tags a partir da FOTO do produto (Sprint —
 * cadastro rápido). Mesmo padrão de visão já usado em
 * `parse-order-document.functions.ts` (leitura de pedidos por foto/PDF) —
 * mesmo modelo, mesmo gateway, nenhuma integração nova.
 */
const PhotoInput = z.object({
  dataUrl: z.string().min(1),
  name: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  existingTags: z.array(z.string()).optional().default([]),
});

const PhotoOutputSchema = z.object({
  description: z.string(),
  tags: z.array(z.string()).min(1).max(MAX_PRODUCT_TAGS),
});

/** Timeout de servidor — mesmo valor usado na leitura de pedidos por IA. */
const PHOTO_SUGGESTION_TIMEOUT_MS = 45_000;

export const suggestProductFromPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => PhotoInput.parse(v))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) {
      throw new Error("LOVABLE_API_KEY ausente. Configure a chave para gerar sugestões automáticas.");
    }
    if (!data.dataUrl.startsWith("data:")) {
      throw new Error("Imagem inválida — envie um arquivo de foto válido.");
    }

    const gateway = createLovableAiGatewayProvider(key);
    const context = [
      data.name ? `Nome: ${data.name}` : null,
      data.brand ? `Marca: ${data.brand}` : null,
      data.category ? `Categoria: ${data.category}` : null,
      data.existingTags.length
        ? `Tags já existentes (não repetir): ${data.existingTags.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");

    const system = [
      "Você é a Bella, assistente do NexOS especializada em catalogação de produtos de moda e varejo brasileiro.",
      "Olhe a foto do produto e gere duas coisas, só com base no que está visível na imagem:",
      "1. Uma descrição curta e vendável em português (1 a 2 frases), sem inventar características que não dá pra ver na foto.",
      "2. Entre 6 e 10 tags curtas (1 a 3 palavras, Primeira Letra Maiúscula) com atributos visíveis: cor, material aparente, formato, estilo, ocasião de uso.",
      "Regras estritas:",
      "- Não invente o que não está visível na imagem.",
      "- Nunca repita tags. Não use hashtags, pontuação final, emojis, aspas ou números soltos.",
      "- Se a marca aparecer no nome informado (ex.: 'Prada'), gere a variação 'Prada Inspired' em vez do nome puro.",
    ].join("\n");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PHOTO_SUGGESTION_TIMEOUT_MS);

    try {
      const { output } = await generateText({
        model: gateway.chatModel("google/gemini-2.5-flash"),
        system,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Produto:\n${context || "(sem informações adicionais)"}\n\nRetorne apenas o JSON com description e tags.`,
              },
              { type: "image", image: data.dataUrl },
            ],
          },
        ],
        temperature: 0.4,
        output: Output.object({ schema: PhotoOutputSchema }),
        abortSignal: controller.signal,
      });

      const tags = normalizeTags(output?.tags ?? []).filter(
        (t) => !data.existingTags.some((e) => e.toLowerCase() === t.toLowerCase()),
      );
      return { description: (output?.description ?? "").trim(), tags };
    } catch (err) {
      if (NoObjectGeneratedError.isInstance(err)) {
        try {
          const parsed = JSON.parse(err.text ?? "{}") as {
            description?: unknown;
            tags?: unknown;
          };
          const parsedTags = normalizeTags(
            Array.isArray(parsed.tags) ? parsed.tags : [],
          ).filter(
            (t) => !data.existingTags.some((e) => e.toLowerCase() === t.toLowerCase()),
          );
          return { description: String(parsed.description ?? "").trim(), tags: parsedTags };
        } catch {
          /* O erro genérico abaixo orienta a tentar novamente. */
        }
      }
      console.error("[suggestProductFromPhoto] falha na leitura por IA", err);
      const aborted =
        controller.signal.aborted ||
        (err instanceof Error && /abort|timeout/i.test(err.name + err.message));
      throw new Error(
        aborted
          ? "A leitura da foto demorou demais. Tente uma imagem menor ou mais nítida."
          : "Não foi possível analisar a foto agora. Tente novamente em instantes.",
      );
    } finally {
      clearTimeout(timer);
    }
  });
