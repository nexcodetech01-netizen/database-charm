import { Phone, Hash, Bot, UserCircle2 } from "lucide-react";
import { ConversationStatusBadge } from "./ConversationStatus";
import { PresenceIndicator } from "./PresenceIndicator";
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
    <header className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
      <div className="flex min-w-0 items-start gap-3">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {(conversation.contact_name || conversation.contact_phone || "?").slice(0, 2).toUpperCase()}
          <PresenceIndicator
            lastAt={conversation.last_inbound_at}
            className="absolute -bottom-0.5 -right-0.5 ring-2 ring-background"
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-sm font-semibold">
              {conversation.contact_name || conversation.contact_phone || conversation.contact_wa_id}
            </h2>
            <ConversationStatusBadge status={conversation.status} />
            <WhatsAppWindowIndicator lastAt={conversation.ultima_mensagem_cliente_at} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" /> {conversation.contact_phone || conversation.contact_wa_id}
            </span>
            {conversation.protocol ? (
              <span className="inline-flex items-center gap-1">
                <Hash className="h-3 w-3" /> {conversation.protocol}
              </span>
            ) : null}
            <AssignmentManager conversation={conversation} />
            {conversation.assigned_operator_name ? (
              <span className="inline-flex items-center gap-1">
                <UserCircle2 className="h-3 w-3" /> {conversation.assigned_operator_name}
              </span>
            ) : conversation.status === "bella" || conversation.status === "open" ? (
              <span className="inline-flex items-center gap-1">
                <Bot className="h-3 w-3 text-violet-500" /> Respondendo automaticamente
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
