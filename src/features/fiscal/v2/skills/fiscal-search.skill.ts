import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { FiscalService } from "../service/fiscal.service.server";
import { fiscalSearchSchema } from "../schemas";

export const fiscalSearchSkill = defineBaseSkill({
  id: "fiscal.search",
  module: "fiscal",
  name: "Buscar NF-e",
  description: "Lista NF-e por status, venda, chave ou período.",
  schema: fiscalSearchSchema,
  requiredPermissions: ["fiscal.view"],
  destructive: false,
  async handler(input, ctx) {
    const svc = new FiscalService(ctx);
    const rows = await svc.search({
      status: input.status,
      saleId: input.saleId,
      accessKey: input.accessKey,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      limit: input.limit ?? 20,
    });
    if (rows.length === 0) return skillResult.success("Nenhuma NF-e encontrada.", { rows, total: 0 });
    const preview = rows
      .slice(0, 5)
      .map((r: any) => `• nº ${r.number ?? "-"} · ${r.status} · R$ ${r.totalAmount.toFixed(2)}`)
      .join("\n");
    return skillResult.success(`${rows.length} NF-e encontrada(s).\n${preview}`, {
      rows,
      total: rows.length,
    });
  },
});
