/**
 * BellaContextResolver
 *
 * Resolução de contexto conversacional baseada em palavras-chave
 * (sem IA). Detecta:
 *   1. Troca explícita de módulo ("e os clientes?", "e no estoque?").
 *   2. Continuações curtas que reutilizam a última Action
 *      ("e as vencidas?", "e agora?", "atualiza").
 *
 * O contrato é intencionalmente simples para permitir que, no futuro,
 * um LLM substitua o resolver sem alterar o engine ou os handlers.
 */
import type { BellaModuleKey } from "../providers/modules/base";
import type { BellaConversationContext } from "./types";

export interface ResolvedContext {
  /** Módulo sugerido para a próxima Action (pode diferir do contexto). */
  moduleHint?: BellaModuleKey;
  /** Se true, o engine deve tentar reutilizar `lastAction` do contexto. */
  continueLastAction: boolean;
  /** Palavras que dispararam a resolução (auditoria/telemetria). */
  matched: string[];
}

interface ModuleRule {
  module: BellaModuleKey;
  keywords: string[];
}

const MODULE_RULES: ModuleRule[] = [
  {
    module: "finance",
    keywords: [
      "financeiro",
      "financeira",
      "caixa",
      "saldo",
      "receita",
      "receitas",
      "despesa",
      "despesas",
      "vencida",
      "vencidas",
      "fluxo",
      "cashflow",
      "faturamento",
    ],
  },
  {
    module: "customer",
    keywords: [
      "cliente",
      "clientes",
      "crm",
      "consumidor",
      "consumidores",
      "comprador",
      "compradores",
    ],
  },
  {
    module: "sales",
    keywords: [
      "venda",
      "vendas",
      "pdv",
      "pedido",
      "pedidos",
      "ticket",
    ],
  },
  {
    module: "inventory",
    keywords: [
      "estoque",
      "inventario",
      "sku",
      "produto",
      "produtos",
      "ruptura",
    ],
  },
  {
    module: "marketing",
    keywords: [
      "marketing",
      "campanha",
      "campanhas",
      "catalogo",
      "whatsapp",
    ],
  },
];

/** Frases curtas típicas de continuação ("e as vencidas?", "e agora?"). */
const CONTINUATION_PREFIXES = ["e ", "e, ", "e? ", "e:"];
const CONTINUATION_TOKENS = new Set([
  "e",
  "agora",
  "tambem",
  "mais",
  "detalhes",
  "atualiza",
  "atualize",
  "novamente",
  "denovo",
]);

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim();
}

function tokenize(input: string): string[] {
  return normalize(input).split(/\s+/).filter(Boolean);
}

function detectModule(tokens: Set<string>): {
  module?: BellaModuleKey;
  matched: string[];
} {
  let best: { module: BellaModuleKey; matched: string[] } | null = null;
  for (const rule of MODULE_RULES) {
    const matched = rule.keywords.filter((k) => tokens.has(k));
    if (matched.length === 0) continue;
    if (!best || matched.length > best.matched.length) {
      best = { module: rule.module, matched };
    }
  }
  return best ?? { matched: [] };
}

function looksLikeContinuation(raw: string, tokens: string[]): boolean {
  const trimmed = raw.toLowerCase().trim();
  if (CONTINUATION_PREFIXES.some((p) => trimmed.startsWith(p))) return true;
  if (tokens.length <= 3 && tokens.some((t) => CONTINUATION_TOKENS.has(t))) {
    return true;
  }
  return false;
}

export interface BellaContextResolver {
  resolve(
    message: string,
    context: BellaConversationContext | undefined,
  ): ResolvedContext;
}

export const bellaContextResolver: BellaContextResolver = {
  resolve(message, context) {
    if (!message?.trim()) {
      return { continueLastAction: false, matched: [] };
    }
    const tokens = tokenize(message);
    const tokenSet = new Set(tokens);

    const { module: detectedModule, matched } = detectModule(tokenSet);
    const continuation = looksLikeContinuation(message, tokens);

    // Troca explícita de módulo.
    if (detectedModule) {
      return {
        moduleHint: detectedModule,
        continueLastAction: false,
        matched,
      };
    }

    // Continuação sem sinal de módulo → herda módulo do contexto.
    if (continuation && context?.lastModule) {
      return {
        moduleHint: context.lastModule,
        continueLastAction: !!context.lastAction,
        matched: ["__continuation__"],
      };
    }

    // Nenhum hint → deixa o parser decidir.
    return {
      moduleHint: context?.lastModule,
      continueLastAction: false,
      matched: [],
    };
  },
};

/** Mapa Action → módulo dono. Usado pelo engine para atualizar contexto. */
export const ACTION_MODULE_MAP = {
  GET_CASH_BALANCE: "finance",
  GET_MONTH_REVENUE: "finance",
  GET_MONTH_EXPENSES: "finance",
  GET_OVERDUE_BILLS: "finance",
  GET_CASHFLOW: "finance",
  GET_FINANCIAL_SUMMARY: "finance",
} as const satisfies Record<string, BellaModuleKey>;
