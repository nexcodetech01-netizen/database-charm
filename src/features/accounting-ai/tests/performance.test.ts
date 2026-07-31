/**
 * Sprint 6.1.6 — Performance e hardening.
 * Garante que uma conversa com múltiplas skills agrega o resumo uma única vez,
 * que as derivações do store são memoizadas e que a query mantém dados anteriores.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { askBella } from "../chat";
import { getAccountingSkill } from "../skills";
import { buildAccountingSummary } from "../providers/summary";
import { bellaNotificationStore } from "../proactive";
import type { BellaNotification } from "../proactive";
import { accountingSummaryQueryOptions } from "../hooks/use-accounting-ai";
import { makeTestServices } from "./fixtures";
import type { AccountingAiServices } from "../services/ports";

const period = { start: "2026-01-01", end: "2026-01-31", label: "01/2026" };

/** Envolve todos os métodos das portas contando as chamadas realizadas. */
function countingServices(): { services: AccountingAiServices; calls: () => number } {
  const base = makeTestServices() as unknown as Record<string, Record<string, unknown>>;
  let calls = 0;
  const wrapped: Record<string, Record<string, unknown>> = {};
  for (const [group, methods] of Object.entries(base)) {
    const out: Record<string, unknown> = {};
    for (const [name, fn] of Object.entries(methods)) {
      out[name] = (...args: unknown[]) => {
        calls += 1;
        return (fn as (...a: unknown[]) => unknown)(...args);
      };
    }
    wrapped[group] = out;
  }
  return {
    services: wrapped as unknown as AccountingAiServices,
    calls: () => calls,
  };
}

describe("accounting-ai · P1 · summary único por pergunta", () => {
  it("uma agregação por pergunta, mesmo com plano multi-skill", async () => {
    const baseline = countingServices();
    await buildAccountingSummary("c1", { services: baseline.services, period });
    const single = baseline.calls();

    const conversation = countingServices();
    const answer = await askBella("como está minha empresa?", "c1", {
      deps: { services: conversation.services, period },
    });

    expect(answer.skills.length).toBeGreaterThan(1);
    expect(conversation.calls()).toBe(single);
  });

  it("skills não reconstroem o summary quando ele já vem em deps", async () => {
    const shared = await buildAccountingSummary("c1", {
      services: makeTestServices(),
      period,
    });
    const counter = countingServices();
    const deps = { services: counter.services, period, summary: shared };

    for (const id of [
      "consultar_lucro",
      "consultar_caixa",
      "consultar_insights",
      "consultar_retirada",
      "consultar_notificacoes",
      "consultar_receita",
    ] as const) {
      const skill = getAccountingSkill(id);
      expect(skill).toBeDefined();
      await skill!.run("c1", deps);
    }

    expect(counter.calls()).toBe(0);
  });

  it("mantém a mesma resposta com e sem summary compartilhado", async () => {
    const withShared = await askBella("qual foi o lucro do mês?", "c1", {
      deps: { services: makeTestServices(), period },
    });
    const skill = getAccountingSkill("consultar_lucro")!;
    const direct = await skill.run("c1", { services: makeTestServices(), period });
    expect(withShared.text).toContain(direct.text);
  });
});

function note(id: string, priority: number, severity: "critical" | "info"): BellaNotification {
  return {
    id,
    title: id,
    message: id,
    severity,
    category: "cash",
    priority,
    source: "test",
  } as unknown as BellaNotification;
}

describe("accounting-ai · P2/P3 · memoização do store", () => {
  beforeEach(() => bellaNotificationStore.reset());

  it("reaproveita a lista visível enquanto o estado não muda", () => {
    bellaNotificationStore.setNotifications([note("a", 90, "critical"), note("b", 10, "info")]);
    const first = bellaNotificationStore.visible();
    expect(bellaNotificationStore.visible()).toBe(first);
    expect(bellaNotificationStore.criticalCount()).toBe(1);
  });

  it("não altera o contador crítico quando muda apenas o não crítico", () => {
    bellaNotificationStore.setNotifications([note("a", 90, "critical"), note("b", 10, "info")]);
    const before = bellaNotificationStore.criticalCount();
    bellaNotificationStore.setNotifications([note("a", 90, "critical"), note("c", 10, "info")]);
    expect(bellaNotificationStore.criticalCount()).toBe(before);
  });

  it("recalcula ao dispensar uma notificação crítica", () => {
    bellaNotificationStore.setNotifications([note("a", 90, "critical")]);
    expect(bellaNotificationStore.criticalCount()).toBe(1);
    bellaNotificationStore.dismiss("a");
    expect(bellaNotificationStore.criticalCount()).toBe(0);
  });
});

describe("accounting-ai · P5 · opções de query", () => {
  it("mantém staleTime e adiciona placeholderData/gcTime", () => {
    const options = accountingSummaryQueryOptions("c1", period);
    expect(options.staleTime).toBe(60_000);
    expect(options.gcTime).toBe(15 * 60_000);
    expect(typeof options.placeholderData).toBe("function");
    const previous = { companyId: "c1" } as never;
    expect((options.placeholderData as (p: unknown) => unknown)(previous)).toBe(previous);
    expect(options.queryKey).toEqual([
      "accounting-ai",
      "summary",
      "c1",
      period.start,
      period.end,
    ]);
  });

  it("desabilita a consulta sem empresa", () => {
    expect(accountingSummaryQueryOptions(undefined).enabled).toBe(false);
  });
});
