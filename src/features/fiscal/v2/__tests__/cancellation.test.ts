import { describe, expect, it } from "vitest";
import {
  cancellationDeadline,
  evaluateCancelEligibility,
  validateCancelReason,
} from "../lib/cancellation";

const base = {
  status: "authorized",
  accessKey: "3".repeat(44),
  protocol: "135260000000001",
};

describe("cancellation rules", () => {
  it("permite cancelar dentro de 24h da autorização", () => {
    const r = evaluateCancelEligibility(
      { ...base, protocolAt: "2026-07-30T10:00:00Z" },
      new Date("2026-07-30T20:00:00Z"),
    );
    expect(r.allowed).toBe(true);
    expect(r.deadline).toBe("2026-07-31T10:00:00.000Z");
  });

  it("bloqueia fora do prazo legal", () => {
    const r = evaluateCancelEligibility(
      { ...base, protocolAt: "2026-07-29T10:00:00Z" },
      new Date("2026-07-30T20:00:00Z"),
    );
    expect(r.allowed).toBe(false);
    expect(r.reason).toContain("24 horas");
  });

  it("bloqueia nota já cancelada", () => {
    const r = evaluateCancelEligibility({ ...base, status: "cancelled" });
    expect(r.allowed).toBe(false);
  });

  it("bloqueia status não autorizado", () => {
    const r = evaluateCancelEligibility({ ...base, status: "rejected" });
    expect(r.allowed).toBe(false);
  });

  it("valida justificativa mínima de 15 caracteres", () => {
    expect(validateCancelReason("curto")).toContain("15");
    expect(validateCancelReason("Emissão em duplicidade do pedido")).toBeNull();
  });

  it("calcula deadline nulo sem data base", () => {
    expect(cancellationDeadline(null, null)).toBeNull();
  });
});
