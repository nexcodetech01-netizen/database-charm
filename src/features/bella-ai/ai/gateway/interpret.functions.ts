/**
 * Server function — interpretação via Lovable AI Gateway (Gemini).
 *
 * Recebe: mensagem, contexto e catálogo de Skills (metadados apenas).
 * Retorna: intent estruturada { intent, confidence, parameters, response }.
 *
 * Regras:
 *  - Nunca executa Skills nem toca no banco.
 *  - Nunca expõe LOVABLE_API_KEY ao cliente.
 *  - Falhas são traduzidas para um erro estruturado — o Gateway aplica
 *    fallback para Keyword Parser sem quebrar a UX.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  INTERPRET_SYSTEM_PROMPT,
  buildInterpretUserPrompt,
} from "../prompts/interpretPrompt";
import { integrationFetch } from "@/lib/http-client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const skillCatalogSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    module: z.string(),
    description: z.string(),
    requiresConfirmation: z.boolean(),
    parameters: z
      .array(
        z.object({
          name: z.string(),
          type: z.string(),
          required: z.boolean(),
          hint: z.string().optional(),
        }),
      )
      .default([]),
    examples: z.array(z.string()).optional(),
  }),
);


const inputSchema = z.object({
  message: z.string().min(1).max(4000),
  skills: skillCatalogSchema.max(200),
  context: z.record(z.string(), z.unknown()).optional().nullable(),
  companyName: z.string().optional().nullable(),
});

const MODEL = "google/gemini-3.5-flash";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 12_000;

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export interface InterpretResult {
  intent: string;
  confidence: number;
  parameters: Record<string, JsonValue>;
  response: string;
  telemetry: {
    provider: "gemini";
    model: string;
    latencyMs: number;
    tokensInput?: number;
    tokensOutput?: number;
  };
}


export const interpretWithGemini = createServerFn({ method: "POST" })
  // Hardening: endpoint consome créditos do LOVABLE_API_KEY — exige sessão.
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data }): Promise<InterpretResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY_MISSING");
    }

    const userPrompt = buildInterpretUserPrompt(
      data.message,
      data.skills,
      {
        ...(data.context ?? {}),
        ...(data.companyName ? { companyName: data.companyName } : {}),
      },
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    const startedAt = Date.now();

    let response: Response;
    try {
      response = await integrationFetch(
        GATEWAY_URL,
        {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: INTERPRET_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.2,
        }),
      },
      { integration: "lovable-ai:interpret", timeoutMs: DEFAULT_TIMEOUT_MS },
      );
    } catch (err) {
      clearTimeout(timeout);
      if ((err as Error).name === "AbortError") throw new Error("GEMINI_TIMEOUT");
      throw new Error(`GEMINI_NETWORK: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }

    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      // Log interno — não vaza ao usuário
      console.error("[bella.interpret] gateway error", {
        status: response.status,
        body: body.slice(0, 500),
      });
      if (response.status === 429) throw new Error("GEMINI_RATE_LIMITED");
      if (response.status === 402) throw new Error("GEMINI_NO_CREDITS");
      throw new Error(`GEMINI_HTTP_${response.status}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };

    const content = payload.choices?.[0]?.message?.content ?? "";
    const parsed = safeParseJson(content);
    if (!parsed) {
      console.error("[bella.interpret] invalid JSON from model", { content: content.slice(0, 300) });
      throw new Error("GEMINI_INVALID_RESPONSE");
    }

    const intent = typeof parsed.intent === "string" && parsed.intent.trim() ? parsed.intent.trim() : "unknown";
    const confidence = clamp01(Number(parsed.confidence ?? 0));
    const parameters: Record<string, JsonValue> =
      parsed.parameters && typeof parsed.parameters === "object" && !Array.isArray(parsed.parameters)
        ? (parsed.parameters as Record<string, JsonValue>)
        : {};

    const responseText = typeof parsed.response === "string" ? parsed.response : "";

    console.info("[bella.interpret] ok", {
      provider: "gemini",
      model: MODEL,
      latencyMs,
      intent,
      confidence,
      tokensInput: payload.usage?.prompt_tokens,
      tokensOutput: payload.usage?.completion_tokens,
    });

    return {
      intent,
      confidence,
      parameters,
      response: responseText,
      telemetry: {
        provider: "gemini",
        model: MODEL,
        latencyMs,
        tokensInput: payload.usage?.prompt_tokens,
        tokensOutput: payload.usage?.completion_tokens,
      },
    };
  });

function safeParseJson(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "");
  try {
    const value = JSON.parse(trimmed);
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
