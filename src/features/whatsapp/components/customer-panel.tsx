import { ExternalLink, Receipt, Target, Wallet } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/format";
import type { WhatsAppConversation } from "../types";

export interface CustomerPanelProps {
  conversation: WhatsAppConversation | null;
}

export function CustomerPanel({ conversation }: CustomerPanelProps) {
  if (!conversation) {
    return (
      <div className="flex h-full items-center justify-center border-l border-border bg-card px-6 text-center text-xs text-muted-foreground">
        Selecione uma conversa para ver o painel do cliente.
      </div>
    );
  }

  const { contact } = conversation;
  const initials = contact.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-border bg-card">
      <ScrollArea className="flex-1">
        <div className="space-y-5 p-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <Avatar className="h-14 w-14">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-semibold">{contact.name}</p>
              <p className="text-xs text-muted-foreground">{contact.phone}</p>
              {contact.city ? (
                <p className="text-xs text-muted-foreground">{contact.city}</p>
              ) : null}
            </div>
            {contact.tags && contact.tags.length > 0 ? (
              <div className="flex flex-wrap justify-center gap-1">
                {contact.tags.map((t) => (
                  <Badge key={t} variant="secondary" className="h-4 px-1.5 text-[10px]">
                    {t}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Receipt className="mr-1 h-3 w-3" /> Nova venda
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs">
              <Wallet className="mr-1 h-3 w-3" /> Nova cobrança
            </Button>
            <Button variant="outline" size="sm" className="col-span-2 h-8 text-xs">
              <ExternalLink className="mr-1 h-3 w-3" /> Abrir cliente
            </Button>
          </div>

          <Separator />

          <section aria-labelledby="cust-history" className="space-y-2">
            <h4 id="cust-history" className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Histórico comercial
            </h4>
            <dl className="space-y-1.5 text-xs">
              <Row label="Última compra">
                {contact.lastPurchaseAt
                  ? new Date(contact.lastPurchaseAt).toLocaleDateString("pt-BR")
                  : "—"}
              </Row>
              <Row label="Total comprado">
                {contact.totalPurchasedCents != null
                  ? formatCurrency(contact.totalPurchasedCents / 100)
                  : "—"}
              </Row>
              <Row label="Pedidos">{contact.ordersCount ?? "—"}</Row>
              <Row label="Em aberto (financeiro)">
                {contact.openInvoicesCents != null
                  ? formatCurrency(contact.openInvoicesCents / 100)
                  : "—"}
              </Row>
            </dl>
          </section>

          <Separator />

          <section aria-labelledby="cust-crm" className="space-y-2">
            <h4 id="cust-crm" className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Target className="h-3 w-3" /> CRM
            </h4>
            <p className="text-xs text-muted-foreground">
              {contact.crmStage
                ? `Estágio atual: ${contact.crmStage}`
                : "Cliente ainda não vinculado a um funil."}
            </p>
          </section>
        </div>
      </ScrollArea>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground tabular-nums">{children}</dd>
    </div>
  );
}
