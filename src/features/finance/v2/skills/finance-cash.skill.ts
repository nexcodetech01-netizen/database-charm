import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { CashFlowService } from "../service/cashflow.service";
import { financeCashSchema } from "../schemas";

export { financeCashSchema };

export const financeCashSkill = defineBaseSkill({
  id: "finance.cash",
  module: "finance",
  name: "Consultar caixa",
  description: "Retorna o saldo consolidado das contas ativas.",
  schema: financeCashSchema,
  requiredPermissions: ["finance.view"],
  destructive: false,
  async handler(_input, ctx) {
    const svc = new CashFlowService(ctx);
    const pos = await svc.position();
    const preview = pos.perAccount
      .slice(0, 5)
      .map((a) => `• ${a.name}: R$ ${a.balance.toFixed(2)}`)
      .join("\n");
    return skillResult.success(
      `Saldo total em caixa: R$ ${pos.totalBalance.toFixed(2)}\n${preview}`,
      pos,
    );
  },
});
