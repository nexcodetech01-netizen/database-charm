import { useEffect, useRef, useState } from "react";
import { MessageCircle, RotateCcw, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useBellaChat } from "../hooks/use-bella-chat";

export interface BellaChatPanelProps {
  companyId: string;
  className?: string;
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

  return (
    <Card className={cn("rounded-2xl", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <MessageCircle className="h-4 w-4 text-primary" aria-hidden />
          Conversar com a Bella
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={reset} aria-label="Reiniciar conversa">
          <RotateCcw className="h-4 w-4" aria-hidden />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div
          ref={scrollRef}
          className="flex max-h-80 min-h-48 flex-col gap-3 overflow-y-auto pr-1"
        >
          {messages.map((m) => (
            <div
              key={m.id}
              className={cn("flex flex-col gap-1", m.role === "user" ? "items-end" : "items-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm leading-relaxed",
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted/50 text-foreground",
                )}
              >
                {m.text}
              </div>
              {m.skills.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {m.skills.map((s) => (
                    <Badge key={s} variant="outline" className="text-[10px] font-normal">
                      {s.replace("consultar_", "")}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          ))}
          {isThinking && (
            <p className="animate-pulse text-sm text-muted-foreground">Bella está consultando…</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <Button
              key={s}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 rounded-full text-xs font-normal"
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
            <Send className="h-4 w-4" aria-hidden />
            <span className="sr-only">Enviar</span>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
