import { useEffect, useRef } from "react";
import { format, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Bot, StickyNote, User, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import type { ConversationMessage, ConversationNote } from "./types";

type TimelineItem =
  | { kind: "message"; at: string; message: ConversationMessage }
  | { kind: "note"; at: string; note: ConversationNote }
  | { kind: "event"; at: string; label: string; icon: "skill" | "warn" };

function safeFormatTime(iso: string | null): string {
  if (!iso) return "--:--";
  try {
    const d = new Date(iso);
    if (!isValid(d)) return "--:--";
    return format(d, "HH:mm", { locale: ptBR });
  } catch {
    return "--:--";
  }
}

function formatWhatsAppText(text: string) {
  if (!text) return "";
  // Converte *negrito* do WhatsApp para **negrito** do Markdown
  // Protegendo contra negritos já existentes (Markdown padrão)
  return text.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, "$1**$2**$3");
}

export function ConversationTimeline({
  messages = [],
  notes = [],
}: {
  messages: ConversationMessage[];
  notes: ConversationNote[];
}) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const items: TimelineItem[] = [];
  for (const m of (messages || [])) {
    if (!m?.created_at) continue;
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
  for (const n of (notes || [])) {
    if (!n?.created_at) continue;
    items.push({ kind: "note", at: n.created_at, note: n });
  }
  
  items.sort((a, b) => {
    try {
      return new Date(a.at).getTime() - new Date(b.at).getTime();
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages?.length, notes?.length]);

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
        const time = safeFormatTime(it.at);
        if (it.kind === "note") {
          return (
            <div
              key={`n-${it.note?.id || idx}`}
              className="mx-auto max-w-lg rounded-md border border-amber-500/30 bg-amber-50/50 px-3 py-2 text-xs text-amber-800 dark:text-amber-200"
            >
              <div className="mb-0.5 flex items-center gap-1.5 font-medium">
                <StickyNote className="h-3 w-3" /> Observação interna
                <span className="ml-auto text-[10px] text-muted-foreground">{time}</span>
              </div>
              <p className="whitespace-pre-wrap">{it.note?.text || ""}</p>
              {it.note?.author_name ? (
                <p className="mt-1 text-[10px] text-muted-foreground">— {it.note.author_name}</p>
              ) : null}
            </div>
          );
        }
        if (it.kind === "event") {
          const Icon = it.icon === "warn" ? AlertTriangle : Zap;
          const isSkill = it.icon === "skill";
          
          return (
            <div
              key={`e-${idx}-${it.at}`}
              className={cn(
                "mx-auto flex items-center gap-1.5",
                isSkill ? "opacity-40 text-[10px]" : "text-[10px] text-muted-foreground"
              )}
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
        const inbound = m?.direction === "inbound";
        const isOperator = m?.provider === "operator";
        const isSystem = m?.provider === "system";

        return (
          <div key={m?.id || idx} className={cn("flex", inbound ? "justify-start" : "justify-end")}>
            <div
              className={cn(
                "relative max-w-[70%] px-3 py-2 text-sm shadow-sm",
                inbound
                  ? "mr-auto rounded-2xl rounded-tl-sm bg-slate-800 text-slate-100"
                  : isOperator
                    ? isSystem
                      ? "ml-auto rounded-2xl rounded-br-none border border-blue-200 bg-blue-50/50 py-1 text-[11px] text-blue-800 shadow-none dark:border-blue-900/30 dark:bg-blue-900/10 dark:text-blue-300"
                      : "ml-auto rounded-2xl rounded-tr-sm bg-blue-600 text-white"
                    : "ml-auto rounded-2xl rounded-tr-sm bg-blue-600 text-white",
              )}
            >
              {!inbound && !isSystem ? (
                <div className="mb-1 flex items-center gap-1 text-[10px] opacity-80">
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
              
              <div className={cn("whitespace-pre-wrap break-words prose prose-invert prose-sm max-w-none", isSystem && "italic")}>
                {m?.text ? (
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="m-0 inline">{children}</p>,
                    }}
                  >
                    {formatWhatsAppText(m.text)}
                  </ReactMarkdown>
                ) : (
                  <em>(vazio)</em>
                )}
              </div>

              <div
                className={cn(
                  "mt-1 flex items-center justify-end gap-1 text-[10px] text-slate-300",
                  !isSystem && "mt-0.5",
                )}
              >
                <span>{time}</span>
                {m?.status && !inbound && !isSystem ? (
                  <span
                    className={cn(
                      m.status === "failed" && "flex items-center gap-0.5 font-bold text-red-400",
                    )}
                  >
                    ·{" "}
                    {m.status === "failed" ? (
                      <>
                        <AlertTriangle className="h-2 w-2" /> Falha
                      </>
                    ) : (
                      m.status
                    )}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
