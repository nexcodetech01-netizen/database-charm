import { useEffect, useRef } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Bot, StickyNote, User, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConversationMessage, ConversationNote } from "./types";

type TimelineItem =
  | { kind: "message"; at: string; message: ConversationMessage }
  | { kind: "note"; at: string; note: ConversationNote }
  | { kind: "event"; at: string; label: string; icon: "skill" | "warn" };

export function ConversationTimeline({
  messages,
  notes,
}: {
  messages: ConversationMessage[];
  notes: ConversationNote[];
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Constrói timeline combinando mensagens, notas e eventos (skill/erro).
  const items: TimelineItem[] = [];
  for (const m of messages) {
    items.push({ kind: "message", at: m.created_at, message: m });
    if (m.skill_id) {
      items.push({
        kind: "event",
        at: m.created_at,
        label: `Skill executada: ${m.skill_id}`,
        icon: "skill",
      });
    }
    if (m.error) {
      items.push({
        kind: "event",
        at: m.created_at,
        label: `Erro: ${m.error}`,
        icon: "warn",
      });
    }
  }
  for (const n of notes) items.push({ kind: "note", at: n.created_at, note: n });
  items.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, notes.length]);

  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Nenhuma mensagem ainda.
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {items.map((it, idx) => {
        const time = format(new Date(it.at), "HH:mm", { locale: ptBR });
        if (it.kind === "note") {
          return (
            <div
              key={`n-${it.note.id}-${idx}`}
              className="mx-auto max-w-lg rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
            >
              <div className="mb-0.5 flex items-center gap-1.5 font-medium">
                <StickyNote className="h-3 w-3" /> Observação interna
                <span className="ml-auto text-[10px] text-muted-foreground">{time}</span>
              </div>
              <p className="whitespace-pre-wrap">{it.note.text}</p>
              {it.note.author_name ? (
                <p className="mt-1 text-[10px] text-muted-foreground">— {it.note.author_name}</p>
              ) : null}
            </div>
          );
        }
        if (it.kind === "event") {
          const Icon = it.icon === "warn" ? AlertTriangle : Zap;
          return (
            <div
              key={`e-${idx}-${it.at}`}
              className="mx-auto flex items-center gap-1.5 text-[10px] text-muted-foreground"
            >
              <Icon
                className={cn(
                  "h-3 w-3",
                  it.icon === "warn" ? "text-red-500" : "text-violet-500",
                )}
              />
              {it.label} · {time}
            </div>
          );
        }
        const m = it.message;
        const inbound = m.direction === "inbound";
        const isOperator = m.provider === "operator";
        return (
          <div key={m.id} className={cn("flex", inbound ? "justify-start" : "justify-end")}>
            <div
              className={cn(
                "max-w-[75%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                inbound
                  ? "rounded-bl-sm bg-muted text-foreground"
                  : isOperator
                    ? "rounded-br-sm bg-blue-600 text-white"
                    : "rounded-br-sm bg-slate-800 text-white",
              )}
            >
              {!inbound ? (
                <div className="mb-0.5 flex items-center gap-1 text-[10px] opacity-90">
                  {isOperator ? (
                    <>
                      <User className="h-3 w-3" /> Operador
                    </>
                  ) : (
                    <>
                      <Bot className="h-3 w-3" /> Bella
                    </>
                  )}
                </div>
              ) : null}
              <p className="whitespace-pre-wrap break-words">{m.text || <em>(vazio)</em>}</p>
              <div className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-80">
                <span>{time}</span>
                {m.status && !inbound ? <span>· {m.status}</span> : null}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
