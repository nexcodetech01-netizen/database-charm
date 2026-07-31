import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { FiscalService } from "../service/fiscal.service";
import { fiscalStatusSchema } from "../schemas";
import type { FiscalDocument, FiscalEvent } from "../types";

export const fiscalStatusSkill = defineBaseSkill<
  typeof fiscalStatusSchema,
  { document: FiscalDocument | null; history?: FiscalEvent[] }
>({
  id: "fiscal.status",
  module: "fiscal",
  name: "Status da NF-e",
  description: "Consulta o status atual e o histórico de eventos de uma NF-e.",
  schema: fiscalStatusSchema,
  requiredPermissions: ["fiscal.view"],
  destructive: false,
  async handler(input, ctx) {
    if (!input.documentId && !input.accessKey && !input.saleId) {
      return skillResult.missing("Informe documentId, accessKey ou saleId.", [
        { field: "documentId", label: "Identificador da NF-e", type: "text", required: true },
      ]) as never;
    }
    const svc = new FiscalService(ctx);
    let doc: FiscalDocument | null = null;
    if (input.documentId) doc = await svc.findById(input.documentId);
    else if (input.accessKey) doc = await svc.findByAccessKey(input.accessKey);
    else if (input.saleId) doc = await svc.findBySaleId(input.saleId);

    if (!doc) {
      return skillResult.success("Nenhuma NF-e encontrada para os critérios informados.", {
        document: null,
      });
    }

    const history = await svc.history(doc.id);
    const last = history[history.length - 1];
    const line = `NF-e ${doc.number ?? "-"} · status ${doc.status}${doc.rejectionReason ? ` · motivo: ${doc.rejectionReason}` : ""}${last ? ` · último evento: ${last.eventType}` : ""}.`;
    return skillResult.success(line, { document: doc, history });
  },
});
