import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { FinancialReportsService } from "../service/financial-reports.service";
import { financeSummarySchema } from "../schemas";

export { financeSummarySchema };

export const financeSummarySkill = defineBaseSkill({
  id: "finance.summary",
  module: "finance",
  name: "Resumo financeiro",
  description: "KPIs financeiros consolidados: caixa, receber, pagar, vencidos e projeção 30d.",
  schema: financeSummarySchema,
  requiredPermissions: ["finance.view"],
  destructive: false,
  async handler(_input, ctx) {
    const svc = new FinancialReportsService(ctx);
    const s = await svc.summary();
    return skillResult.success(
      [
        `Caixa: R$ ${s.currentBalance.toFixed(2)}`,
        `A receber: R$ ${s.totalReceivable.toFixed(2)} (vencidos R$ ${s.receivableOverdue.toFixed(2)})`,
        `A pagar: R$ ${s.totalPayable.toFixed(2)} (vencidos R$ ${s.payableOverdue.toFixed(2)})`,
        `Recebimentos hoje: R$ ${s.receiptsToday.toFixed(2)}`,
        `Projeção 30d: R$ ${s.projected30d.toFixed(2)}`,
      ].join("\n"),
      s,
    );
  },
});
