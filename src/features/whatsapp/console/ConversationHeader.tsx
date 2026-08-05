import { Phone, Hash, Bot, UserCircle2 } from "lucide-react";
import { ConversationStatusBadge } from "./ConversationStatus";
import { WhatsAppWindowIndicator } from "./WhatsAppWindowIndicator";
import { ConversationActions } from "./ConversationActions";
import { AssignmentManager } from "./AssignmentManager";
import type { ConversationDetail } from "./types";

export function ConversationHeader({
  conversation,
  onAssume,
  onReturn,
  onArchive,
  onResolve,
  onDelete,
  busy,
  deleting,
}: {
  conversation: ConversationDetail;
  onAssume: () => void;
  onReturn: () => void;
  onArchive: () => void;
  onResolve: () => void;
  onDelete: () => void;
  busy?: boolean;
  deleting?: boolean;
}) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b px-6 py-4">
      <div className="flex min-w-0 items-center gap-4">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/5 border border-primary/10 text-sm font-semibold text-primary">
          {(conversation.contact_name || conversation.contact_phone || "?").slice(0, 2).toUpperCase()}
          <WhatsAppWindowIndicator 
            lastAt={conversation.ultima_mensagem_cliente_at} 
            variant="dot"
            className="absolute bottom-0 right-0 ring-2 ring-background h-3 w-3" 
          />
        </div>
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-3">
            <h2 className="truncate text-base font-bold tracking-tight">
              {conversation.contact_name || conversation.contact_phone || conversation.contact_wa_id}
            </h2>
            <ConversationStatusBadge status={conversation.status} />
          </div>
          <div className="flex items-center gap-4 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 opacity-70" /> {conversation.contact_phone || conversation.contact_wa_id}
            </span>
            {conversation.protocol ? (
              <span className="inline-flex items-center gap-1.5 border-l pl-4">
                <Hash className="h-3.5 w-3.5 opacity-70" /> {conversation.protocol}
              </span>
            ) : null}
            <div className="border-l pl-4">
              <AssignmentManager conversation={conversation} />
            </div>
            {conversation.assigned_operator_name ? (
              <span className="inline-flex items-center gap-1.5 border-l pl-4">
                <UserCircle2 className="h-3.5 w-3.5 opacity-70" /> {conversation.assigned_operator_name}
              </span>
            ) : conversation.status === "bella" || conversation.status === "open" ? (
              <span className="inline-flex items-center gap-1.5 border-l pl-4">
                <Bot className="h-3.5 w-3.5 text-violet-500" /> 
                <span className="text-violet-600 dark:text-violet-400 font-medium">Auto-atendimento</span>
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <ConversationActions
        conversation={conversation}
        onAssume={onAssume}
        onReturn={onReturn}
        onArchive={onArchive}
        onResolve={onResolve}
        onDelete={onDelete}
        busy={busy}
        deleting={deleting}
      />
    </header>
  );
}
