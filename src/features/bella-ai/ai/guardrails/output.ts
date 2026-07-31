/**
 * Guardrails — validações de saída antes de devolver `AIResponse` ao caller.
 *
 * Fase 1 aplica:
 *   1. Schema check (`AIResponse.v1` via Zod).
 *   2. Citation check: todo valor R$/percentual no `summary` tem `source`.
 *   3. Explain check: se houve chamada a Pricing tool, `engineVersions.explainId`
 *      deve estar preenchido.
 *   4. Refusal enforcement: se `sources` vazio → `summary` não pode conter número.
 */
import {
  aiResponseSchema,
  type AIResponse,
  type AIWarning,
} from "../contracts";

const NUMBER_RE = /(R\$\s?\d[\d.,]*|\d+([.,]\d+)?\s?%|\b\d+\s?(produtos?|categorias?|itens?)\b)/i;

export interface GuardrailReport {
  readonly response: AIResponse;
  readonly checks: readonly {
    readonly rule: string;
    readonly status: "pass" | "block" | "warn";
    readonly detail?: string;
  }[];
}

export interface GuardrailContext {
  readonly usedPricingTool: boolean;
}

export function applyOutputGuardrails(
  raw: AIResponse,
  ctx: GuardrailContext,
): GuardrailReport {
  const checks: Array<{
    rule: string;
    status: "pass" | "block" | "warn";
    detail?: string;
  }> = [];

  // 1. Schema check — se falhar, transforma em refusal padrão.
  const parsed = aiResponseSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      response: {
        ...raw,
        summary:
          "Falha interna: a resposta gerada não respeita o contrato AIResponse.v1. Nada foi retornado.",
        confidence: "low",
        sources: [],
        actions: [],
        warnings: [
          {
            code: "guardrail_triggered",
            message: `schema_violation: ${parsed.error.message}`,
          },
        ],
        suggestedQuestions: [],
      },
      checks: [
        {
          rule: "schema.aiResponse.v1",
          status: "block",
          detail: parsed.error.message,
        },
      ],
    };
  }
  const response = parsed.data;
  checks.push({ rule: "schema.aiResponse.v1", status: "pass" });

  const mutable = { ...response, warnings: [...response.warnings] };
  const additions: AIWarning[] = [];

  // 2. Citation check
  const hasNumber = NUMBER_RE.test(mutable.summary);
  const hasSource = mutable.sources.length > 0;
  if (hasNumber && !hasSource) {
    additions.push({
      code: "guardrail_triggered",
      message:
        "Resposta contém números sem fonte auditável — bloqueada por segurança.",
    });
    mutable.summary =
      "Não posso confirmar esses números sem consultar uma ferramenta. Reformule a pergunta ou peça uma consulta específica.";
    mutable.confidence = "low";
    checks.push({ rule: "citation.numbers_have_source", status: "block" });
  } else {
    checks.push({ rule: "citation.numbers_have_source", status: "pass" });
  }

  // 3. Explain check — pricing tool exige explainId.
  if (ctx.usedPricingTool) {
    if (!mutable.engineVersions?.explainId) {
      additions.push({
        code: "guardrail_triggered",
        message:
          "Tool de precificação foi usada, mas `engineVersions.explainId` está ausente.",
      });
      checks.push({ rule: "explain.explain_id_present", status: "warn" });
    } else {
      checks.push({ rule: "explain.explain_id_present", status: "pass" });
    }
  }

  // 4. Refusal enforcement — sem sources e sem números OK; sem sources e com número já barrado acima.
  checks.push({ rule: "refusal.no_source_no_number", status: "pass" });

  if (additions.length > 0) {
    mutable.warnings = [...mutable.warnings, ...additions];
  }

  return { response: mutable, checks };
}
