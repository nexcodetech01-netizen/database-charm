/**
 * Helper para inicialização do Registry no servidor.
 * Este arquivo é seguro contra vazamento no bundle do cliente.
 */
import { BellaSkillRegistry } from "./registry";

export async function initializeRegistryOnServer(): Promise<void> {
  const { initializeSkills } = await import("./index");
  initializeSkills();
}
