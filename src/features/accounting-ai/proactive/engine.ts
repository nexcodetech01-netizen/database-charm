/**
 * Bella Contadora — Proactive Engine (Sprint 5.5).
 *
 * Motor 100% puro: recebe dados já apurados e devolve `BellaNotification[]`
 * ordenadas por severidade e prioridade. Nunca cria dados, nunca estima e
 * nunca executa ação.
 */
import { filterDismissed, sortNotifications, countCritical } from "./helpers";
import { buildProactiveContext } from "./providers";
import { PROACTIVE_RULES, runRule } from "./rules";
import type {
  BellaNotification,
  ProactiveInput,
  ProactiveOptions,
} from "./types";

/** Gera as notificações proativas a partir das fontes existentes. */
export function buildBellaNotifications(
  input: ProactiveInput,
  options: ProactiveOptions = {},
): BellaNotification[] {
  const createdAt = options.now ?? new Date().toISOString();
  const ctx = buildProactiveContext(input, createdAt);
  if (!ctx) return [];

  const produced: BellaNotification[] = [];
  const seen = new Set<string>();
  for (const rule of PROACTIVE_RULES) {
    const notification = runRule(rule, ctx);
    if (!notification || seen.has(notification.id)) continue;
    seen.add(notification.id);
    produced.push(notification);
  }

  const visible = sortNotifications(filterDismissed(produced, options.dismissedIds));
  return typeof options.limit === "number" ? visible.slice(0, Math.max(0, options.limit)) : visible;
}

/** Top N notificações (padrão 5) — usado pelo card "Atenção da Bella". */
export function buildTopNotifications(
  input: ProactiveInput,
  options: ProactiveOptions = {},
): BellaNotification[] {
  return buildBellaNotifications(input, { ...options, limit: options.limit ?? 5 });
}

/** Quantidade de notificações críticas visíveis. */
export function countCriticalNotifications(
  input: ProactiveInput,
  options: ProactiveOptions = {},
): number {
  return countCritical(buildBellaNotifications(input, { ...options, limit: undefined }));
}
