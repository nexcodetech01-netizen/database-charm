/**
 * Server function — interpretação via OpenAI.
 *
 * Segurança:
 * - Exige autenticação Supabase.
 * - userId e companyId são obtidos do contexto de autenticação.
 * - OPENAI_API_KEY acessada somente aqui.
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
    parameters: z.array(
      z.object({
        name: z.string(),
        type: z.string(),
        required: z.boolean(),
        hint: z.string().optional(),
      })
    ).default([]),
    examples: z.array(z.string()).optional(),
  })
);

const inputSchema = z.object({
  message: z.string().min(1).max(4000),
  skills: skillCatalogSchema.max(200),
  context: z.record(z.string(), z.unknown()).optional().nullable(),
  companyName: z.string().optional().nullable(),
});

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

export interface OpenAIInterpretResult {
  intent: string;
  confidence: number;
  parameters: Record<string, JsonValue>;
  response: string;
  telemetry: {
    provider: "openai";
    model: string;
    latencyMs: number;
    tokensInput?: number;
    tokensOutput?: number;
  };
}

const DEFAULT_MODEL = "gpt-5.6-luna";
const GATEWAY_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_TIMEOUT_MS = 15_000;

export const interpretWithOpenAI = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => inputSchema.parse(data))
  .handler(async ({ data, context }): Promise<OpenAIInterpretResult> => {
    // 1. Segurança: userId e companyId do contexto, nunca do input.
    // context.claims pode conter o org_id se configurado no Supabase Custom Claims
    const { userId, claims } = context;
    const companyId = (claims as any)?.company_id || (claims as any)?.org_id;

    if (!userId || !companyId) {
      console.error("[bella.interpret.openai] Missing userId or companyId in claims", { userId, claims });
      throw new Error("UNAUTHORIZED_CONTEXT");
    }

    // 2. Configurações
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("[bella.interpret.openai] OPENAI_API_KEY is missing");
      throw new Error("OPENAI_NOT_CONFIGURED");
    }

    const model = process.env.BELLA_OPENAI_MODEL || DEFAULT_MODEL;

    // 3. Montar Prompt (Auditando/Limpando contexto)
    const userPrompt = buildInterpretUserPrompt(
      data.message,
      data.skills,
      {
        ...(data.context ?? {}),
        companyId, // Garantir companyId injetado
        companyName: data.companyName ?? null,
      }
    );

    const startedAt = Date.now();

    try {
      const response = await integrationFetch(
        GATEWAY_URL,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "system", content: INTERPRET_SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
          }),
        },
        { 
          integration: "openai:interpret", 
          timeoutMs: DEFAULT_TIMEOUT_MS,
          retryNonIdempotent: false // Interpretação é segura para retry se falhar rede, mas POST geralmente não.
        }
      );

      const latencyMs = Date.now() - startedAt;

      if (!response.ok) {
        const errBody = await response.text().catch(() => "no_body");
        console.error("[bella.interpret.openai] API Error", { status: response.status, error: errBody });
        throw new Error(`OPENAI_HTTP_${response.status}`);
      }

      const payload = await response.json();
      const choice = payload.choices?.[0];
      const content = choice?.message?.content ?? "{}";
      const parsed = safeParseJson(content);

      if (!parsed) {
        throw new Error("OPENAI_INVALID_JSON");
      }

      const intent = typeof parsed.intent === "string" ? parsed.intent : "unknown";
      const confidence = typeof parsed.confidence === "number" ? parsed.confidence : 0;
      const parameters = (parsed.parameters && typeof parsed.parameters === "object") ? parsed.parameters as Record<string, JsonValue> : {};
      const responseText = typeof parsed.response === "string" ? parsed.response : "";

      const telemetry = {
        provider: "openai" as const,
        model: payload.model || model, // Usa o modelo real retornado pela API se disponível
        latencyMs: Date.now() - startedAt,
        tokensInput: payload.usage?.prompt_tokens,
        tokensOutput: payload.usage?.completion_tokens,
      };

      console.info("[bella.interpret.openai] success", {
        intent,
        confidence,
        telemetry,
        companyId
      });

      return {
        intent,
        confidence,
        parameters,
        response: responseText,
        telemetry
      };
    } catch (err) {
      console.error("[bella.interpret.openai] execution failed", err);
      throw err;
    }

  });

function safeParseJson(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
