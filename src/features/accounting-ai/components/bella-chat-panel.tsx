import { useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Section } from "@/components/design";
import { INTERACTION_TOKENS, MOTION_TOKENS, RADIUS_TOKENS, TEXT_TOKENS } from "@/design";
import { BellaSkillCard } from "@/features/bella-ai/components/bella-skill-card";
import { useBellaChat } from "../hooks/use-bella-chat";

export interface BellaChatPanelProps {
  companyId: string;
  className?: string;
}

/** Nome amigável de uma skill técnica — apenas apresentação. */
export function friendlySkillName(skillId: string): string {
  const cleaned = skillId
    .replace(/^consultar_/, "")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!cleaned) return skillId;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

export function BellaChatPanel({ companyId, className }: BellaChatPanelProps) {
  const { messages, isThinking, send, reset, suggestions } = useBellaChat(companyId);
  const [value, setValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isThinking]);

  const submit = (text: string) => {
    void send(text);
    setValue("");
  };

  const lastMessageId = useMemo(() => messages[messages.length - 1]?.id, [messages]);

  return (
    <Section
      title={
        <span className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-primary" aria-hidden="true" />
          Conversar com a Bella
        </span>
      }
      actions={
        <Button variant="ghost" size="sm" onClick={reset} aria-label="Reiniciar conversa">
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
        </Button>
      }
      className={className}
    >
      <div className="space-y-5">
        <div
          ref={scrollRef}
          data-testid="bella-chat-scroll"
          className="flex max-h-96 min-h-56 scroll-smooth flex-col gap-6 overflow-y-auto pr-1"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              data-testid="bella-chat-message"
              data-role={m.role}
              className={cn(
                "flex min-w-0 flex-col gap-2",
                m.role === "user" ? "items-end" : "items-start",
                m.id === lastMessageId &&
                  `animate-in fade-in-0 slide-in-from-bottom-1 ${MOTION_TOKENS.normal}`,
              )}
            >
              {/* Bloco de texto */}
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-line leading-relaxed",
                  TEXT_TOKENS.sm,
                  m.role === "user"
                    ? cn("bg-primary px-4 py-2.5 text-primary-foreground", RADIUS_TOKENS.xl)
                    : "text-foreground",
                )}
              >
                {m.text}
              </div>

              {/* Bloco de skills executadas */}
              {m.skills.length > 0 && (
                <div
                  data-testid="bella-chat-skills"
                  className="grid w-full max-w-[85%] gap-2 sm:grid-cols-2"
                >
                  {m.skills.map((s) => (
                    <BellaSkillCard
                      key={s}
                      name={friendlySkillName(s)}
                      result="Dados consultados"
                      status="success"
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          {isThinking && (
            <p
              data-testid="bella-chat-loading"
              className={cn("animate-pulse text-muted-foreground", TEXT_TOKENS.sm)}
            >
              Bella está consultando…
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <Button
              key={s}
              type="button"
              variant="outline"
              size="sm"
              className={cn(
                "h-8 rounded-full font-normal",
                TEXT_TOKENS.xs,
                INTERACTION_TOKENS.hover,
              )}
              disabled={isThinking}
              onClick={() => submit(s)}
            >
              {s}
            </Button>
          ))}
        </div>

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(value);
          }}
        >
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Pergunte sobre caixa, lucro, retirada…"
            aria-label="Mensagem para a Bella"
            disabled={isThinking}
          />
          <Button type="submit" size="icon" disabled={isThinking || !value.trim()}>
            <Send className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Enviar</span>
          </Button>
        </form>
      </div>
    </Section>
  );
}
