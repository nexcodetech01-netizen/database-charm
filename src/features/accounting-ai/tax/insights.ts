/**
 * Bella Contadora — Tributário: insights determinísticos.
 *
 * Regras de leitura sobre números já produzidos pelo motor oficial.
 * Nenhum imposto é recalculado aqui.
 */
import { formatCurrency } from "@/lib/format";
import type { AccountingInsight, InsightActionId, InsightSeverity } from "../insights";
import { computePriority } from "../insights/helpers";
import { daysToDue, formatCompetence, formatPct } from "./selectors";
import type { BellaTaxSnapshot } from "./types";

const ACTION_LABELS: Record<string, string> = {
  programar_imposto: "Programar imposto",
  acompanhar: "Acompanhar",
  revisar_preco: "Revisar preço",
  conferir_dados: "Conferir dados",
};

function make(
  id: string,
  severity: InsightSeverity,
  title: string,
  description: string,
  recommendation: string,
  action: InsightActionId,
  createdAt: string,
  magnitude?: number | null,
): AccountingInsight {
  return {
    id,
    severity,
    category: "fiscal",
    title,
    description,
    recommendation,
    priority: computePriority(severity, magnitude ?? null),
    action: { id: action, label: ACTION_LABELS[action] ?? "Acompanhar" },
    sourceProvider: "taxes",
    createdAt,
  };
}

export interface TaxInsightOptions {
  createdAt?: string;
  today?: Date;
}

/** Insights tributários (teto do Simples, faixa, vencimento, variação). */
export function buildBellaTaxInsights(
  snapshot: BellaTaxSnapshot | null,
  options: TaxInsightOptions = {},
): AccountingInsight[] {
  if (!snapshot) return [];
  const createdAt = options.createdAt ?? new Date().toISOString();
  const today = options.today ?? new Date();
  const list: AccountingInsight[] = [];

  if (snapshot.limitUsagePct >= 100) {
    list.push(
      make(
        "tax_limite_excedido",
        "critical",
        "Teto do Simples ultrapassado",
        `Seu RBT12 já é ${formatPct(snapshot.limitUsagePct, 1)} do teto anual.`,
        "Fale com a contabilidade sobre desenquadramento e planeje o novo regime.",
        "acompanhar",
        createdAt,
        snapshot.limitUsagePct,
      ),
    );
  } else if (snapshot.limitUsagePct >= 80) {
    list.push(
      make(
        "tax_limite_proximo",
        "warning",
        "Receita perto do teto do Simples",
        `Você já usou ${formatPct(snapshot.limitUsagePct, 1)} do limite anual de faturamento.`,
        "Acompanhe o RBT12 mês a mês para não ser desenquadrado sem planejamento.",
        "acompanhar",
        createdAt,
        snapshot.limitUsagePct,
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
        "tax_mudanca_faixa",
        "warning",
        "Mudança de faixa próxima",
        `Faltam ${formatCurrency(snapshot.distanceToNextBracket)} de RBT12 para sair da faixa ${
          snapshot.bracket ?? "atual"
        }.`,
        "Antecipe o efeito da nova alíquota no preço e na reserva de impostos.",
        "revisar_preco",
        createdAt,
        5,
      ),
    );
  }

  const days = daysToDue(snapshot.dueDate, today);
  if (days != null && snapshot.dasAmount > 0 && snapshot.dasStatus !== "paid") {
    if (days < 0) {
      list.push(
        make(
          "tax_das_vencido",
          "critical",
          "DAS vencido",
          `O DAS de ${formatCompetence(snapshot.competence)} (${formatCurrency(
            snapshot.dasAmount,
          )}) venceu há ${Math.abs(days)} dia(s).`,
          "Regularize o pagamento para evitar multa e juros.",
          "acompanhar",
          createdAt,
          20,
        ),
      );
    } else if (days <= 5) {
      list.push(
        make(
          "tax_das_a_vencer",
          "warning",
          "DAS a vencer",
          `O DAS de ${formatCurrency(snapshot.dasAmount)} vence em ${days} dia(s).`,
          "Separe o valor no caixa antes da data de vencimento.",
          "acompanhar",
          createdAt,
          10,
        ),
      );
    }
  }

  if (snapshot.averageTax != null && snapshot.averageTax > 0 && snapshot.dasAmount > 0) {
    const deltaPct = ((snapshot.dasAmount - snapshot.averageTax) / snapshot.averageTax) * 100;
    if (deltaPct >= 20) {
      list.push(
        make(
          "tax_das_acima_media",
          "warning",
          "DAS acima da média",
          `O DAS da competência está ${formatPct(deltaPct, 1)} acima da média dos últimos meses.`,
          "Confira se houve pico de faturamento ou mudança de faixa.",
          "acompanhar",
          createdAt,
          deltaPct,
        ),
      );
    }
  }

  if (!snapshot.annex && snapshot.regime === "simples_nacional") {
    list.push(
      make(
        "tax_anexo_ausente",
        "warning",
        "Anexo do Simples não configurado",
        "Sem o anexo definido não consigo apurar faixa nem alíquota efetiva.",
        "Configure o anexo no perfil tributário da empresa.",
        "acompanhar",
        createdAt,
      ),
    );
  }

  return list.sort((a, b) => b.priority - a.priority);
}
