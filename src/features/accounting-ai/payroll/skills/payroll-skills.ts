/**
 * Bella Contadora — Skills de Pró-Labore (Sprint 8.1).
 */
import { formatCurrency } from "@/lib/format";
import type { AccountingSkill, AccountingSkillResult } from "../../skills";
import { buildAccountingSummary } from "../../providers/summary";
import { buildFinancialAdvice } from "../../advisor/engine";
import { payrollQueries } from "../queries/payroll-queries";
import type { ProviderDeps } from "../../providers";

const empty = (what: string): AccountingSkillResult => ({
  ok: false,
  text: `Sem dados de ${what} para o período.`,
  data: null,
});

async function resolveAdvice(companyId: string, deps?: ProviderDeps) {
  const summary = deps?.summary ?? (await buildAccountingSummary(companyId, deps));
  return buildFinancialAdvice({ summary });
}


export const consultarProlaboreRecomendadoSkill: AccountingSkill = {
  id: "consultar_prolabore_recomendado",
  name: "Consultar pró-labore recomendado",
  description: "Explica o valor recomendado de pró-labore e o risco associado.",
  readOnly: true,
  async run(companyId, deps) {
    const advice = await resolveAdvice(companyId, deps);
    if (!advice.available) return empty("pró-labore");
    const query = payrollQueries.prolaboreSugerido(advice);
    return {
      ok: true,
      text: `${query.text} O risco financeiro para retiradas é ${advice.risk.label.toLowerCase()}.`,
      data: advice.payroll,
    };
  },
};

export const simularRetiradaSkill: AccountingSkill = {
  id: "simular_retirada",
  name: "Simular retirada",
  description: "Simula o impacto de uma retirada específica no caixa e reserva.",
  readOnly: true,
  async run(companyId, deps) {
    const amount = deps?.simulation?.targetRevenue ?? 0;
    const summary = deps?.summary ?? (await buildAccountingSummary(companyId, deps));
    const advice = buildFinancialAdvice({ summary, requestedAmount: amount });
    
    if (!advice.available) return empty("simulação");
    
    const head = advice.withdrawal.approved 
      ? "Simulação aprovada." 
      : advice.withdrawal.recommendation === "partial" 
        ? "Simulação com ressalvas." 
        : "Simulação não recomendada.";

    return {
      ok: true,
      text: `${head} Retirar ${formatCurrency(amount)} deixaria o caixa com ${formatCurrency(advice.availableCash - amount)}. Risco: ${advice.risk.label}.`,
      data: advice.withdrawal,
    };
  },
};

export const payrollSkills: AccountingSkill[] = [
  consultarProlaboreRecomendadoSkill,
  simularRetiradaSkill,
];
