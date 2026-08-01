/**
 * Bella Contadora — Tributário: notificações proativas.
 *
 * Deriva notificações do `BellaTaxSnapshot` (motor oficial). Nenhum cálculo
 * tributário novo, nenhuma escrita.
 */
import { formatCurrency } from "@/lib/format";
import { computePriority, actionLabel } from "../proactive/helpers";
import type { BellaNotification, NotificationSeverity } from "../proactive";
import { daysToDue, formatCompetence, formatPct } from "./selectors";
import type { BellaTaxSnapshot } from "./types";

function make(
  id: string,
  severity: NotificationSeverity,
  title: string,
  message: string,
  recommendation: string,
  action: "programar_imposto" | "conferir_dados" | "acompanhar" | "revisar_preco",
  createdAt: string,
  magnitude?: number | null,
  persistent = false,
): BellaNotification {
  return {
    id,
    category: "fiscal",
    severity,
    title,
    message,
    recommendation,
    action: { id: action, label: actionLabel(action) },
    priority: computePriority(severity, magnitude ?? null),
    createdAt,
    dismissible: severity !== "critical",
    persistent,
  };
}

export interface TaxNotificationOptions {
  createdAt?: string;
  today?: Date;
}

/** Gatilhos tributários: DAS a vencer/vencido, teto e faixa. */
export function buildBellaTaxNotifications(
  snapshot: BellaTaxSnapshot | null,
  options: TaxNotificationOptions = {},
): BellaNotification[] {
  if (!snapshot) return [];
  const createdAt = options.createdAt ?? new Date().toISOString();
  const today = options.today ?? new Date();
  const list: BellaNotification[] = [];
  const days = daysToDue(snapshot.dueDate, today);
  const unpaid = snapshot.dasAmount > 0 && snapshot.dasStatus !== "paid";

  if (unpaid && days != null && days < 0) {
    list.push(
      make(
        "tax_das_vencido",
        "critical",
        "DAS vencido",
        `O DAS de ${formatCompetence(snapshot.competence)} (${formatCurrency(
          snapshot.dasAmount,
        )}) venceu há ${Math.abs(days)} dia(s).`,
        "Emita a guia atualizada e regularize o quanto antes.",
        "programar_imposto",
        createdAt,
        25,
        true,
      ),
    );
  } else if (unpaid && days != null && days <= 7) {
    list.push(
      make(
        "tax_das_a_vencer",
        "warning",
        "DAS perto do vencimento",
        `${formatCurrency(snapshot.dasAmount)} vencem em ${days} dia(s).`,
        "Reserve o valor no caixa antes do vencimento.",
        "programar_imposto",
        createdAt,
        12,
      ),
    );
  }

  if (snapshot.limitUsagePct >= 100) {
    list.push(
      make(
        "tax_teto_excedido",
        "critical",
        "Teto do Simples ultrapassado",
        `RBT12 em ${formatCurrency(snapshot.rbt12)} — ${formatPct(snapshot.limitUsagePct, 1)} do teto.`,
        "Procure a contabilidade para tratar o desenquadramento.",
        "conferir_dados",
        createdAt,
        30,
        true,
      ),
    );
  } else if (snapshot.limitUsagePct >= 80) {
    list.push(
      make(
        "tax_teto_proximo",
        "warning",
        "Faturamento perto do teto do Simples",
        `Você já usou ${formatPct(snapshot.limitUsagePct, 1)} do limite anual.`,
        "Planeje o crescimento considerando a troca de regime.",
        "acompanhar",
        createdAt,
        15,
      ),
    );
  }

  if (
    snapshot.bracketCeiling != null &&
    snapshot.distanceToNextBracket != null &&
    snapshot.distanceToNextBracket >= 0 &&
    snapshot.distanceToNextBracket <= snapshot.bracketCeiling * 0.05
  ) {
    list.push(
      make(
        "tax_faixa_proxima",
        "warning",
        "Mudança de faixa do Simples próxima",
        `Faltam ${formatCurrency(snapshot.distanceToNextBracket)} de RBT12 para a próxima faixa.`,
        "Revise preços e reserva de impostos antes da nova alíquota.",
        "revisar_preco",
        createdAt,
        10,
      ),
    );
  }

  return list;
}
