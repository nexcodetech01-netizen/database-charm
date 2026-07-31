/**
 * Application Layer — default adapters
 * ====================================
 * Adaptadores puros das portas para as implementações canônicas:
 *   - PricingEnginePort → engine.compute / engine.explain
 *   - PricingResolverPort → resolver.buildPricingContext
 *   - ClockPort → Date.now (o Core continua puro; a impureza vive AQUI)
 *   - IdGeneratorPort → contador + timestamp (opaco, ordenável)
 *   - HasherPort → FNV-1a determinístico (sem dependência de crypto)
 *
 * Consumidores podem substituir qualquer porta em testes.
 */
import { compute as engineCompute } from "../engine/compute";
import { explain as engineExplain } from "../engine/explain";
import { buildPricingContext } from "../resolver/pricing-context-factory";
import type {
  ClockPort,
  HasherPort,
  IdGeneratorPort,
  PricingEnginePort,
  PricingResolverPort,
} from "./ports";

export const defaultEngine: PricingEnginePort = {
  compute: (ctx) => engineCompute(ctx),
  explain: (result) => engineExplain(result),
};

export const defaultResolver: PricingResolverPort = {
  build: (input) => buildPricingContext(input),
};

export const systemClock: ClockPort = {
  nowIso: () => new Date().toISOString(),
};

/** Gera ids opacos e razoavelmente únicos, sem dependência de crypto. */
export function createIdGenerator(seed = 0): IdGeneratorPort {
  let n = seed;
  return {
    next(prefix?: string) {
      n += 1;
      const time = Date.now().toString(36);
      const suffix = n.toString(36).padStart(4, "0");
      const rand = Math.floor(Math.random() * 0xffff)
        .toString(36)
        .padStart(3, "0");
      return `${prefix ?? "id"}_${time}${suffix}${rand}`;
    },
  };
}

/** Stringify estável — chaves ordenadas em profundidade, sem ciclos. */
export function stableStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== "object") return v;
    if (seen.has(v as object)) return null;
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(walk);
    const rec = v as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(rec).sort()) out[k] = walk(rec[k]);
    return out;
  };
  return JSON.stringify(walk(value));
}

/** FNV-1a 64-bit variant, em hex — determinístico e livre de deps. */
export function fnv1aHex(input: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0xcbf29ce4;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x100000001b3 & 0xffffffff) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export const defaultHasher: HasherPort = {
  hash: (value) => fnv1aHex(stableStringify(value)),
};
