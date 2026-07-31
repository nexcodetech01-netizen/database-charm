import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CONVERSATION_STATUS_LABEL, type ConversationStatus } from "./types";

const STYLES: Record<ConversationStatus, string> = {
  open: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  bella: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  human: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  waiting_customer: "bg-slate-500/10 text-slate-600 border-slate-500/20",
  resolved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  archived: "bg-muted text-muted-foreground border-border",
};

export function ConversationStatusBadge({
  status,
  className,
}: {
  status: ConversationStatus;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn("text-[10px] font-medium", STYLES[status], className)}>
      {CONVERSATION_STATUS_LABEL[status]}
    </Badge>
  );
}
