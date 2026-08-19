import { useState, useCallback, useRef, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Section } from "@/components/design";
import { INTERACTION_TOKENS, RADIUS_TOKENS, TEXT_TOKENS } from "@/design";
import { ASK_EXAMPLES, QUICK_ACTION_PROMPTS } from "../workspace/data";
import { useAuth } from "@/providers/auth-provider";
import { usePermissions } from "@/features/rbac/hooks/use-permissions";
import { handleWithAgentRuntime } from "../agent/runtime";
import { interpretWithOpenAI } from "../ai/gateway/interpret-openai.functions";
import { OpenAIProvider } from "../ai/providers/OpenAIProvider";
import { BellaAIGateway } from "../ai/gateway/BellaAIGateway";
import { askBella, appendMessage, createMessage, emptyContext, updateContext } from "@/features/accounting-ai/chat";
import type { ChatMessage, ChatContextState } from "@/features/accounting-ai/chat/types";
import { toast } from "sonner";

export function BellaAskPanel() {
  const [prompt, setPrompt] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const { user, companyId } = useAuth();
  const { permissions, isOwner } = usePermissions();
  const legacyContextRef = useRef<ChatContextState>(emptyContext());

  // CORREÇÃO: `interpretWithOpenAI` é uma server function — chamada
  // direto (sem `useServerFn()`) a partir da cadeia de classes
  // Gateway→Provider sempre falhava com erro de validação (a mesma
  // causa raiz corrigida hoje no fluxo de notificações). Aqui, dentro
  // do componente, o hook vincula a função corretamente; o provider e
  // o gateway recebem essa versão já vinculada injetada, em vez de
  // usar o singleton padrão (que chama a função sem o hook).
  const interpretWithOpenAIFn = useServerFn(interpretWithOpenAI);
  const gateway = useMemo(
    () => new BellaAIGateway({ preferred: new OpenAIProvider(interpretWithOpenAIFn) }),
    [interpretWithOpenAIFn],
  );

  const handleSend = useCallback(async () => {
    const message = prompt.trim();
    if (!message || !companyId || isThinking) return;

    setIsThinking(true);
    setPrompt(""); // Clear input immediately for better UX
    
    // 1. Log the user message in local state (optional, for history tracking if needed)
    // For now we just process and wait for the response to show it.

    try {
      // Step A: Attempt with the new Operational Agent Runtime
      const runtimeResult = await handleWithAgentRuntime({
        message,
        ctx: {
          companyId,
          userId: user?.id,
          permissions,
          isOwner,
        },
        gateway,
      });

      if (runtimeResult.response) {
        // Operational intent handled
        toast.success(runtimeResult.response.message);
        // In a real chat we would append to messages here
        return;
      }

      // Step B: Fallback to the legacy Bella Contadora (Financial/Accounting)
      const legacyAnswer = await askBella(message, companyId, {
        context: legacyContextRef.current
      });
      
      legacyContextRef.current = updateContext(legacyContextRef.current, legacyAnswer);
      
      if (legacyAnswer.answered) {
        toast.info(legacyAnswer.text);
      } else {
        toast.error("Não entendi sua pergunta. Tente falar sobre vendas, estoque ou financeiro.");
      }
    } catch (error) {
      console.error("[BellaAskPanel] Error processing request:", error);
      toast.error("Ocorreu um erro ao processar sua pergunta.");
    } finally {
      setIsThinking(false);
    }
  }, [prompt, companyId, user?.id, permissions, isOwner, isThinking, gateway]);

  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" /> Pergunte para Bella IA
        </span>
      }
      density="comfortable"
    >
      <div data-testid="bella-ask-panel" className="space-y-5">
        <div className="space-y-2">
          <p
            className={cn(
              "font-medium uppercase tracking-wide text-muted-foreground",
              TEXT_TOKENS.xs,
            )}
          >
            Ações rápidas
          </p>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTION_PROMPTS.map(({ id, label, prompt: p, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setPrompt(p)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 font-medium text-muted-foreground",
                  TEXT_TOKENS.xs,
                  INTERACTION_TOKENS.hover,
                  INTERACTION_TOKENS.focus,
                  "hover:border-primary/40 hover:bg-accent/40 hover:text-foreground",
                )}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex.: quais produtos estão parados este mês?"
            className="min-h-[104px] resize-none"
            disabled={isThinking}
          />
          <Button 
            className="w-full gap-2" 
            disabled={!prompt.trim() || isThinking}
            onClick={handleSend}
          >
            {isThinking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {isThinking ? "Bella está pensando..." : "Enviar"}
          </Button>
        </div>

        <div className="space-y-2">
          <p
            className={cn(
              "font-medium uppercase tracking-wide text-muted-foreground",
              TEXT_TOKENS.xs,
            )}
          >
            Exemplos
          </p>
          <ul className="space-y-1.5">
            {ASK_EXAMPLES.map((q) => (
              <li key={q}>
                <button
                  type="button"
                  onClick={() => setPrompt(q)}
                  className={cn(
                    "w-full border border-border bg-background px-3 py-2 text-left text-muted-foreground",
                    RADIUS_TOKENS.lg,
                    TEXT_TOKENS.xs,
                    INTERACTION_TOKENS.hover,
                    INTERACTION_TOKENS.focus,
                    "hover:border-primary/30 hover:bg-accent/40 hover:text-foreground",
                  )}
                >
                  {q}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Section>
  );
}
