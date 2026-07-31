import { describe, expect, it } from "vitest";
import {
  createContextResolver,
  createSessionMemory,
  DEFAULT_EXPIRATION,
  isExpired,
  resolveReference,
  type SessionMemoryClock,
} from "../ai";

function fakeClock(initial: string): SessionMemoryClock & {
  advance(ms: number): void;
} {
  let t = Date.parse(initial);
  return {
    nowIso: () => new Date(t).toISOString(),
    advance: (ms) => {
      t += ms;
    },
  };
}

describe("ReferenceResolver", () => {
  it.each([
    ["esse produto está caro?", "product"],
    ["essa bolsa vale a pena?", "product"],
    ["e essa categoria?", "category"],
    ["essa política ainda vale?", "policy"],
    ["mostra aquele dashboard", "dashboard"],
    ["repete a análise", "repeat"],
    ["aplica agora", "confirm"],
    ["confirma pra mim", "confirm"],
    ["cancelar", "cancel"],
    ["não quero mais", "cancel"],
    ["qual o clima hoje?", "none"],
    ["", "none"],
  ] as const)("resolve %s -> %s", (text, expected) => {
    expect(resolveReference(text)).toBe(expected);
  });

  it("cancel tem prioridade sobre substantivos", () => {
    expect(resolveReference("cancelar essa ação")).toBe("cancel");
  });
});

describe("SessionMemory expiration", () => {
  it("respeita TTL absoluto", () => {
    const clock = fakeClock("2026-07-14T10:00:00.000Z");
    const mem = createSessionMemory({ clock });
    mem.ensure({ sessionId: "s1", companyId: "c1" });
    clock.advance(DEFAULT_EXPIRATION.maxAgeMs + 1);
    expect(mem.get({ sessionId: "s1", companyId: "c1" })).toBeUndefined();
    expect(mem.size()).toBe(0);
  });

  it("respeita idle timeout", () => {
    const clock = fakeClock("2026-07-14T10:00:00.000Z");
    const mem = createSessionMemory({ clock });
    mem.remember(
      { sessionId: "s1", companyId: "c1" },
      { lastProduct: { id: "p1", at: clock.nowIso() } },
    );
    clock.advance(DEFAULT_EXPIRATION.maxIdleMs + 1);
    expect(mem.get({ sessionId: "s1", companyId: "c1" })).toBeUndefined();
  });

  it("sweep remove somente expirados", () => {
    const clock = fakeClock("2026-07-14T10:00:00.000Z");
    const mem = createSessionMemory({ clock });
    mem.ensure({ sessionId: "s1", companyId: "c1" });
    clock.advance(DEFAULT_EXPIRATION.maxIdleMs + 1);
    mem.ensure({ sessionId: "s2", companyId: "c1" });
    expect(mem.sweep()).toBe(1);
    expect(mem.size()).toBe(1);
  });

  it("isExpired helper é puro", () => {
    expect(
      isExpired(
        { createdAt: "2026-07-14T00:00:00.000Z", lastUsedAt: "2026-07-14T00:00:00.000Z" },
        "2026-07-14T01:00:00.000Z",
      ),
    ).toBe(true);
  });
});

describe("SessionMemory tenant isolation", () => {
  it("nunca devolve contexto de outra empresa e apaga a entrada", () => {
    const clock = fakeClock("2026-07-14T10:00:00.000Z");
    const mem = createSessionMemory({ clock });
    mem.remember(
      { sessionId: "s1", companyId: "cA" },
      { lastProduct: { id: "p1", at: clock.nowIso() } },
    );
    expect(mem.get({ sessionId: "s1", companyId: "cB" })).toBeUndefined();
    expect(mem.size()).toBe(0);
  });

  it("clearByCompany apaga somente daquela empresa", () => {
    const mem = createSessionMemory();
    mem.ensure({ sessionId: "sA", companyId: "cA" });
    mem.ensure({ sessionId: "sB", companyId: "cB" });
    expect(mem.clearByCompany("cA")).toBe(1);
    expect(mem.get({ sessionId: "sB", companyId: "cB" })).toBeDefined();
  });

  it("clearByUser apaga somente daquele usuário (logout)", () => {
    const mem = createSessionMemory();
    mem.ensure({ sessionId: "s1", companyId: "c1", userId: "u1" });
    mem.ensure({ sessionId: "s2", companyId: "c1", userId: "u2" });
    expect(mem.clearByUser("u1")).toBe(1);
    expect(mem.size()).toBe(1);
  });
});

describe("ContextResolver + guardrails", () => {
  const scope = { sessionId: "s1", companyId: "c1", userId: "u1" };

  it("resolve 'esse produto' a partir do lastProduct", () => {
    const mem = createSessionMemory();
    mem.remember(scope, {
      lastProduct: { id: "p1", label: "Bolsa A", at: "2026-07-14T00:00:00.000Z" },
    });
    const resolver = createContextResolver(mem);
    const out = resolver.resolve({ text: "explica esse produto", scope });
    expect(out.audit.contextResolved).toBe(true);
    expect(out.audit.referenceType).toBe("product");
    expect(out.enrichedSlots.productId).toBe("p1");
  });

  it("bloqueia 'aplica agora' após ação executada", () => {
    const mem = createSessionMemory();
    mem.remember(scope, {
      lastAction: {
        id: "applySuggestedPrice",
        proposalId: "prop-1",
        at: "2026-07-14T00:00:00.000Z",
        executed: false,
      },
    });
    mem.markActionExecuted(scope, "prop-1");
    const out = createContextResolver(mem).resolve({
      text: "aplica agora",
      scope,
    });
    expect(out.guard.ok).toBe(false);
    expect(out.guard.code).toBe("action_already_executed");
    expect(out.audit.contextResolved).toBe(false);
  });

  it("bloqueia 'aplica agora' sem ação em contexto", () => {
    const mem = createSessionMemory();
    mem.ensure(scope);
    const out = createContextResolver(mem).resolve({
      text: "aplica agora",
      scope,
    });
    expect(out.guard.code).toBe("no_action_in_context");
  });

  it("nunca devolve slots quando contexto é de outra empresa", () => {
    const mem = createSessionMemory();
    mem.remember(
      { sessionId: "s1", companyId: "cA" },
      { lastProduct: { id: "p1", at: "2026-07-14T00:00:00.000Z" } },
    );
    const out = createContextResolver(mem).resolve({
      text: "esse produto",
      scope: { sessionId: "s1", companyId: "cB" },
    });
    expect(out.audit.contextResolved).toBe(false);
    expect(out.enrichedSlots).toEqual({});
  });

  it("audit contém sessionId, referenceType e contextAgeMs", () => {
    const clock = fakeClock("2026-07-14T10:00:00.000Z");
    const mem = createSessionMemory({ clock });
    mem.remember(scope, {
      lastCategory: { id: "cat-1", at: clock.nowIso() },
    });
    clock.advance(60_000);
    const out = createContextResolver(mem).resolve({
      text: "essa categoria",
      scope,
    });
    expect(out.audit.sessionId).toBe("s1");
    expect(out.audit.referenceType).toBe("category");
    expect(out.audit.contextAgeMs).toBeGreaterThanOrEqual(60_000);
  });

  it("audit devolvido mesmo sem contexto (referenceType detectado)", () => {
    const out = createContextResolver(createSessionMemory()).resolve({
      text: "esse produto",
      scope,
    });
    expect(out.audit.referenceType).toBe("product");
    expect(out.audit.contextResolved).toBe(false);
    expect(out.audit.reason).toBe("no_context");
  });
});

describe("SessionMemory persistência (nenhuma)", () => {
  it("é 100% in-memory — nada é serializado fora do Map interno", () => {
    const mem = createSessionMemory();
    mem.ensure({ sessionId: "s1", companyId: "c1" });
    // Recriar a instância implica perda total do estado — invariante
    // do design (memória volátil).
    const mem2 = createSessionMemory();
    expect(mem2.get({ sessionId: "s1", companyId: "c1" })).toBeUndefined();
  });
});
