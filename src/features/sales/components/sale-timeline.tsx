import { formatAccessKey } from "@/features/fiscal/v2/lib/access-key";
import { CheckCircle2, Clock, FileText, Ban, Package, Receipt } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { SaleWithItems } from "../types";
import { useSaleFiscalDocument } from "@/features/fiscal/v2/hooks/use-fiscal";
import { getFiscalStatusBadge } from "@/features/fiscal/v2/lib/fiscal-status";

interface Event {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  at: string;
  tone: string;
  detail?: string;
}

export function SaleTimeline({ sale }: { sale: SaleWithItems }) {
  const { data: fiscalDoc } = useSaleFiscalDocument(sale.id);
  const events: Event[] = [];

  events.push({
    icon: FileText,
    label: "Venda criada",
    at: sale.created_at,
    tone: "text-primary",
  });

  if (sale.status === "pending") {
    events.push({
      icon: Clock,
      label: "Marcada como pendente",
      at: sale.updated_at,
      tone: "text-warning",
    });
  }

  if (sale.paid_at) {
    events.push({
      icon: CheckCircle2,
      label: "Venda paga",
      at: sale.paid_at,
      tone: "text-success",
    });
  }

  if (sale.status === "cancelled") {
    events.push({
      icon: Ban,
      label: "Venda cancelada",
      at: sale.updated_at,
      tone: "text-destructive",
    });
  }

  if (sale.stock_applied) {
    events.push({
      icon: Package,
      label: "Estoque atualizado",
      at: sale.paid_at ?? sale.updated_at,
      tone: "text-success",
    });
  }

  // Documento fiscal — autorização e cancelamento entram na linha do tempo
  // da venda assim que o motor fiscal conclui a operação (realtime).
  const fiscalBadge = getFiscalStatusBadge(fiscalDoc ?? null);

  if (fiscalDoc && fiscalBadge.key === "issued") {
    events.push({
      icon: Receipt,
      label:
        fiscalDoc.environment === "homologation"
          ? "✔ NF-e de homologação autorizada"
          : "✔ NF-e autorizada",
      at: fiscalDoc.protocolAt ?? fiscalDoc.updatedAt,
      tone: "text-success",
      detail: [
        `NF-e nº ${fiscalDoc.number ?? "—"}`,
        `Série ${fiscalDoc.series ?? 1}`,
        fiscalDoc.accessKey ? `Chave ${formatAccessKey(fiscalDoc.accessKey)}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    });
  }
  if (fiscalDoc && fiscalBadge.key === "cancelled") {
    events.push({
      icon: Ban,
      label: "NF-e cancelada",
      at: fiscalDoc.cancelledAt ?? fiscalDoc.updatedAt,
      tone: "text-destructive",
      detail: fiscalDoc.cancellationReason ?? undefined,
    });
  }

  if (fiscalDoc && (fiscalBadge.key === "error" || fiscalBadge.key === "rejected")) {
    events.push({
      icon: Ban,
      label: "Erro na emissão da NF-e",
      at: fiscalDoc.updatedAt,
      tone: "text-destructive",
      detail: fiscalDoc.rejectionReason ?? undefined,
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
              {ev.detail ? (
                <p className="mt-0.5 break-all font-mono text-xs text-muted-foreground">
                  {ev.detail}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
