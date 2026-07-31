import { AlertCircle, Bot } from "lucide-react";
import type { ConversationDetail } from "./types";

/**
 * AssignmentManager — mostra rapidamente quem está no controle.
 * As ações de assumir/devolver ficam em ConversationActions, disparadas
 * pelo header, mantendo aqui apenas o indicador textual leve.
 */
export function AssignmentManager({ conversation }: { conversation: ConversationDetail }) {
  if (conversation.status === "human" && conversation.assigned_operator_name) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-600">
        <AlertCircle className="h-3 w-3" /> Bella pausada
      </span>
    );
  }
  if (conversation.status === "bella" || conversation.status === "open") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-600">
        <Bot className="h-3 w-3" /> Bella ativa
      </span>
    );
  }
  return null;
}
