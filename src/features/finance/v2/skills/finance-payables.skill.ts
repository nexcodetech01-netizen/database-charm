import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { AccountsPayableService } from "../service/accounts-payable.service";
import { financePayablesSchema } from "../schemas";

export { financePayablesSchema };

export const financePayablesSkill = defineBaseSkill({
  id: "finance.payables",
  module: "finance",
  name: "Contas a pagar",
  description: "Lista contas a pagar (pendentes/vencidas/pagas) com filtros.",
  schema: financePayablesSchema,
  requiredPermissions: ["finance.view"],
  destructive: false,
  async handler(input, ctx) {
    const svc = new AccountsPayableService(ctx);
    const rows = await svc.list({
      status: input.status,
      supplierId: input.supplierId,
      categoryId: input.categoryId,
      costCenterId: input.costCenterId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      limit: input.limit ?? 20,
    });
    if (rows.length === 0) {
      return skillResult.success("Nenhuma conta a pagar encontrada.", { rows, total: 0 });
    }
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const preview = rows
      .slice(0, 5)
      .map(
        (r) =>
          `• ${r.description} — R$ ${r.amount.toFixed(2)} (${r.status}${r.dueDate ? `, venc ${r.dueDate}` : ""})`,
      )
      .join("\n");
    return skillResult.success(
      `${rows.length} conta(s) a pagar · Total R$ ${total.toFixed(2)}\n${preview}`,
      { rows, total },
    );
  },
});
