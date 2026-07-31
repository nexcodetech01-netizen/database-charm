import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { CashFlowService } from "../service/cashflow.service";
import { financeForecastSchema } from "../schemas";

export { financeForecastSchema };

export const financeForecastSkill = defineBaseSkill({
  id: "finance.forecast",
  module: "finance",
  name: "Projeção de caixa",
  description: "Projeta o saldo com base nas contas a receber e a pagar em aberto.",
  schema: financeForecastSchema,
  requiredPermissions: ["reports.view"],
  destructive: false,
  async handler(input, ctx) {
    const svc = new CashFlowService(ctx);
    const h = input.horizonDays ?? 30;
    const proj = await svc.forecast(h);
    return skillResult.success(
      `Saldo hoje R$ ${proj.startingBalance.toFixed(2)} · Entradas R$ ${proj.totalInflow.toFixed(2)} · Saídas R$ ${proj.totalOutflow.toFixed(2)} · Projeção ${h}d: R$ ${proj.endingBalance.toFixed(2)}.`,
      proj,
    );
  },
});
