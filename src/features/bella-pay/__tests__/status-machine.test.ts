import { describe, it, expect } from "vitest";
import {
  canTransition,
  isChargeStatus,
} from "../lib/status-machine";

describe("status-machine (P1-06)", () => {
  it("aceita transição inicial (from = null)", () => {
    expect(canTransition(null, "PENDING")).toBe(true);
    expect(canTransition(undefined, "RECEIVED")).toBe(true);
  });

  it("PENDING → CONFIRMED → RECEIVED é válido", () => {
    expect(canTransition("PENDING", "CONFIRMED")).toBe(true);
    expect(canTransition("CONFIRMED", "RECEIVED")).toBe(true);
  });

  it("RECEIVED → PENDING é recusado", () => {
    expect(canTransition("RECEIVED", "PENDING")).toBe(false);
  });

  it("CANCELED é terminal", () => {
    expect(canTransition("CANCELED", "PENDING")).toBe(false);
    expect(canTransition("CANCELED", "RECEIVED")).toBe(false);
  });

  it("REFUNDED é terminal", () => {
    expect(canTransition("REFUNDED", "RECEIVED")).toBe(false);
  });

  it("mesmo estado é idempotente (aceito)", () => {
    expect(canTransition("RECEIVED", "RECEIVED")).toBe(true);
  });

  it("RECEIVED → REFUNDED / CHARGEBACK permitido", () => {
    expect(canTransition("RECEIVED", "REFUNDED")).toBe(true);
    expect(canTransition("RECEIVED", "CHARGEBACK")).toBe(true);
  });

  it("OVERDUE → CONFIRMED / RECEIVED / CANCELED permitido", () => {
    expect(canTransition("OVERDUE", "CONFIRMED")).toBe(true);
    expect(canTransition("OVERDUE", "RECEIVED")).toBe(true);
    expect(canTransition("OVERDUE", "CANCELED")).toBe(true);
  });

  it("isChargeStatus valida corretamente", () => {
    expect(isChargeStatus("PENDING")).toBe(true);
    expect(isChargeStatus("FOO")).toBe(false);
    expect(isChargeStatus(null)).toBe(false);
    expect(isChargeStatus(42)).toBe(false);
  });
});
