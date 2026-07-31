/**
 * Tool Registry — indexação por nome e por intent.
 */
import type { SupportedIntent, ToolDefinition } from "../contracts";

export interface ToolRegistry {
  list(): readonly ToolDefinition[];
  getByName(name: string): ToolDefinition | undefined;
  getByIntent(intent: SupportedIntent): ToolDefinition | undefined;
}

export function createToolRegistry(
  tools: readonly ToolDefinition[],
): ToolRegistry {
  const byName = new Map<string, ToolDefinition>();
  const byIntent = new Map<SupportedIntent, ToolDefinition>();
  for (const t of tools) {
    if (byName.has(t.name)) {
      throw new Error(`tool duplicada: ${t.name}`);
    }
    byName.set(t.name, t);
    byIntent.set(t.intent, t);
  }
  return {
    list: () => tools,
    getByName: (n) => byName.get(n),
    getByIntent: (i) => byIntent.get(i),
  };
}
