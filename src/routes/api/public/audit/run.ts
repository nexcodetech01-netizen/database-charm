import { createFileRoute } from "@tanstack/react-router";
import { runServerAudit } from "@/features/bella-ai/agent/audit-runner";

export const Route = createFileRoute("/api/public/audit/run")({
  server: {
    handlers: {
      GET: async () => {
        // Ponto de entrada para disparar a auditoria via shell/curl
        // Sem auth para simplificar o disparo via exec
        console.log("[AUDIT-ROUTE] Inicianado auditoria manual...");
        await runServerAudit();
        return new Response("Auditoria finalizada. Verifique os logs do servidor.");
      }
    }
  }
});
