import { handleAgentRuntimeFn } from "./src/features/bella-ai/agent/runtime.functions";
import { BellaSkillRegistry } from "./src/features/bella-ai/skills/registry";
import { isBellaAgentEnabled } from "./src/features/bella-ai/agent/config";

async function validate() {
  console.log("--- AUDITORIA DE SEGURANÇA E ARQUITETURA BELLA IA ---");
  
  // 1. Verificar feature flag
  console.log(`Feature Flag (Enabled): ${isBellaAgentEnabled()}`);
  
  // 2. Verificar Registry no ambiente de teste (Node)
  await BellaSkillRegistry.ensureInitialized();
  const skills = BellaSkillRegistry.list();
  console.log(`Registry Skills (Total): ${skills.length}`);
  
  const stockAdjust = BellaSkillRegistry.get("stock.adjust");
  console.log(`Skill 'stock.adjust' encontrada: ${!!stockAdjust}`);
  
  // 3. Simular chamada de planejamento (sem confirmação)
  console.log("\n--- TESTE: PLANEJAMENTO (SEM CONFIRMAÇÃO) ---");
  const testMessage = "Altere o estoque da Carteira Masculina Texturizada - Arthur Preto para 10.";
  
  // Simulando o contexto que o handler recebe
  // Usamos um mock do SupabaseAdmin e IDs válidos para o teste
  const mockCtx = {
    companyId: "00000000-0000-0000-0000-000000000000",
    userId: "00000000-0000-0000-0000-000000000000"
  };

  // Como handleAgentRuntimeFn é uma server function, no ambiente de teste
  // podemos precisar chamar a lógica interna ou mockar o TanStack context.
  // Por simplicidade de validação lógica, vamos rodar o runtime diretamente
  // simulando o ambiente server-side.
  
  const { handleWithAgentRuntime } = await import("./src/features/bella-ai/agent/runtime");
  
  try {
    const result = await handleWithAgentRuntime({
      message: testMessage,
      ctx: {
        companyId: "550e8400-e29b-41d4-a716-446655440000", // UUID fictício mas válido
        userId: "550e8400-e29b-41d4-a716-446655440001",
        permissions: new Set(["*"]),
        isOwner: true
      }
    });

    console.log(`Outcome Code: ${result.response?.code}`);
    console.log(`Requires Confirmation: ${result.response?.plan?.requiresConfirmation}`);
    console.log(`Intent detected: ${result.response?.intent?.id}`);
    
    if (result.response?.code === "needs_confirmation") {
      console.log("RESULTADO: O Agente identificou a necessidade de confirmação e gerou o plano corretamente.");
    } else {
      console.log("RESULTADO: Falha ao detectar necessidade de confirmação.");
    }
  } catch (err) {
    console.error("Erro durante o teste de planejamento:", err);
  }
}

validate().catch(console.error);
