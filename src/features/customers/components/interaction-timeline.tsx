import { Phone, MessageCircle, Mail, MapPin, StickyNote, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomerInteractions, useDeleteInteraction } from "../hooks/use-customers";
import type { InteractionType } from "../types";

const ICONS: Record<InteractionType, { icon: LucideIcon; label: string; tone: string }> = {
  call: { icon: Phone, label: "Ligação", tone: "text-primary bg-primary/10" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", tone: "text-success bg-success/10" },
  email: { icon: Mail, label: "E-mail", tone: "text-primary bg-primary/10" },
  visit: { icon: MapPin, label: "Visita", tone: "text-warning bg-warning/10" },
  note: { icon: StickyNote, label: "Observação", tone: "text-muted-foreground bg-muted" },
};

function fmt(v: string) {
  return new Date(v).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function InteractionTimeline({ customerId }: { customerId: string }) {
  const { data, isLoading } = useCustomerInteractions(customerId);
  const del = useDeleteInteraction(customerId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        Nenhuma interação registrada ainda.
      </div>
    );
  }

  return (
    <ol className="relative space-y-4 border-l border-border pl-6">
      {data.map((it) => {
        const cfg = ICONS[(it.type as InteractionType) ?? "note"] ?? ICONS.note;
        const Icon = cfg.icon;
        return (
          <li key={it.id} className="relative">
            <span
              className={`absolute -left-[34px] flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-background ${cfg.tone}`}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{cfg.label}</span>
                    <span>·</span>
                    <span>{fmt(it.occurred_at)}</span>
                  </div>
                  {it.subject ? (
                    <p className="mt-1 text-sm font-medium text-foreground">{it.subject}</p>
                  ) : null}
                  {it.content ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                      {it.content}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => del.mutate(it.id)}
                  aria-label="Excluir interação"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
