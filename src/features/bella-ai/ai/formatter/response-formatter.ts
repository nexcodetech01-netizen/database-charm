/**
 * Response Formatter — traduz o output de cada Tool em `AIResponse.v1`.
 *
 * REGRAS:
 *   - Nunca calcula. Só lê chaves do DTO.
 *   - Nunca reconstrói explain(). Copia integralmente `summary` / `steps`
 *     vindos de `PricingEngine.explain()`.
 *   - Todo número citado é acompanhado por `source` (§9.3 do blueprint).
 */
import { RESPONSE_VERSION, type AIResponse, type AIWarning } from "../contracts";

const brl = (cents: number) =>
  `R$ ${(cents / 100).toFixed(2).replace(".", ",")}`;
const pct = (n: number) => `${n.toFixed(1)}%`;

interface FormatCtx {
  readonly traceId: string;
  readonly toolCall: string;
  readonly useCase: string;
}

function normalizeWarnings(
  raw: readonly { code: string; message: string }[] | undefined,
): AIWarning[] {
  if (!raw?.length) return [];
  const allow: readonly AIWarning["code"][] = [
    "missing_cost",
    "missing_policy",
    "stale_data",
    "low_confidence",
    "insufficient_context",
    "guardrail_triggered",
    "intent_not_supported",
    "tool_error",
  ];
  return raw.map((w) => ({
    code: allow.includes(w.code as AIWarning["code"])
      ? (w.code as AIWarning["code"])
      : "insufficient_context",
    message: w.message,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatters específicos (um por tool)
// ─────────────────────────────────────────────────────────────────────────────

export function formatDashboard(dto: any, ctx: FormatCtx): AIResponse {
  const health = dto?.health;
  const kpis = dto?.kpis;
  const opps: readonly any[] = dto?.opportunities ?? [];
  const summaryLines = [
    `Saúde comercial: ${health?.label ?? "—"} (${health?.stars ?? 0}★).`,
    kpis
      ? `${kpis.productsTotal ?? 0} produtos, ${kpis.productsWithSuggestion ?? 0} com sugestão pendente, ${kpis.productsBelowMargin ?? 0} abaixo da margem.`
      : "",
    opps.length ? `Oportunidades: ${opps.slice(0, 3).map((o) => o.title).join(" • ")}.` : "",
  ].filter(Boolean);

  return {
    version: RESPONSE_VERSION,
    summary: summaryLines.join(" "),
    confidence: "high",
    sources: [
      {
        kind: "usecase",
        useCase: ctx.useCase,
        toolCall: ctx.toolCall,
        traceId: ctx.traceId,
      },
    ],
    actions: opps.slice(0, 3).map((o, i) => ({
      id: `dashboard-opp-${i}`,
      label: o.actionLabel ?? "Abrir",
      intent: "navigate",
      payload: { href: o.actionHref },
      requiresApproval: false,
      scopes: ["commercial:read"],
    })),
    warnings: [],
    suggestedQuestions: [
      "Quais produtos estão abaixo da margem mínima?",
      "Quais categorias ainda não têm política própria?",
      "Quais foram as últimas decisões comerciais?",
    ],
    traceId: ctx.traceId,
  };
}

export function formatCompanyPolicy(dto: any, ctx: FormatCtx): AIResponse {
  const p = dto?.policy?.entity;
  const version = dto?.policy?.version;
  const stats = dto?.stats;
  const summary = p
    ? `Política vigente da empresa: margem mínima ${pct(p.minMarginPct)}, ideal ${pct(p.idealMarginPct)}, premium ${pct(p.premiumMarginPct)}. ${stats?.categoriesUsingPolicy ?? 0} categorias e ${stats?.productsOverriding ?? 0} produtos referenciam esta política. (v${version ?? "?"})`
    : "Nenhuma política comercial da empresa foi definida ainda.";
  return {
    version: RESPONSE_VERSION,
    summary,
    confidence: p ? "high" : "low",
    sources: [
      {
        kind: "usecase",
        useCase: ctx.useCase,
        toolCall: ctx.toolCall,
        traceId: ctx.traceId,
      },
    ],
    actions: [],
    warnings: p
      ? []
      : [
          {
            code: "missing_policy",
            message: "A empresa ainda não possui uma política comercial cadastrada.",
          },
        ],
    suggestedQuestions: [
      "Como estão as políticas por categoria?",
      "Quais produtos estão sem política própria?",
    ],
    traceId: ctx.traceId,
  };
}

export function formatCategoryPolicies(dto: any, ctx: FormatCtx): AIResponse {
  const rows: readonly any[] = dto?.rows ?? [];
  const withOwn = rows.filter((r) => r.policy).length;
  const inherited = rows.length - withOwn;
  const summary = rows.length
    ? `${rows.length} categorias no total — ${withOwn} com política própria e ${inherited} herdando da empresa.`
    : "Nenhuma categoria cadastrada.";
  return {
    version: RESPONSE_VERSION,
    summary,
    confidence: rows.length ? "high" : "low",
    sources: [
      {
        kind: "usecase",
        useCase: ctx.useCase,
        toolCall: ctx.toolCall,
        traceId: ctx.traceId,
      },
    ],
    actions: [],
    warnings: rows.length
      ? []
      : [
          {
            code: "insufficient_context",
            message: "Nenhuma categoria disponível para análise.",
          },
        ],
    suggestedQuestions: [
      "Quais categorias ainda estão sem política própria?",
      "Qual a política vigente da empresa?",
    ],
    traceId: ctx.traceId,
  };
}

export function formatProductExplain(dto: any, ctx: FormatCtx): AIResponse {
  const explainId: string = dto?.explainId ?? "";
  const summary = [
    `Produto ${dto?.product?.name ?? "?"}: preço recomendado ${brl(dto?.recommendedPriceCents ?? 0)} (margem estimada ${pct(dto?.estimatedMarginPct ?? 0)}).`,
    `Preço atual: ${brl(dto?.product?.currentPriceCents ?? 0)}, diferença ${brl(dto?.differenceCents ?? 0)}.`,
    `Fonte da política: ${dto?.originLabel ?? "—"}.`,
    dto?.summary ? `Motor: ${dto.summary}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    version: RESPONSE_VERSION,
    summary,
    confidence: "high",
    sources: [
      { kind: "pricing.explain", explainId, toolCall: ctx.toolCall },
      {
        kind: "usecase",
        useCase: ctx.useCase,
        toolCall: ctx.toolCall,
        traceId: ctx.traceId,
      },
    ],
    actions: [],
    warnings: normalizeWarnings(dto?.warnings),
    suggestedQuestions: [
      "Como esse preço foi calculado passo a passo?",
      "Qual seria o preço se eu usar margem premium?",
      "Quais produtos parecidos estão fora da margem?",
    ],
    traceId: ctx.traceId,
    engineVersions: {
      // Versionamento (ADR-008) — Pricing devolve `explainId` e `computedAt`;
      // demais versões são anexadas pelo caller do Orchestrator quando disponíveis.
      engineVersion: dto?.engineVersion ?? "pricing-engine",
      calculationVersion: dto?.calculationVersion ?? "pricing-calc",
      policyVersion: dto?.policyVersion ?? "policy",
      explainId,
    },
  };
}

export function formatSimulation(dto: any, ctx: FormatCtx): AIResponse {
  const explainId: string = dto?.explainId ?? "";
  const summary = [
    `Simulação (${dto?.strategyLabel ?? "—"}): preço final ${brl(dto?.finalPriceCents ?? 0)}, margem ${pct(dto?.marginPct ?? 0)}, markup ${pct(dto?.markupPct ?? 0)}.`,
    `Recomendado ${brl(dto?.recommendedPriceCents ?? 0)}, mínimo ${brl(dto?.minPriceCents ?? 0)}, premium ${brl(dto?.premiumPriceCents ?? 0)}.`,
    "Nenhum dado foi persistido — simulação read-only.",
  ].join(" ");
  return {
    version: RESPONSE_VERSION,
    summary,
    confidence: "high",
    sources: [
      { kind: "pricing.explain", explainId, toolCall: ctx.toolCall },
      {
        kind: "usecase",
        useCase: ctx.useCase,
        toolCall: ctx.toolCall,
        traceId: ctx.traceId,
      },
    ],
    actions: [],
    warnings: normalizeWarnings(dto?.warnings),
    suggestedQuestions: [
      "Como esse preço foi calculado?",
      "Qual seria o resultado com margem premium?",
      "E se o custo aumentar 10%?",
    ],
    traceId: ctx.traceId,
    engineVersions: {
      engineVersion: dto?.engineVersion ?? "pricing-engine",
      calculationVersion: dto?.calculationVersion ?? "pricing-calc",
      policyVersion: dto?.policyVersion ?? "policy",
      explainId,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Refusal / Fallback
// ─────────────────────────────────────────────────────────────────────────────

export function refusalIntentNotSupported(
  raw: string,
  traceId: string,
): AIResponse {
  return {
    version: RESPONSE_VERSION,
    summary:
      "Ainda não sei responder essa pergunta. Nesta fase eu só consulto o módulo Comercial (dashboard, políticas de empresa/categoria, explicação de preço e simulação).",
    confidence: "low",
    sources: [],
    actions: [],
    warnings: [
      {
        code: "intent_not_supported",
        message: `Nenhuma intent suportada corresponde à mensagem: "${raw}".`,
      },
    ],
    suggestedQuestions: [
      "Como está meu dashboard comercial?",
      "Qual a política comercial da empresa?",
      "Simular precificação de um produto",
    ],
    traceId,
  };
}

export function refusalMissingData(
  code: AIWarning["code"],
  detail: string,
  traceId: string,
): AIResponse {
  return {
    version: RESPONSE_VERSION,
    summary:
      "Não consigo responder sem mais dados. " +
      detail +
      " Assim que a informação estiver disponível eu consulto e retorno.",
    confidence: "low",
    sources: [],
    actions: [],
    warnings: [{ code, message: detail }],
    suggestedQuestions: [],
    traceId,
  };
}

export function refusalToolError(
  toolName: string,
  errorMessage: string,
  traceId: string,
): AIResponse {
  return {
    version: RESPONSE_VERSION,
    summary:
      "Consultei a Application Layer, mas a operação falhou. Nada foi alterado.",
    confidence: "low",
    sources: [],
    actions: [],
    warnings: [
      {
        code: "tool_error",
        message: `Falha na ferramenta ${toolName}: ${errorMessage}`,
      },
    ],
    suggestedQuestions: [],
    traceId,
  };
}
