/**
 * Intent Engine — 100% puro e determinístico.
 * Apenas identifica a intenção; não executa nada e não calcula nada.
 */
import type { BellaIntentId, ChatContextState, IntentMatch } from "./types";
import { intentRegistryByPriority, type IntentRule } from "./intent-registry";

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const NUMBER_WORDS: Record<string, number> = {
  um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6,
  sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, quinze: 15,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60,
  setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100,
  duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500,
  seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900,
};

/** Extrai um valor monetário citado ("5000", "R$ 5.000,00", "cinco mil"). */
export function extractAmount(raw: string): number | null {
  const text = normalize(raw);

  const digits = text.match(/\d[\d.]*(?:,\d{1,2})?/g);
  if (digits && digits.length > 0) {
    for (const token of digits) {
      const value = Number(token.replace(/\./g, "").replace(",", "."));
      if (!Number.isFinite(value) || value <= 0) continue;
      const scaled = /\bmil\b/.test(text) && value < 1000 ? value * 1000 : value;
      return scaled;
    }
  }

  const words = text.split(" ");
  let total = 0;
  let current = 0;
  let found = false;
  for (const word of words) {
    if (word === "mil") {
      total += (current === 0 ? 1 : current) * 1000;
      current = 0;
      found = true;
      continue;
    }
    if (word === "e") continue;
    const value = NUMBER_WORDS[word];
    if (value === undefined) {
      if (found && current === 0) break;
      continue;
    }
    current += value;
    found = true;
  }
  const amount = total + current;
  return found && amount > 0 ? amount : null;
}

const RULES = intentRegistryByPriority();


/** Perguntas de seguimento sem sujeito próprio ("e agora?", "e daí?"). */
const FOLLOW_UP_ONLY = /^(e|entao|ok|certo|mas|sim)?\s*(ai|agora|dai|entao|isso|e ai)?\s*[.?!]*$/;

/** Extrai um crescimento percentual citado ("crescer 20%", "20 por cento"). */
export function extractGrowthPct(raw: string): number | null {
  const text = `${normalize(raw)} | ${raw.toLowerCase()}`;
  const match = text.match(/(-?\d+(?:[.,]\d+)?)\s*(?:%|por cento|porcento)/);
  if (!match?.[1]) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export interface DetectIntentOptions {
  context?: ChatContextState | null;
}

export function detectIntent(raw: string, options: DetectIntentOptions = {}): IntentMatch {
  const text = normalize(raw);
  const amount = extractAmount(raw);
  const growthPct = extractGrowthPct(raw);
  const context = options.context ?? null;

  if (!text) {
    return { intent: "desconhecida", confidence: 0, matched: [], amount: null, fromContext: false };
  }

  let best: { rule: IntentRule; matched: string[]; score: number } | null = null;

  for (const rule of RULES) {
    const matched: string[] = [];
    let groupsHit = 0;
    for (const group of rule.terms) {
      const hit = group.find((term) => text.includes(term));
      if (hit) {
        matched.push(hit);
        groupsHit += 1;
      }
    }
    if (groupsHit !== rule.terms.length) continue;
    const longest = matched.reduce((acc, t) => Math.max(acc, t.length), 0);
    const score = rule.priority * 100 + longest;
    if (!best || score > best.score) best = { rule, matched, score };
  }

  if (best) {
    const confidence = Math.min(1, 0.5 + best.matched.join(" ").length / 40);
    return {
      intent: best.rule.intent,
      confidence: Number(confidence.toFixed(2)),
      matched: best.matched,
      amount,
      growthPct,
      fromContext: false,
    };
  }

  // Seguimento de conversa: reaproveita a última intenção conhecida.
  if (context?.lastIntent && FOLLOW_UP_ONLY.test(text)) {
    return {
      intent: context.lastIntent,
      confidence: 0.4,
      matched: [],
      amount: amount ?? context.lastAmount,
      growthPct,
      fromContext: true,
    };
  }

  return { intent: "desconhecida", confidence: 0, matched: [], amount, growthPct, fromContext: false };
}
