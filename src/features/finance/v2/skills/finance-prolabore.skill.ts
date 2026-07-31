import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { FinancialReportsService } from "../service/financial-reports.service";
import { financeProLaboreSchema } from "../schemas";

export { financeProLaboreSchema };

export const financeProLaboreSkill = defineBaseSkill({
  id: "finance.prolabore",
  module: "finance",
  name: "Recomendação de pró-labore",
  description: "Sugere um teto prudente de pró-labore com reserva de segurança.",
  schema: financeProLaboreSchema,
  // Dado sensível ao sócio: exige reports.view (mesma barra usada em margens).
  requiredPermissions: ["reports.view"],
  destructive: false,
  async handler(input, ctx) {
    const svc = new FinancialReportsService(ctx);
    const rec = await svc.proLabore(input.reserveMonths ?? 3);
    return skillResult.success(
      `Sugestão máxima: R$ ${rec.suggestedMax.toFixed(2)} · Líquido do mês: R$ ${rec.netMonth.toFixed(2)} · Reserva: R$ ${rec.reserveTarget.toFixed(2)}. ${rec.reason}`,
      rec,
    );
  },
});
