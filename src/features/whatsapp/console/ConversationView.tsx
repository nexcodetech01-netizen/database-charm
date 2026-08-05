import { useEffect, useState } from "react";
import { Send, StickyNote, MessageCircle, MessageSquarePlus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ConversationHeader } from "./ConversationHeader";
import { ConversationTimeline } from "./ConversationTimeline";
import { useConsoleMutations, useConversationDetail } from "./hooks";
import type { ConversationListItem } from "./types";

export function ConversationView({
  selected,
  companyId,
  onDeleted,
}: {
  selected: ConversationListItem | null;
  companyId: string | null;
  onDeleted?: (id: string) => void;
}) {
  const detail = useConversationDetail(selected?.id ?? null);
  const mutations = useConsoleMutations(companyId);
  const [tab, setTab] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");

  // Ao abrir uma conversa, zera não lidas.
  useEffect(() => {
    if (selected?.id && selected.unread_count > 0) {
      mutations.markRead.mutate(selected.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  if (!selected) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-12 text-center">
        <div className="mb-4 rounded-full bg-primary/5 p-6">
          <MessageCircle className="h-12 w-12 text-primary/20" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">Selecione uma conversa</h3>
        <p className="mt-2 max-w-xs text-sm text-muted-foreground">
          Escolha um contato na lista à esquerda para visualizar o histórico e responder mensagens.
        </p>
        <Button 
          variant="outline" 
          className="mt-6 gap-2"
          onClick={() => {}}
        >
          <MessageSquarePlus className="h-4 w-4" /> Iniciar Nova Conversa
        </Button>
      </div>
    );
  }
  if (detail.isLoading || !detail.data) {
    return (
      <div className="flex h-full flex-col gap-3 p-6">
        <div className="h-14 animate-pulse rounded-md bg-muted/50" />
        <div className="h-full animate-pulse rounded-md bg-muted/30" />
      </div>
    );
  }

  const conv = detail.data;
  const busy =
    mutations.assume.isPending ||
    mutations.returnToBella.isPending ||
    mutations.setStatus.isPending;

  const lastInboundAt = conv.ultima_mensagem_cliente_at;
  const isOpen = lastInboundAt 
    ? (Date.now() - new Date(lastInboundAt).getTime()) <= 24 * 60 * 60 * 1000 
    : false;

  const handleSubmit = async () => {
    const value = text.trim();
    if (!value) return;
    try {
      if (tab === "reply") {
        const result = await mutations.sendMessage.mutateAsync({
          conversationId: conv.id,
          text: value,
        });
        if (result && result.ok === false) {
          // Integração pendente: aviso amigável, texto preservado no campo.
          toast.warning("Configuração do WhatsApp pendente", {
            description:
              result.message ??
              "Cadastre as credenciais da Cloud API para habilitar o envio.",
          });
          return;
        }
        toast.success("Mensagem enviada.");
      } else {
        await mutations.addNote.mutateAsync({ conversationId: conv.id, text: value });
        toast.success("Observação registrada.");
      }
      setText("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao enviar.");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ConversationHeader
        conversation={conv}
        onAssume={() =>
          mutations.assume.mutate(conv.id, {
            onSuccess: () => toast.success("Conversa assumida."),
            onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao assumir."),
          })
        }
        onReturn={() =>
          mutations.returnToBella.mutate(conv.id, {
            onSuccess: () => toast.success("Devolvido para a Bella."),
            onError: (e) => toast.error(e instanceof Error ? e.message : "Falha ao devolver."),
          })
        }
        onArchive={() =>
          mutations.setStatus.mutate(
            { conversationId: conv.id, status: "archived" },
            { onSuccess: () => toast.success("Conversa arquivada.") },
          )
        }
        onResolve={() =>
          mutations.setStatus.mutate(
            { conversationId: conv.id, status: "resolved" },
            { onSuccess: () => toast.success("Marcada como resolvida.") },
          )
        }
        onDelete={() =>
          mutations.deleteConversation.mutate(conv.id, {
            onSuccess: () => {
              toast.success("Conversa excluída com sucesso.");
              onDeleted?.(conv.id);
            },
            onError: (e) =>
              toast.error(e instanceof Error ? e.message : "Falha ao excluir a conversa."),
          })
        }
        busy={busy}
        deleting={mutations.deleteConversation.isPending}
      />

      <ConversationTimeline messages={conv.messages} notes={conv.notes} />

      <footer className="border-t p-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "reply" | "note")}>
          <TabsList className="h-8">
            <TabsTrigger value="reply" className="h-7 px-2 text-xs">
              <Send className="mr-1 h-3 w-3" /> Responder
            </TabsTrigger>
            <TabsTrigger value="note" className="h-7 px-2 text-xs">
              <StickyNote className="mr-1 h-3 w-3" /> Observação interna
            </TabsTrigger>
          </TabsList>
          <TabsContent value="reply" className="mt-2 space-y-2">
            <div className="relative">
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={!isOpen ? "Janela Fechada. Envie um Template para reabrir..." : "Escreva uma resposta para o cliente…"}
                disabled={!isOpen}
                className={cn(
                  "min-h-[72px] text-sm",
                  !isOpen && "bg-muted/50 cursor-not-allowed opacity-60"
                )}
                onKeyDown={(e) => {
                  if (isOpen && e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
              />
              {!isOpen && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="bg-background/80 px-3 py-1 rounded-md text-xs font-medium text-amber-600 border border-amber-200 shadow-sm flex items-center gap-1.5 pointer-events-auto">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Campo desabilitado (Janela Fechada)
                  </span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 text-[10px]"
                  disabled={mutations.sendMessage.isPending}
                  onClick={() => mutations.sendMessage.mutate({
                    conversationId: conv.id,
                    text: "Enviando template de boas-vindas...",
                    type: "template",
                    templateName: "boas_vindas"
                  })}
                >
                  <MessageSquarePlus className="mr-1 h-3 w-3" /> Template Boas-vindas
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="h-8 text-[10px]"
                  disabled={mutations.sendMessage.isPending}
                  onClick={() => mutations.sendMessage.mutate({
                    conversationId: conv.id,
                    text: "Enviando template de cobrança...",
                    type: "template",
                    templateName: "cobranca_criada"
                  })}
                >
                  <MessageSquarePlus className="mr-1 h-3 w-3" /> Template Cobrança
                </Button>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Button 
                  size="sm" 
                  onClick={handleSubmit} 
                  disabled={!isOpen || mutations.sendMessage.isPending}
                >
                  <Send className="mr-1.5 h-3.5 w-3.5" /> Enviar
                </Button>
                <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                  Pressione Enter para enviar • Shift + Enter para quebra de linha
                </p>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="note" className="mt-2 space-y-2">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Anotações internas — não são enviadas ao cliente."
              className="min-h-[72px] text-sm"
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] text-muted-foreground">Visível apenas para a equipe.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSubmit}
                disabled={mutations.addNote.isPending}
              >
                <StickyNote className="mr-1.5 h-3.5 w-3.5" /> Adicionar observação
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </footer>
    </div>
  );
}
