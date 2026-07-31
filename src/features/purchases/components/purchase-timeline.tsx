import { CheckCircle2, Clock, FileText, Ban, Package } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { PurchaseWithItems } from "../types";

interface Event {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  at: string;
  tone: string;
}

export function PurchaseTimeline({ purchase }: { purchase: PurchaseWithItems }) {
  const events: Event[] = [];

  events.push({
    icon: FileText,
    label: "Compra criada",
    at: purchase.created_at,
    tone: "text-primary",
  });

  if (purchase.status === "pending") {
    events.push({
      icon: Clock,
      label: "Marcada como pendente",
      at: purchase.updated_at,
      tone: "text-warning",
    });
  }

  if (purchase.received_at) {
    events.push({
      icon: CheckCircle2,
      label: "Compra recebida",
      at: purchase.received_at,
      tone: "text-success",
    });
  }

  if (purchase.status === "cancelled") {
    events.push({
      icon: Ban,
      label: "Compra cancelada",
      at: purchase.updated_at,
      tone: "text-destructive",
    });
  }

  if (purchase.stock_applied) {
    events.push({
      icon: Package,
      label: "Estoque atualizado",
      at: purchase.updated_at,
      tone: "text-success",
    });
  }

  events.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="space-y-4">
      {events.map((ev, idx) => {
        const Icon = ev.icon;
        return (
          <div key={idx} className="flex gap-3">
            <div
              className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent ${ev.tone}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 border-b border-border pb-3">
              <p className="text-sm font-medium">{ev.label}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(ev.at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
