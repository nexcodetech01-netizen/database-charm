import { MessagesSquare, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CONVERSATION_STATUS_LABELS } from "../data";
import type { WhatsAppConversation } from "../types";

export interface ConversationListProps {
  conversations: WhatsAppConversation[];
  selectedId: string | null;
  onSelect: (conversation: WhatsAppConversation) => void;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
}: ConversationListProps) {
  return (
    <div className="flex h-full min-h-0 flex-col border-r border-border bg-card">
      <div className="space-y-3 border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente, telefone ou mensagem"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {["Cliente", "Status", "Data", "Última mensagem"].map((f) => (
            <span
              key={f}
              className="rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {f}
            </span>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-16 text-center">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
              <MessagesSquare className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">Nenhuma conversa ainda</p>
            <p className="text-xs text-muted-foreground">
              Conecte um provedor para começar a receber mensagens.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {conversations.map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                active={c.id === selectedId}
                onClick={() => onSelect(c)}
              />
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

function ConversationRow({
  conversation,
  active,
  onClick,
}: {
  conversation: WhatsAppConversation;
  active: boolean;
  onClick: () => void;
}) {
  const initials = conversation.contact.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors",
          active ? "bg-accent" : "hover:bg-muted/50",
        )}
      >
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium">
              {conversation.contact.name}
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {new Date(conversation.lastMessageAt).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {conversation.lastMessagePreview}
          </p>
          <div className="mt-1 flex items-center gap-1">
            <Badge
              variant="secondary"
              className="h-4 px-1.5 text-[9px] uppercase tracking-wide"
            >
              {CONVERSATION_STATUS_LABELS[conversation.status]}
            </Badge>
            {conversation.unreadCount > 0 ? (
              <Badge className="h-4 min-w-4 justify-center px-1 text-[9px]">
                {conversation.unreadCount}
              </Badge>
            ) : null}
          </div>
        </div>
      </button>
    </li>
  );
}
