import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RecentChat {
  id: string;
  question: string;
  when: string;
}

const RECENT_CHATS: RecentChat[] = [
  { id: "1", question: "Quais clientes ainda não pagaram este mês?", when: "há 2h" },
  { id: "2", question: "Qual categoria vendeu mais na última semana?", when: "ontem" },
  { id: "3", question: "Quanto gastei com fornecedores em outubro?", when: "há 2 dias" },
  { id: "4", question: "Quais produtos estão parados no estoque?", when: "há 3 dias" },
];

export function BellaRecentConversations() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4 text-primary" /> Últimas conversas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {RECENT_CHATS.map(({ id, question, when }) => (
          <button
            key={id}
            type="button"
            disabled
            className="flex w-full items-start justify-between gap-2 rounded-md border border-border/70 bg-background px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/5 disabled:opacity-90"
          >
            <span className="min-w-0 flex-1 truncate text-xs text-foreground">
              {question}
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">{when}</span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
