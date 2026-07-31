/**
 * Bella IA — Prioridade de eventos
 *
 * Escala determinística usada pelo Registry para ordenar as prioridades
 * exibidas na Home. Independente da `severity` (visual) — a prioridade é
 * o eixo operacional: o que a Bella deve empurrar primeiro para o usuário.
 */

import type { BellaEventSeverity } from "./BellaEventTypes";

export const EventPriority = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
} as const;

export type EventPriority = (typeof EventPriority)[keyof typeof EventPriority];

const ORDER: Record<EventPriority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

/**
 * Comparador estilo `Array.sort`: prioridade maior primeiro.
 * `comparePriority("CRITICAL", "LOW")` → negativo (CRITICAL vem antes).
 */
export function comparePriority(a: EventPriority, b: EventPriority): number {
  return ORDER[b] - ORDER[a];
}

/**
 * Fallback determinístico quando o detector não informa `priority`.
 * Mantém a escala visual (severity) consistente com a operacional.
 */
export function priorityFromSeverity(severity: BellaEventSeverity): EventPriority {
  switch (severity) {
    case "critical":
      return EventPriority.CRITICAL;
    case "warning":
      return EventPriority.HIGH;
    case "success":
      return EventPriority.MEDIUM;
    case "info":
    default:
      return EventPriority.LOW;
  }
}
