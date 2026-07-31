/**
 * Intent Router — determinístico (Fase 1).
 *
 * Regras:
 *   - regex + keyword + slot extractor.
 *   - Sem chamada a LLM nesta fase (fallback fica para AI-002 futuro).
 *   - Confiança calculada por match. Se nenhum padrão bate → intent = unknown.
 *
 * Toda alteração aqui é testável via `router.test.ts` e reflete o catálogo
 * §4.3 do blueprint restrito às 5 intents commercial do escopo.
 */
import {
  INTENT_VERSION,
  type AIIntent,
  type SupportedIntent,
} from "../contracts";

interface IntentRule {
  readonly intent: SupportedIntent;
  readonly action: string;
  readonly patterns: readonly RegExp[];
  /** Extrai slots do texto normalizado (retorno é mesclado). */
  extractSlots?(text: string, match: RegExpMatchArray): Record<string, unknown>;
  readonly confidence: number;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();

// UUID v4-ish (permissivo — apenas para detectar id em slot).
const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

const RULES: readonly IntentRule[] = [
  // commercial.dashboard
  {
    intent: "commercial.dashboard",
    action: "get_commercial_dashboard",
    patterns: [
      /\bdashboard( comercial)?\b/,
      /\bsaude comercial\b/,
      /\bcomo (esta|vai) (o|meu) comercial\b/,
      /\boportunidades? comercia(l|is)\b/,
      /\bo que preciso fazer hoje\b/,
    ],
    confidence: 0.9,
  },
  // commercial.company
  {
    intent: "commercial.company",
    action: "get_company_policy",
    patterns: [
      /\bpolitica (comercial )?da empresa\b/,
      /\bpolitica da minha empresa\b/,
      /\bmargem (padrao|da empresa|minima|ideal|premium) da empresa\b/,
      /\bcompany policy\b/,
    ],
    confidence: 0.9,
  },
  // commercial.category
  {
    intent: "commercial.category",
    action: "get_category_policies",
    patterns: [
      /\bpoliticas? (de|das|por) categoria(s)?\b/,
      /\bcategorias? comercia(l|is)\b/,
      /\bmargem (da|por) categoria\b/,
    ],
    confidence: 0.9,
  },
  // commercial.product.explain
  {
    intent: "commercial.product.explain",
    action: "explain_product_price",
    patterns: [
      /\bpor que (esse|este|o) preco\b/,
      /\bcomo (esse|este|o) preco (foi )?calculad[oa]\b/,
      /\bexplique? (o|esse) preco\b/,
      /\bexplicacao (do|deste|desse) preco\b/,
      /\bpreco (sugerido|recomendado) (do|para) produto\b/,
      /\bproduto\s+([0-9a-f-]{8,})\b/, // "produto <uuid>"
    ],
    extractSlots(text) {
      const m = text.match(UUID_RE);
      return m ? { productId: m[0] } : {};
    },
    confidence: 0.85,
  },
  // commercial.pricing.simulate
  {
    intent: "commercial.pricing.simulate",
    action: "simulate_pricing",
    patterns: [
      /\bsimul(ar|ador|acao) (de )?preco\b/,
      /\bsimular precificacao\b/,
      /\bteste de preco\b/,
      /\bcalcular preco (com|para) custo\b/,
    ],
    confidence: 0.85,
  },
];

export interface IntentRouter {
  detect(raw: string): AIIntent;
}

export function createIntentRouter(): IntentRouter {
  return {
    detect(raw: string): AIIntent {
      const text = norm(raw ?? "");
      if (!text) {
        return {
          version: INTENT_VERSION,
          intent: "unknown",
          domain: "unknown",
          action: "noop",
          slots: {},
          confidence: 0,
          source: "deterministic",
          raw,
        };
      }

      for (const rule of RULES) {
        for (const p of rule.patterns) {
          const m = text.match(p);
          if (m) {
            const slots = rule.extractSlots?.(text, m) ?? {};
            return {
              version: INTENT_VERSION,
              intent: rule.intent,
              domain: "commercial",
              action: rule.action,
              slots,
              confidence: rule.confidence,
              source: "deterministic",
              raw,
            };
          }
        }
      }

      return {
        version: INTENT_VERSION,
        intent: "unknown",
        domain: "unknown",
        action: "noop",
        slots: {},
        confidence: 0,
        source: "deterministic",
        raw,
      };
    },
  };
}

export const defaultIntentRouter = createIntentRouter();
