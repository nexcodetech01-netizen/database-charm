import { memo } from "react";
import { Copy, ExternalLink, Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { buildLinkMessage, copyToClipboard, openWhatsApp } from "../../lib/checkout-messages";
import type { CheckoutMethod } from "../../types";
import { isChargeReceived, type ChargeRow } from "./types";

const NO_PHONE_TOOLTIP = "Cliente sem WhatsApp cadastrado";

interface ChargeViewProps {
  charge: ChargeRow;
  method: CheckoutMethod;
  amount: number;
  customerName: string | null;
  /** Reservado para mensagens com o nome da loja. */
  companyName: string | null;
  whatsappNumber: string | null;
}

/** Estado de uma cobrança Bella Pay (Asaas) já gerada: status + ações do link. */
export const ChargeView = memo(function ChargeView({
  charge,
  method,
  amount,
  customerName,
  whatsappNumber,
}: ChargeViewProps) {
  const link = charge.invoice_url ?? charge.payment_link ?? null;
  const received = isChargeReceived(charge.status);
  const showsLink = method === "payment_link" || method === "credit_card";
  const linkMessage =
    showsLink && link ? buildLinkMessage({ customerName, amount, paymentLink: link }) : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <StatusPill status={charge.status} />
        {!received ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Aguardando confirmação…
          </span>
        ) : null}
      </div>

      {showsLink ? (
        link ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" asChild>
              <a href={link} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir Link
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(link, "Link copiado")}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar Link
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!whatsappNumber || !linkMessage}
              title={!whatsappNumber ? NO_PHONE_TOOLTIP : undefined}
              onClick={() => {
                if (whatsappNumber && linkMessage) openWhatsApp(whatsappNumber, linkMessage);
              }}
            >
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
              Compartilhar WhatsApp
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!linkMessage}
              onClick={() => {
                if (linkMessage) copyToClipboard(linkMessage, "Mensagem copiada");
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar Mensagem
            </Button>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">Link ainda não disponível.</div>
        )
      ) : null}
    </div>
  );
});

export function StatusPill({ status }: { status: string }) {
  const normalized = String(status).toUpperCase();
  const received = isChargeReceived(normalized);
  const overdue = normalized === "OVERDUE";
  const canceled = normalized === "CANCELED" || normalized === "REFUNDED";
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-[10px]",
        received && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
        overdue && "border-amber-500/40 bg-amber-500/10 text-amber-600",
        canceled && "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      {normalized}
    </Badge>
  );
}
