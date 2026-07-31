import { MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CONVERSATION_HISTORY, type ConversationEntry } from "../data";

interface ConversationHistoryProps {
  entries?: ConversationEntry[];
}

export function ConversationHistory({
  entries = CONVERSATION_HISTORY,
}: ConversationHistoryProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4 text-primary" /> Últimas conversas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {entries.map(({ id, question, when, summary }) => (
          <button
            key={id}
            type="button"
            disabled
            className="flex w-full flex-col gap-0.5 rounded-md border border-border/70 bg-background px-3 py-2 text-left transition-colors hover:border-primary/30 hover:bg-primary/5 disabled:opacity-90"
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                {question}
              </span>
              <span className="shrink-0 text-[10px] text-muted-foreground">{when}</span>
            </div>
            {summary ? (
              <span className="truncate text-[11px] text-muted-foreground">{summary}</span>
            ) : null}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}
