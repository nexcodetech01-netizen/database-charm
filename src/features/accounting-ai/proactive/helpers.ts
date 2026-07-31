/**
 * Bella Contadora — helpers puros do Proactive Engine.
 * Sem IO, sem React, sem banco.
 */
import type {
  BellaNotification,
  NotificationActionId,
  NotificationCategory,
  NotificationGroup,
  NotificationIconName,
  NotificationSeverity,
} from "./types";

/** Ordem oficial: critical → warning → success → info. */
export const SEVERITY_ORDER: NotificationSeverity[] = [
  "critical",
  "warning",
  "success",
  "info",
];

/** Ordem estável das categorias. */
export const CATEGORY_ORDER: NotificationCategory[] = [
  "caixa",
  "financeiro",
  "receita",
  "lucro",
  "fiscal",
  "estoque",
  "produtos",
  "clientes",
  "sistema",
];

const SEVERITY_BASE: Record<NotificationSeverity, number> = {
  critical: 90,
  warning: 70,
  success: 40,
  info: 20,
};

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  financeiro: "Financeiro",
  caixa: "Caixa",
  estoque: "Estoque",
  clientes: "Clientes",
  produtos: "Produtos",
  fiscal: "Fiscal",
  receita: "Receita",
  lucro: "Lucro",
  sistema: "Sistema",
};

const SEVERITY_LABELS: Record<NotificationSeverity, string> = {
  critical: "Crítico",
  warning: "Atenção",
  success: "Positivo",
  info: "Informativo",
};

const ACTION_LABELS: Record<NotificationActionId, string> = {
  comprar_estoque: "Comprar estoque",
  cobrar_cliente: "Cobrar cliente",
  revisar_preco: "Revisar preço",
  reduzir_despesas: "Reduzir despesas",
  aumentar_divulgacao: "Aumentar divulgação",
  negociar_prazos: "Negociar prazos",
  reativar_cliente: "Reativar cliente",
  revisar_mix: "Revisar mix de produtos",
  manter_ritmo: "Manter o ritmo",
  acompanhar: "Acompanhar",
  revisar_retirada: "Revisar retirada",
  ajustar_prolabore: "Ajustar pró-labore",
  programar_imposto: "Programar imposto",
  conferir_dados: "Conferir dados",
};

const CATEGORY_ICONS: Record<NotificationCategory, NotificationIconName> = {
  financeiro: "wallet",
  caixa: "wallet",
  estoque: "boxes",
  clientes: "users",
  produtos: "package",
  fiscal: "receipt",
  receita: "trending-up",
  lucro: "percent",
  sistema: "info",
};

export function categoryLabel(category: NotificationCategory): string {
  return CATEGORY_LABELS[category];
}

export function severityLabel(severity: NotificationSeverity): string {
  return SEVERITY_LABELS[severity];
}

export function actionLabel(action: NotificationActionId): string {
  return ACTION_LABELS[action];
}

/** Peso da severidade (menor = mais urgente). */
export function severityRank(severity: NotificationSeverity): number {
  const idx = SEVERITY_ORDER.indexOf(severity);
  return idx === -1 ? SEVERITY_ORDER.length : idx;
}

/** Score de magnitude (0–10) de uma variação percentual. */
export function magnitudeScore(percent: number | null | undefined): number {
  if (percent == null || !Number.isFinite(percent)) return 0;
  return Math.round(Math.min(Math.abs(percent), 50) / 5);
}

/** Prioridade final: base da severidade + magnitude, limitada a 0–100. */
export function computePriority(
  severity: NotificationSeverity,
  magnitudePercent?: number | null,
): number {
  return Math.max(
    0,
    Math.min(100, SEVERITY_BASE[severity] + magnitudeScore(magnitudePercent)),
  );
}

/** Badge textual exibido na UI ("Crítico · 95"). */
export function notificationBadge(notification: BellaNotification): string {
  return `${severityLabel(notification.severity)} · ${notification.priority}`;
}

/** Ícone sugerido para a notificação. */
export function notificationIcon(
  notification: BellaNotification,
): NotificationIconName {
  if (notification.severity === "critical" || notification.severity === "warning") {
    if (notification.category === "receita" || notification.category === "lucro") {
      return "trending-down";
    }
    return "alert";
  }
  if (notification.severity === "success") return "check";
  return CATEGORY_ICONS[notification.category];
}

/** Ordena por severidade → prioridade (desc) → id. Não muta a entrada. */
export function sortNotifications(
  list: readonly BellaNotification[],
): BellaNotification[] {
  return [...list].sort((a, b) => {
    const bySeverity = severityRank(a.severity) - severityRank(b.severity);
    if (bySeverity !== 0) return bySeverity;
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.id.localeCompare(b.id);
  });
}

/** Agrupa por categoria respeitando `CATEGORY_ORDER`. */
export function groupNotifications(
  list: readonly BellaNotification[],
): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  for (const category of CATEGORY_ORDER) {
    const notifications = sortNotifications(list.filter((n) => n.category === category));
    if (notifications.length > 0) groups.push({ category, notifications });
  }
  return groups;
}

/** Remove as notificações fechadas na sessão (persistentes nunca somem). */
export function filterDismissed(
  list: readonly BellaNotification[],
  dismissedIds: readonly string[] = [],
): BellaNotification[] {
  if (dismissedIds.length === 0) return [...list];
  const dismissed = new Set(dismissedIds);
  return list.filter((n) => n.persistent || !dismissed.has(n.id));
}

/** Filtra por severidade e/ou categoria. */
export function filterNotifications(
  list: readonly BellaNotification[],
  filter: {
    severity?: NotificationSeverity | NotificationSeverity[];
    category?: NotificationCategory | NotificationCategory[];
  } = {},
): BellaNotification[] {
  const severities = filter.severity
    ? new Set(Array.isArray(filter.severity) ? filter.severity : [filter.severity])
    : null;
  const categories = filter.category
    ? new Set(Array.isArray(filter.category) ? filter.category : [filter.category])
    : null;
  return list.filter(
    (n) =>
      (!severities || severities.has(n.severity)) &&
      (!categories || categories.has(n.category)),
  );
}

/** Quantidade de notificações críticas. */
export function countCritical(list: readonly BellaNotification[]): number {
  return list.filter((n) => n.severity === "critical").length;
}

export interface MakeNotificationInput {
  id: string;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  message: string;
  recommendation: string;
  action: NotificationActionId;
  createdAt: string;
  magnitude?: number | null;
  dismissible?: boolean;
  persistent?: boolean;
}

/** Fábrica única de notificação (mantém prioridade e labels consistentes). */
export function makeNotification(input: MakeNotificationInput): BellaNotification {
  const persistent = input.persistent ?? input.severity === "critical";
  return {
    id: input.id,
    category: input.category,
    severity: input.severity,
    title: input.title,
    message: input.message,
    recommendation: input.recommendation,
    action: { id: input.action, label: actionLabel(input.action) },
    priority: computePriority(input.severity, input.magnitude),
    createdAt: input.createdAt,
    dismissible: input.dismissible ?? !persistent,
    persistent,
  };
}
