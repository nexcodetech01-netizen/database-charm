import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import { Clock } from "lucide-react";
import { TIMELINE_KIND_ICON } from "../icons";
import type { WhatsAppTimelineEvent } from "../types";

export function CommunicationTimeline({
  events,
}: {
  events: WhatsAppTimelineEvent[];
}) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="Timeline ainda vazia"
        description="Pedidos enviados, PDFs, cobranças, mensagens lidas e pagamentos aparecerão aqui em ordem cronológica."
      />
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <ol className="space-y-4 border-l border-border pl-4">
          {events.map((e) => {
            const Icon = TIMELINE_KIND_ICON[e.kind];
            return (
              <li key={e.id} className="relative">
                <span className="absolute -left-[22px] top-0.5 grid h-4 w-4 place-items-center rounded-full bg-background text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{e.label}</p>
                  <Badge variant="secondary" className="h-4 px-1.5 text-[9px] uppercase">
                    {new Date(e.at).toLocaleString("pt-BR")}
                  </Badge>
                </div>
                {e.detail ? (
                  <p className="mt-1 text-xs text-muted-foreground">{e.detail}</p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
