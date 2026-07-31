import { useCallback, useMemo, useRef, useState } from "react";
import { askBella } from "../chat";
import {
  appendMessage,
  clearHistory,
  createMessage,
  emptyContext,
  updateContext,
} from "../chat";
import type { ChatContextState, ChatMessage } from "../chat/types";

const WELCOME =
  "Oi! Sou a Bella Contadora. Pergunte, por exemplo: “quanto posso retirar?”, “como está minha empresa?” ou “qual foi o lucro do mês?”.";

/** Estado da conversa da Bella Contadora — apenas sessão, sem persistência. */
export function useBellaChat(companyId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    createMessage("bella", WELCOME),
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const contextRef = useRef<ChatContextState>(emptyContext());

  const send = useCallback(
    async (raw: string) => {
      const question = raw.trim();
      if (!question || !companyId || isThinking) return;

      setMessages((prev) => appendMessage(prev, createMessage("user", question)));
      setIsThinking(true);
      try {
        const answer = await askBella(question, companyId, {
          context: contextRef.current,
        });
        contextRef.current = updateContext(contextRef.current, answer);
        setMessages((prev) =>
          appendMessage(prev, createMessage("bella", answer.text, answer.skills)),
        );
      } catch {
        setMessages((prev) =>
          appendMessage(
            prev,
            createMessage("bella", "Não consegui consultar os dados agora. Tente novamente."),
          ),
        );
      } finally {
        setIsThinking(false);
      }
    },
    [companyId, isThinking],
  );

  const reset = useCallback(() => {
    contextRef.current = emptyContext();
    setMessages(appendMessage(clearHistory(), createMessage("bella", WELCOME)));
  }, []);

  const suggestions = useMemo(
    () => [
      "Como está minha empresa?",
      "Quanto posso retirar?",
      "Qual foi o lucro do mês?",
      "O que precisa da minha atenção?",
    ],
    [],
  );

  return { messages, isThinking, send, reset, suggestions };
}
