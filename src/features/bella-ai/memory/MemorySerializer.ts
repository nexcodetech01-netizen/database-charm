import type { ConversationMemory } from "./MemoryTypes";
import { isValidMemory } from "./MemoryValidator";

/**
 * Serialização defensiva. Usada para debug/log e possíveis snapshots em runtime.
 * NÃO persiste em storage — a memória é in-memory por natureza.
 */

export function serialize(memory: ConversationMemory): string {
  try {
    return JSON.stringify(memory);
  } catch {
    return "{}";
  }
}

export function deserialize(raw: string): ConversationMemory | null {
  try {
    const parsed = JSON.parse(raw);
    return isValidMemory(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function summarize(memory: ConversationMemory): string {
  const parts: string[] = [];
  if (memory.activeModule) parts.push(`módulo=${memory.activeModule}`);
  if (memory.activeSkill) parts.push(`skill=${memory.activeSkill}`);
  if (memory.activeCustomer) parts.push(`cliente=${memory.activeCustomer.label}`);
  if (memory.activeProduct) parts.push(`produto=${memory.activeProduct.label}`);
  if (memory.activeQuote) parts.push(`orçamento=${memory.activeQuote.label}`);
  if (memory.activeOrder) parts.push(`venda=${memory.activeOrder.label}`);
  if (memory.pendingFields.length > 0) parts.push(`pendentes=[${memory.pendingFields.join(",")}]`);
  return parts.join(" · ") || "vazio";
}
