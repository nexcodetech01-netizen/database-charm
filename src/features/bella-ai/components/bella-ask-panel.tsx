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
import { handleAgentRuntimeFn, executeAgentActionFn } from "../agent/runtime.functions";
import { interpretWithOpenAI } from "../ai/gateway/interpret-openai.functions";
// Importação removida para evitar vazamento do OpenAIProvider (que importa Registry) para o cliente.
// O provedor será carregado dinamicamente ou injetado.
// import { OpenAIProvider } from "../ai/providers/OpenAIProvider";
import { BellaAIGateway } from "../ai/gateway/BellaAIGateway";
import { askBella, appendMessage, createMessage, emptyContext, updateContext } from "@/features/accounting-ai/chat";
import type { ChatMessage, ChatContextState } from "@/features/accounting-ai/chat/types";
import { toast } from "sonner";

import { ActionCard, type ActionCardStatus } from "./ActionCard";

export function BellaAskPanel() {
  const [prompt, setPrompt] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingAction, setPendingAction] = useState<{
    intent: any;
    plan: any;
  } | null>(null);
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
  const handleAgentRuntime = useServerFn(handleAgentRuntimeFn);
  const gateway = useMemo(() => new BellaAIGateway(), []);

  const handleSend = useCallback(async () => {
    const message = prompt.trim();
    if (!message || !companyId || isThinking) return;

    setIsThinking(true);
    setPrompt(""); // Clear input immediately for better UX
    
    // 1. Log the user message in local state (optional, for history tracking if needed)
    // For now we just process and wait for the response to show it.

    try {
      // Step A: Attempt with the new Operational Agent Runtime (VIA SERVER FUNCTION)
      const runtimeResult = await handleAgentRuntime({
        data: {
          message,
          ctx: {
            companyId,
          },
        }
      });

      if (runtimeResult && typeof runtimeResult === 'object' && 'response' in runtimeResult) {
        const response = (runtimeResult as any).response;
        if (response) {
          if (response.code === "needs_confirmation") {
            setPendingAction({
              intent: response.intent,
              plan: response.plan,
            });
            return;
          }

          // Operational intent handled
          toast.success(response.message);
          return;
        }
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

  const handleActionConfirm = async () => {
    if (!pendingAction || !companyId) return;
    setIsThinking(true);
    try {
      const result = await handleAgentRuntime({
        data: {
          message: pendingAction.intent.raw,
          ctx: {
            companyId,
          },
          confirmed: true,
        }
      });

      if (result && typeof result === 'object' && 'response' in result) {
        const response = (result as any).response;
        if (response?.code === "executed") {
          toast.success(response.message);
        } else if (response?.code === "error") {
          toast.error(response.message);
        }
      }
    } catch (error) {
      toast.error("Erro ao executar ação.");
    } finally {
      setIsThinking(false);
      setPendingAction(null);
    }
  };

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
        {pendingAction && (
          <ActionCard
            title={pendingAction.plan.intentId}
            summary={pendingAction.plan.confirmationSummary}
            details={
              <div className="space-y-2">
                {pendingAction.plan.confirmationData ? (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                    <span className="text-muted-foreground">Produto:</span>
                    <span className="font-medium text-foreground">{String(pendingAction.plan.confirmationData.productName || "-")}</span>
                    
                    <span className="text-muted-foreground">Estoque atual:</span>
                    <span className="font-medium">{String(pendingAction.plan.confirmationData.currentStock || 0)}</span>
                    
                    <span className="text-muted-foreground">Novo estoque:</span>
                    <span className="font-medium text-primary">{String(pendingAction.plan.confirmationData.targetStock || 0)}</span>
                    
                    <span className="text-muted-foreground">Ajuste:</span>
                    <span className="font-medium">{Number(pendingAction.plan.confirmationData.delta || 0) > 0 ? "+" : ""}{String(pendingAction.plan.confirmationData.delta || 0)}</span>
                    
                    <span className="text-muted-foreground">Operação:</span>
                    <span className="italic">{String(pendingAction.plan.confirmationData.operation || "manual")}</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {Object.entries(pendingAction.intent.entities).map(([k, v]) => (
                      <p key={k}>
                        <span className="capitalize">{k}</span>: {String(v)}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            }
            onConfirm={handleActionConfirm}
            onCancel={() => setPendingAction(null)}
          />
        )}

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
            disabled={isThinking || !!pendingAction}
          />
          <Button 
            className="w-full gap-2" 
            disabled={!prompt.trim() || isThinking || !!pendingAction}
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
