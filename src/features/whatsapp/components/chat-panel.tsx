import { MessageSquare, Paperclip, Send, Smile } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { QuickActionsBar } from "./quick-actions-bar";
import type { WhatsAppConversation } from "../types";

export interface ChatPanelProps {
  conversation: WhatsAppConversation | null;
}

export function ChatPanel({ conversation }: ChatPanelProps) {
  if (!conversation) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 bg-muted/20 p-10 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <MessageSquare className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-medium">Selecione uma conversa</p>
          <p className="text-xs text-muted-foreground">
            Ou inicie uma nova para começar a atender pelo WhatsApp.
          </p>
        </div>
      </div>
    );
  }

  const initials = conversation.contact.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-full min-h-0 flex-col bg-card">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3">
        <Avatar className="h-9 w-9">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {conversation.contact.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {conversation.contact.phone}
            {conversation.contact.city ? ` · ${conversation.contact.city}` : ""}
          </p>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="mx-auto flex max-w-2xl flex-col items-center justify-center gap-2 px-6 py-16 text-center">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <MessageSquare className="h-5 w-5" />
          </div>
          <p className="text-sm font-medium">Histórico vazio</p>
          <p className="text-xs text-muted-foreground">
            Mensagens, arquivos, PDFs, pedidos, cobranças, Pix, links e recibos
            aparecerão aqui.
          </p>
        </div>
      </ScrollArea>

      <div className="border-t border-border bg-background/50 p-3">
        <QuickActionsBar />
        <div className="mt-3 flex items-end gap-2 rounded-lg border border-border bg-card p-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Textarea
            placeholder="Escreva uma mensagem…"
            rows={1}
            className="min-h-9 resize-none border-0 bg-transparent px-1 text-sm shadow-none focus-visible:ring-0"
          />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Smile className="h-4 w-4" />
          </Button>
          <Button size="sm" className="h-8 shrink-0">
            <Send className="mr-1 h-3.5 w-3.5" /> Enviar
          </Button>
        </div>
      </div>
    </div>
  );
}
