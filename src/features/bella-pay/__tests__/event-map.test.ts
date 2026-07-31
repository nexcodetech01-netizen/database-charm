import { describe, it, expect } from "vitest";
import { resolveEventAction, isKnownEvent } from "../lib/event-map";

describe("event-map (P1-05)", () => {
  it("mapeia todos os eventos oficiais", () => {
    const events = [
      "PAYMENT_CREATED",
      "PAYMENT_UPDATED",
      "PAYMENT_CONFIRMED",
      "PAYMENT_RECEIVED",
      "PAYMENT_OVERDUE",
      "PAYMENT_RESTORED",
      "PAYMENT_REFUNDED",
      "PAYMENT_DELETED",
      "PAYMENT_CHARGEBACK_REQUESTED",
      "PAYMENT_DUNNING_RECEIVED",
    ];
    for (const e of events) {
      expect(isKnownEvent(e)).toBe(true);
      expect(resolveEventAction(e).ignore).not.toBe(true);
    }
  });

  it("PAYMENT_RECEIVED aciona baixa financeira", () => {
    const a = resolveEventAction("PAYMENT_RECEIVED");
    expect(a.settleFinance).toBe(true);
    expect(a.status).toBe("RECEIVED");
    expect(a.markPaid).toBe(true);
  });

  it("PAYMENT_DELETED marca cancelamento", () => {
    const a = resolveEventAction("PAYMENT_DELETED");
    expect(a.markCanceled).toBe(true);
    expect(a.status).toBe("CANCELED");
  });

  it("PAYMENT_REFUNDED marca cancelamento", () => {
    const a = resolveEventAction("PAYMENT_REFUNDED");
    expect(a.markCanceled).toBe(true);
    expect(a.status).toBe("REFUNDED");
  });

  it("evento desconhecido → ignore", () => {
    expect(isKnownEvent("PAYMENT_FOO")).toBe(false);
    expect(resolveEventAction("PAYMENT_FOO").ignore).toBe(true);
  });

  it("PAYMENT_UPDATED não força status", () => {
    const a = resolveEventAction("PAYMENT_UPDATED");
    expect(a.status).toBeUndefined();
    expect(a.settleFinance).toBeUndefined();
  });
});
