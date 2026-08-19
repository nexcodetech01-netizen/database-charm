/**
 * Bella Contadora — Tributário: seletores e textos (camada pura).
 *
 * Nenhum imposto é recalculado: tudo aqui lê o `BellaTaxSnapshot` produzido
 * pelo motor oficial e o converte em métricas e frases.
 */
import { formatCurrency } from "@/lib/format";
import { SIMPLES_LIMIT } from "@/features/tax";
import { companyDayStartUtc, companyStartOfDay } from "@/lib/time/company-day";
import type {
  BellaTaxMetric,
  BellaTaxSimulation,
  BellaTaxSnapshot,
} from "./types";

const REGIME_LABELS: Record<string, string> = {
  simples_nacional: "Simples Nacional",
  lucro_presumido: "Lucro Presumido",
  lucro_real: "Lucro Real",
  mei: "MEI",
};

export function regimeLabel(regime: string | null | undefined): string {
  if (!regime) return "Não configurado";
  return REGIME_LABELS[regime] ?? regime;
}

export function formatPct(value: number | null | undefined, digits = 2): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value.toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}%`;
}

export function formatCompetence(competence: string): string {
  const [y, m] = competence.split("-");
  return y && m ? `${m}/${y}` : competence;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

const DAY_MS = 86_400_000;

/** Dias até o vencimento do DAS (negativo = vencido). */
export function daysToDue(
  dueDate: string | null | undefined,
  today = new Date(),
): number | null {
  if (!dueDate) return null;
  // FIX (2026-08-19): "T00:00:00Z" tratava a data de vencimento como
  // UTC, e "today" usava getters locais do servidor (não do fuso do
  // Brasil) — mesma classe de bug já corrigida em Relatórios/Painel
  // Executivo/Central de KPIs/Marketing. Perto da virada do dia (BRT),
  // isso podia mostrar o prazo de vencimento com 1 dia de diferença.
  const due = new Date(companyDayStartUtc(dueDate.slice(0, 10))).getTime();
  const ref = companyStartOfDay(today).getTime();
  if (!Number.isFinite(due)) return null;
  return Math.round((due - ref) / DAY_MS);
}

export function annexLabel(annex: string | null | undefined): string {
  return annex ? `Anexo ${annex}` : "Anexo não definido";
}

/** Métricas do bloco tributário do dashboard. */
export function taxMetrics(snapshot: BellaTaxSnapshot | null): BellaTaxMetric[] {
  if (!snapshot) return [];
  const dasHint =
    snapshot.dasSource === "apuracao"
      ? `Apurado · vence ${formatDate(snapshot.dueDate)}`
      : `Previsto · vence ${formatDate(snapshot.dueDate)}`;
  return [
    {
      id: "das",
      label: "DAS da competência",
      value: formatCurrency(snapshot.dasAmount),
      hint: dasHint,
      emphasis: true,
    },
    {
      id: "rbt12",
      label: "RBT12",
      value: formatCurrency(snapshot.rbt12),
      hint: `${formatPct(snapshot.limitUsagePct, 1)} do teto de ${formatCurrency(SIMPLES_LIMIT)}`,
    },
    {
      id: "faixa",
      label: "Faixa e anexo",
      value: snapshot.bracket ? `Faixa ${snapshot.bracket}` : "—",
      hint: `${annexLabel(snapshot.annex)} · ${regimeLabel(snapshot.regime)}`,
    },
    {
      id: "aliquota",
      label: "Alíquota efetiva",
      value: formatPct(snapshot.effectiveRate),
      hint: `Nominal ${formatPct(snapshot.nominalRate)} · dedução ${formatCurrency(snapshot.deduction)}`,
    },
    {
      id: "proxima_faixa",
      label: "Espaço na faixa",
      value:
        snapshot.distanceToNextBracket == null
          ? "Última faixa"
          : formatCurrency(Math.max(snapshot.distanceToNextBracket, 0)),
      hint:
        snapshot.bracketCeiling == null
          ? "Sem faixa superior no anexo"
          : `Teto da faixa ${formatCurrency(snapshot.bracketCeiling)}`,
    },
    {
      id: "media",
      label: "DAS médio (12m)",
      value: snapshot.averageTax == null ? "—" : formatCurrency(snapshot.averageTax),
      hint: `${snapshot.history.length} apurações lidas`,
    },
  ];
}

/** Frase-resumo do bloco tributário. */
export function taxHeadline(snapshot: BellaTaxSnapshot | null): string {
  if (!snapshot) return "Ainda não consigo ler o seu tributário.";
  if (!snapshot.annex && snapshot.regime !== "simples_nacional") {
    return `Regime atual: ${regimeLabel(snapshot.regime)}. Sem apuração do Simples para ${formatCompetence(snapshot.competence)}.`;
  }
  const verbo = snapshot.dasSource === "apuracao" ? "apurado" : "previsto";
  return `DAS ${verbo} de ${formatCurrency(snapshot.dasAmount)} para ${formatCompetence(
    snapshot.competence,
  )} — ${annexLabel(snapshot.annex)}, faixa ${snapshot.bracket ?? "—"}, alíquota efetiva ${formatPct(
    snapshot.effectiveRate,
  )}.`;
}

/* ───────────────── Respostas do chat (texto puro) ───────────────── */

export function describeDas(snapshot: BellaTaxSnapshot): string {
  const parts = [
    `${snapshot.dasSource === "apuracao" ? "DAS apurado" : "DAS previsto"} de ${formatCurrency(
      snapshot.dasAmount,
    )} para a competência ${formatCompetence(snapshot.competence)}.`,
    `Base: receita de ${formatCurrency(snapshot.monthRevenue)} com alíquota efetiva de ${formatPct(
      snapshot.effectiveRate,
    )}.`,
  ];
  if (snapshot.dueDate) {
    const days = daysToDue(snapshot.dueDate);
    const prazo =
      days == null
        ? ""
        : days < 0
          ? ` (vencido há ${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"})`
          : days === 0
            ? " (vence hoje)"
            : ` (faltam ${days} dia${days === 1 ? "" : "s"})`;
    parts.push(`Vencimento em ${formatDate(snapshot.dueDate)}${prazo}.`);
  }
  if (snapshot.dasStatus) parts.push(`Situação da apuração: ${snapshot.dasStatus}.`);
  return parts.join(" ");
}

export function describeRbt12(snapshot: BellaTaxSnapshot): string {
  return [
    `Seu RBT12 é de ${formatCurrency(snapshot.rbt12)}, ou seja, ${formatPct(
      snapshot.limitUsagePct,
      1,
    )} do teto de ${formatCurrency(SIMPLES_LIMIT)} do Simples Nacional.`,
    snapshot.distanceToNextBracket == null
      ? "Você já está na última faixa do anexo."
      : `Ainda cabem ${formatCurrency(Math.max(snapshot.distanceToNextBracket, 0))} antes de mudar de faixa.`,
  ].join(" ");
}

export function describeAnnex(snapshot: BellaTaxSnapshot): string {
  return `Regime ${regimeLabel(snapshot.regime)} · ${annexLabel(snapshot.annex)}. Esse enquadramento vem do seu perfil tributário oficial.`;
}

export function describeRate(snapshot: BellaTaxSnapshot): string {
  return `Alíquota efetiva de ${formatPct(snapshot.effectiveRate)} (nominal ${formatPct(
    snapshot.nominalRate,
  )} menos dedução de ${formatCurrency(snapshot.deduction)} sobre o RBT12 de ${formatCurrency(
    snapshot.rbt12,
  )}).`;
}

export function describeBracket(snapshot: BellaTaxSnapshot): string {
  const base = `Você está na faixa ${snapshot.bracket ?? "—"} do ${annexLabel(snapshot.annex)}.`;
  if (snapshot.bracketCeiling == null) return `${base} É a última faixa do anexo.`;
  return `${base} O teto da faixa é ${formatCurrency(snapshot.bracketCeiling)} e faltam ${formatCurrency(
    Math.max(snapshot.distanceToNextBracket ?? 0, 0),
  )} de RBT12 para subir.`;
}

export function describeDueDate(snapshot: BellaTaxSnapshot): string {
  if (!snapshot.dueDate) {
    return "Ainda não há data de vencimento definida — configure o dia de vencimento no perfil tributário.";
  }
  const days = daysToDue(snapshot.dueDate);
  const prazo =
    days == null
      ? ""
      : days < 0
        ? ` Está vencido há ${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"}.`
        : days === 0
          ? " Vence hoje."
          : ` Faltam ${days} dia${days === 1 ? "" : "s"}.`;
  return `O DAS de ${formatCompetence(snapshot.competence)} vence em ${formatDate(
    snapshot.dueDate,
  )}.${prazo}`;
}

export function describeSimulation(simulation: BellaTaxSimulation): string {
  if (simulation.scenarios.length === 0) {
    return "Não consegui montar cenários tributários agora.";
  }
  const lines = simulation.scenarios.map(
    (s) =>
      `• ${s.label}: receita ${formatCurrency(s.revenue)} → DAS ${formatCurrency(
        s.taxAmount,
      )} (${formatPct(s.effectiveRate)}${s.bracket ? `, faixa ${s.bracket}` : ""})`,
  );
  const header = `Simulação para ${formatCompetence(simulation.competence)} (${annexLabel(
    simulation.annex,
  )}):`;
  const footer: string[] = [];
  if (simulation.highlighted && simulation.taxDelta != null) {
    const delta = simulation.taxDelta;
    footer.push(
      delta >= 0
        ? `No cenário escolhido, o DAS sobe ${formatCurrency(delta)}.`
        : `No cenário escolhido, o DAS cai ${formatCurrency(Math.abs(delta))}.`,
    );
  }
  if (simulation.changesBracket) footer.push("Atenção: esse cenário muda a faixa do Simples.");
  return [header, ...lines, ...footer].join("\n");
}
