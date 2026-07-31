import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateText, Output } from "ai";
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
