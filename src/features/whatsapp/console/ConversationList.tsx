import { formatDistanceToNowStrict } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConversationStatusBadge } from "./ConversationStatus";
import { PresenceIndicator } from "./PresenceIndicator";
import { WhatsAppWindowIndicator } from "./WhatsAppWindowIndicator";
import type { ConversationListItem } from "./types";

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: false, locale: ptBR });
  } catch {
    return "";
  }
}

function initials(name: string | null, phone: string | null): string {
  const src = (name || phone || "?").trim();
  const parts = src.split(/\s+/).filter(Boolean);
  const s = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (s || src.slice(0, 2)).toUpperCase();
}

export function ConversationList({
  items,
  selectedId,
  onSelect,
  isLoading,
}: {
  items: ConversationListItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-1 p-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-md bg-muted/40" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
        <span>Nenhuma conversa por aqui ainda.</span>
        <span className="text-xs">
          Quando um cliente escrever pelo WhatsApp, aparecerá em tempo real.
        </span>
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {items.map((c) => {
        const isSelected = c.id === selectedId;
        const answeredByBella =
          c.last_message_direction === "outbound" &&
          c.last_message_provider &&
          c.last_message_provider !== "operator";
        const answeredByOperator =
          c.last_message_direction === "outbound" && c.last_message_provider === "operator";
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/50",
                isSelected && "bg-muted",
              )}
            >
              <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/5 border border-primary/10 text-xs font-semibold text-primary overflow-hidden">
                {/* 
                  Note: contact_avatar_url would need to be in ConversationListItem. 
                  If not present, we fall back to initials. 
                */}
                {initials(c.contact_name, c.contact_phone)}
                <PresenceIndicator
                  lastAt={c.last_message_at}
                  className="absolute bottom-0.5 right-0.5 ring-2 ring-background"
                />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                    <span className="truncate">
                      {c.contact_name || c.contact_phone || c.contact_wa_id}
                    </span>
                    {answeredByBella ? (
                      <Bot className="h-3 w-3 shrink-0 text-violet-500" aria-label="Bella" />
                    ) : answeredByOperator ? (
                      <User className="h-3 w-3 shrink-0 text-amber-500" aria-label="Operador" />
                    ) : null}
                  </div>
                  <time className="shrink-0 text-[10px] text-muted-foreground">
                    {timeAgo(c.last_message_at)}
                  </time>
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {c.last_message_text || "Sem mensagens ainda"}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ConversationStatusBadge status={c.status} />
                    <WhatsAppWindowIndicator lastAt={c.ultima_mensagem_cliente_at} />
                  </div>
                  {c.unread_count > 0 ? (
                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-semibold text-white">
                      {c.unread_count}
                    </span>
                  ) : null}
                </div>
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
