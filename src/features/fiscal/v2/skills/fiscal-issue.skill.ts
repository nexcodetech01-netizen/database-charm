import { defineBaseSkill } from "@/features/bella-ai/agent/infrastructure/base-skill";
import { skillResult } from "@/features/bella-ai/skills/types";
import { fiscalIssueSchema } from "../schemas";

export const fiscalIssueSkill = defineBaseSkill({
  id: "fiscal.issue",
  module: "fiscal",
  name: "Emitir NF-e",
  description: "Emite a NF-e de uma venda via provedor fiscal configurado.",
  schema: fiscalIssueSchema,
  requiredPermissions: ["fiscal.create"],
  destructive: true,
  confirmationSummary: (input) =>
    (input.environment ?? "homologation") === "homologation"
      ? `Esta NF-e será emitida apenas para testes. Emitir NF-e para a venda ${input.saleId}?`
      : `Emitir NF-e em PRODUÇÃO para a venda ${input.saleId}? A nota terá validade fiscal.`,
  async handler(input, ctx) {
    // Importação dinâmica para evitar vazamento de FiscalService (server-only) para o cliente
    const { FiscalService } = await import("../service/fiscal.service.server");
    const svc = new FiscalService(ctx);
    const environment = input.environment ?? "homologation";
    const testNotice =
      environment === "homologation" ? "Esta NF-e será emitida apenas para testes.\n" : "";
    const { document, validationIssues } = await svc.issueFromSale(input.saleId, environment);
    
    if (document.status === "authorized") {
      return skillResult.success(
        `${testNotice}NF-e autorizada · nº ${document.number ?? "-"} · protocolo ${document.protocol ?? "-"}.`,
        { document },
      );
    }
    if (document.status === "rejected") {
      const detail = validationIssues.length
        ? validationIssues
            .slice(0, 3)
            .map((i: any) => `• ${i.field}: ${i.message}`)
            .join("\n")
        : (document.rejectionReason ?? "Motivo não informado.");
      return skillResult.success(`${testNotice}NF-e rejeitada.\n${detail}`, {
        document,
        validationIssues,
      });
    }
    return skillResult.success(`${testNotice}NF-e em processamento (status: ${document.status}).`, {
      document,
    });
  },
});
