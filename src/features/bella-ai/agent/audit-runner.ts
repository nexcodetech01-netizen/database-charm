/**
 * Auditoria da Fase 3.1
 * Executa testes de intenção server-side para garantir rastreabilidade completa.
 */
import { handleWithAgentRuntime } from "./runtime";
import type { AgentContext } from "./types";

export async function runServerAudit() {
  const ctx: AgentContext = {
    companyId: "c2c5c2c5-c2c5-c2c5-c2c5-c2c5c2c5c2c5", // Mock UUID
    userId: "u1u1u1u1-u1u1-u1u1-u1u1-u1u1u1u1u1u1",
    permissions: new Set(["*"]),
    isOwner: true
  };

  const messages = [
    "Altere o estoque da Carteira Masculina Texturizada - Arthur Preto para 10.",
    "Defina o estoque da Carteira Masculina Texturizada - Arthur Preto para 10.",
    "Ajuste o estoque da Carteira Masculina Texturizada - Arthur Preto."
  ];

  console.log("=== BELLA IA SERVER AUDIT START ===");
  for (const message of messages) {
    try {
      // Nota: handleWithAgentRuntime loga internamente [BELLA-AUDIT]
      await handleWithAgentRuntime({ message, ctx });
    } catch (err) {
      console.error(`[AUDIT-ERROR] ${message}:`, err);
    }
  }
  console.log("=== BELLA IA SERVER AUDIT END ===");
}
