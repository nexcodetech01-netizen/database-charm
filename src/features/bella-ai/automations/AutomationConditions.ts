/**
 * AutomationConditions
 *
 * Avalia condições sobre o payload do evento. 100% pure — sem side-effects.
 * Nunca dispara Skills nem toca serviços; apenas decide se as ações devem
 * rodar. Isso permite testar independentemente do engine.
 */
import type { AutomationCondition, ConditionOperator } from "./types";

function readPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function compare(op: ConditionOperator, left: unknown, right: unknown): boolean {
  switch (op) {
    case "eq":
      return left === right;
    case "neq":
      return left !== right;
    case "gt":
      return typeof left === "number" && typeof right === "number" && left > right;
    case "gte":
      return typeof left === "number" && typeof right === "number" && left >= right;
    case "lt":
      return typeof left === "number" && typeof right === "number" && left < right;
    case "lte":
      return typeof left === "number" && typeof right === "number" && left <= right;
    case "in":
      return Array.isArray(right) && right.includes(left as never);
    case "contains":
      return typeof left === "string" && typeof right === "string" && left.includes(right);
    case "exists":
      return left !== undefined && left !== null;
  }
}

export const AutomationConditions = {
  /** true quando TODAS as condições passam (AND). Lista vazia → true. */
  evaluate(conditions: AutomationCondition[], payload: unknown): boolean {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every((c) => compare(c.operator, readPath(payload, c.path), c.value));
  },
  readPath,
};
