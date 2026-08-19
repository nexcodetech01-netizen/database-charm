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
import { assertCompanyAccess } from "@/lib/company-resolver.server";

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
  .inputValidator((data: unknown) => {
    const parsed = inputSchema.parse(data);
    // Validação Zod: companyId deve vir no context e ser um UUID válido
    const companyId = (parsed.context as any)?.companyId;
    if (!companyId || typeof companyId !== 'string') {
      throw new Error("MISSING_COMPANY_CONTEXT");
    }
    z.string().uuid().parse(companyId);
    return parsed;
  })
  .handler(async ({ data, context }): Promise<OpenAIInterpretResult> => {
    // 1. Segurança: userId do contexto autenticado.
    const { userId, supabase } = context;
    const companyId = (data.context as any)?.companyId;

    if (!userId) {
      console.error("[bella.interpret.openai] Missing userId in authenticated context");
      throw new Error("UNAUTHORIZED_USER");
    }

    // Autorização real: Valida o vínculo do usuário com a empresa solicitada.
    // NÃO confia no companyId vindo dos claims (que não existem no NexOS) nem cegamente no input.
    try {
      await assertCompanyAccess(supabase, userId, companyId);
    } catch (err) {
      console.error("[bella.interpret.openai] Access denied for company", { userId, companyId });
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
        const errText = await response.text().catch(() => "no_body");
        let info: Record<string, any> = { status: response.status };
        
        try {
          const parsed = JSON.parse(errText);
          if (parsed.error) {
            info = { 
              ...info, 
              type: parsed.error.type,
              code: parsed.error.code,
              param: parsed.error.param,
              message: parsed.error.message
            };
          }
        } catch {
          info.message = errText;
        }

        console.error("[bella.interpret.openai] API Error", {
          ...info,
          model,
          endpoint: GATEWAY_URL,
          latency: Date.now() - startedAt
        });

        // Lançar um erro que contenha os dados seguros serializados
        const error = new Error("OPENAI_API_ERROR");
        (error as any).safeDetails = {
          status: info.status,
          type: info.type,
          code: info.code,
          param: info.param,
          message: info.message,
          model
        };
        throw error;
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
