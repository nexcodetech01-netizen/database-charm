import { describe, expect, it } from "vitest";
import {
  INTENT_REGISTRY,
  intentPriority,
  intentRegistryByPriority,
} from "../chat/intent-registry";
import { detectIntent } from "../chat/intent-engine";

describe("accounting-ai · intent registry (Sprint 7.2.1)", () => {
  it("é uma tabela declarativa com intent, priority e termos", () => {
    expect(INTENT_REGISTRY.length).toBeGreaterThan(30);
    for (const rule of INTENT_REGISTRY) {
      expect(typeof rule.intent).toBe("string");
      expect(Number.isFinite(rule.priority)).toBe(true);
      expect(rule.priority).toBeGreaterThan(0);
      expect(Array.isArray(rule.terms)).toBe(true);
      expect(rule.terms.length).toBeGreaterThan(0);
      for (const group of rule.terms) expect(group.length).toBeGreaterThan(0);
    }
  });

  it("expõe precedência explícita e ordenada", () => {
    const sorted = intentRegistryByPriority();
    expect(sorted).toHaveLength(INTENT_REGISTRY.length);
    for (let i = 1; i < sorted.length; i += 1) {
      expect(sorted[i - 1].priority).toBeGreaterThanOrEqual(sorted[i].priority);
    }
  });

  it("mantém a ordem de declaração em empates de prioridade (desempate estável)", () => {
    const sorted = intentRegistryByPriority();
    const byPriority = new Map<number, string[]>();
    for (const rule of sorted) {
      const list = byPriority.get(rule.priority) ?? [];
      list.push(rule.intent);
      byPriority.set(rule.priority, list);
    }
    for (const [priority, intents] of byPriority) {
      const declared = INTENT_REGISTRY.filter((r) => r.priority === priority).map(
        (r) => r.intent,
      );
      expect(intents).toEqual(declared);
    }
  });

  it("intentPriority devolve a prioridade declarada", () => {
    const first = INTENT_REGISTRY[0];
    expect(intentPriority(first.intent)).toBe(
      INTENT_REGISTRY.find((r) => r.intent === first.intent)?.priority,
    );
  });

  it("regras mais específicas continuam vencendo as genéricas", () => {
    expect(detectIntent("qual o lucro do mês?").intent).toBe("consultar_lucro");
    expect(detectIntent("quanto vou pagar de das?").intent).toBe("consultar_das");
    expect(detectIntent("auditar a empresa").intent).toBe("auditoria_geral");
  });
});
