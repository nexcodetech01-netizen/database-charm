/**
 * Barrel — Skills v2 do módulo Financeiro (Sprint 006).
 */
export { financeCashSkill, financeCashSchema } from "./finance-cash.skill";
export { financeReceivablesSkill, financeReceivablesSchema } from "./finance-receivables.skill";
export { financePayablesSkill, financePayablesSchema } from "./finance-payables.skill";
export { financeForecastSkill, financeForecastSchema } from "./finance-forecast.skill";
export { financeProLaboreSkill, financeProLaboreSchema } from "./finance-prolabore.skill";
export { financeSummarySkill, financeSummarySchema } from "./finance-summary.skill";

import { financeCashSkill } from "./finance-cash.skill";
import { financeReceivablesSkill } from "./finance-receivables.skill";
import { financePayablesSkill } from "./finance-payables.skill";
import { financeForecastSkill } from "./finance-forecast.skill";
import { financeProLaboreSkill } from "./finance-prolabore.skill";
import { financeSummarySkill } from "./finance-summary.skill";

export const financeV2BaseSkills = [
  financeCashSkill,
  financeReceivablesSkill,
  financePayablesSkill,
  financeForecastSkill,
  financeProLaboreSkill,
  financeSummarySkill,
] as const;
