import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { AccountsReceivableService } from "../service/accounts-receivable.service";
import { financeReceivablesSchema } from "../schemas";

export { financeReceivablesSchema };

export const financeReceivablesSkill = defineBaseSkill({
  id: "finance.receivables",
  module: "finance",
  name: "Contas a receber",
  description: "Lista contas a receber (pendentes/vencidas/pagas) com filtros.",
  schema: financeReceivablesSchema,
  requiredPermissions: ["finance.view"],
  destructive: false,
  async handler(input, ctx) {
    const svc = new AccountsReceivableService(ctx);
    const rows = await svc.list({
      status: input.status,
      customerId: input.customerId,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      limit: input.limit ?? 20,
    });
    if (rows.length === 0) {
      return skillResult.success("Nenhuma conta a receber encontrada.", { rows, total: 0 });
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
      `${rows.length} conta(s) a receber · Total R$ ${total.toFixed(2)}\n${preview}`,
      { rows, total },
    );
  },
});
