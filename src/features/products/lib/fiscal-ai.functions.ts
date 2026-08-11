import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { integrationFetch } from "@/lib/http-client.server";

const inputSchema = z.object({
  productName: z.string().min(1),
  categoryName: z.string().optional().nullable(),
});

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.0-flash-exp";

export const suggestFiscalCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY_MISSING");

    const systemPrompt = `Você é um especialista em classificação fiscal brasileira (NCM e CEST).
Dada a descrição de um produto e sua categoria, sugira o NCM (8 dígitos) e o CEST (7 dígitos) mais prováveis.
Responda APENAS em JSON com o formato: {"ncm": "88888888", "cest": "7777777", "explanation": "breve motivo"}`;

    const userPrompt = `Produto: ${data.productName}${data.categoryName ? `\nCategoria: ${data.categoryName}` : ""}`;

    const response = await integrationFetch(
      GATEWAY_URL,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        }),
      },
      { integration: "lovable-ai:suggest-fiscal", timeoutMs: 10000 }
    );

    if (!response.ok) {
      throw new Error(`AI_GATEWAY_ERROR: ${response.status}`);
    }

    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content || "{}";
    
    try {
      return JSON.parse(content) as { ncm: string; cest: string; explanation: string };
    } catch {
      throw new Error("INVALID_AI_RESPONSE");
    }
  });
