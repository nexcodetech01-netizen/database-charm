import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { FiscalService } from "../service/fiscal.service.server";
import { fiscalCancelSchema } from "../schemas";

export const fiscalCancelSkill = defineBaseSkill({
  id: "fiscal.cancel",
  module: "fiscal",
  name: "Cancelar NF-e",
  description: "Cancela uma NF-e autorizada dentro do prazo legal.",
  schema: fiscalCancelSchema,
  requiredPermissions: ["fiscal.delete"],
  destructive: true,
  confirmationSummary: (input) => `Cancelar NF-e ${input.documentId}? Motivo: ${input.reason}`,
  async handler(input, ctx) {
    const svc = new FiscalService(ctx);
    try {
      const doc = await svc.cancel(input.documentId, input.reason);
      return skillResult.success(`NF-e cancelada · protocolo ${doc.protocol ?? "-"}.`, { document: doc });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao cancelar NF-e.";
      return skillResult.error(message);
    }
  },
});
