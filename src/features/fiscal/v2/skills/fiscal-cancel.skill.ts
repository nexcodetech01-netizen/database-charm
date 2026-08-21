import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
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
    // Importação dinâmica para evitar vazamento de código server-only para o cliente
    const { FiscalService } = await import("../service/fiscal.service.server");
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
