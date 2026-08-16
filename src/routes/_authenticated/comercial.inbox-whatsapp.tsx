import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Inbox } from "lucide-react";
import { requirePermission } from "@/features/rbac";
import { usePermissions } from "@/features/rbac/hooks/use-permissions";
import { PageHeader } from "@/components/layout";
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import { EmptyState } from "@/components/layout/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  COMMERCIAL_INBOX_STATUS,
  COMMERCIAL_STATUS_LABEL,
  FULFILLMENT_LABEL,
  PAYMENT_LABEL,
  formatDeliveryLine,
} from "@/features/whatsapp/inbound/commercial-inbox";
import {
  useCommercialInbox,
  useUpdateCommercialInboxStatus,
  type CommercialInboxTicket,
} from "@/features/whatsapp/hooks/use-commercial-inbox";
import { useCommercialInboxRealtime } from "@/features/whatsapp/hooks/use-commercial-inbox-realtime";
import {
  canConvert,
  isConverted,
} from "@/features/whatsapp/inbound/inbox-conversion";

export const Route = createFileRoute("/_authenticated/comercial/inbox-whatsapp")({
  beforeLoad: requirePermission("sales.view"),
  component: CommercialInboxPage,
  head: () => ({
    meta: [
      { title: "Inbox WhatsApp | NexOS Comercial" },
      {
        name: "description",
        content:
          "Atendimentos comerciais recebidos pelo WhatsApp: itens, total, entrega e status.",
      },
      { property: "og:title", content: "Inbox WhatsApp | NexOS Comercial" },
      {
        property: "og:description",
        content: "Acompanhe os pedidos encaminhados pela Bella no WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function money(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
}

function statusVariant(status: string) {
  if (status === COMMERCIAL_INBOX_STATUS.attended) return "secondary" as const;
  if (status === COMMERCIAL_INBOX_STATUS.converted) return "secondary" as const;
  if (status === COMMERCIAL_INBOX_STATUS.cancelled) return "outline" as const;
  return "default" as const;
}

function CommercialInboxPage() {
  const perms = usePermissions();
  const companyId = perms.companyId ?? null;
  const { data, isLoading } = useCommercialInbox(companyId);
  useCommercialInboxRealtime(companyId);
  const updateStatus = useUpdateCommercialInboxStatus();
  const [selected, setSelected] = useState<CommercialInboxTicket | null>(null);

  const tickets = useMemo(() => data ?? [], [data]);

  return (
    <div className="space-y-6">
      <BreadcrumbNav />

      <PageHeader
        title="Inbox WhatsApp"
        description="Atendimentos encaminhados pela Bella. Nenhuma venda é criada automaticamente."
      />

      <Card className="p-0">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nenhum atendimento"
            description="Quando um cliente confirmar o pedido no WhatsApp, ele aparece aqui."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead className="text-right">Itens</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets.map((t: CommercialInboxTicket) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">
                    {t.buyer_name ?? "—"}
                  </TableCell>
                  <TableCell>{t.phone}</TableCell>
                  <TableCell className="text-right">{t.item_count}</TableCell>
                  <TableCell className="text-right">{money(Number(t.total))}</TableCell>
                  <TableCell>
                    {new Date(t.created_at).toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(t.status)}>
                      {(COMMERCIAL_STATUS_LABEL as Record<string, string>)[t.status] ?? t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="uppercase text-xs text-muted-foreground">
                    {t.origin}
                  </TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    <Button variant="ghost" size="sm" onClick={() => setSelected(t)}>
                      Abrir
                    </Button>
                    {isConverted(t) && t.sale_id ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link
                          to="/vendas/$saleId"
                          params={{ saleId: t.sale_id }}
                        >
                          Abrir venda
                        </Link>
                      </Button>
                    ) : canConvert(t) ? (
                      <Button variant="default" size="sm" asChild>
                        <Link to="/vendas/novo" search={{ inboxId: t.id }}>
                          Converter em venda
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="default" size="sm" disabled>
                        Converter em venda
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={
                        t.status !== COMMERCIAL_INBOX_STATUS.waiting ||
                        updateStatus.isPending
                      }
                      onClick={() =>
                        updateStatus.mutate({
                          id: t.id,
                          status: COMMERCIAL_INBOX_STATUS.attended,
                        })
                      }
                    >
                      Marcar atendido
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={
                        t.status !== COMMERCIAL_INBOX_STATUS.waiting ||
                        updateStatus.isPending
                      }
                      onClick={() =>
                        updateStatus.mutate({
                          id: t.id,
                          status: COMMERCIAL_INBOX_STATUS.cancelled,
                        })
                      }
                    >
                      Cancelar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.buyer_name ?? "Atendimento"}</DialogTitle>
            <DialogDescription>
              {selected?.phone} · {selected ? FULFILLMENT_LABEL[selected.fulfillment] : ""}
            </DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-4 text-sm">
              <section className="space-y-1 rounded-md border p-3">
                <h3 className="font-semibold">Dados do Cliente</h3>
                <p className="text-muted-foreground">
                  Nome: {selected.full_name ?? selected.buyer_name ?? "—"}
                </p>
                <p className="text-muted-foreground">
                  {selected.person_type === "pj" ? "CNPJ" : "CPF"}:{" "}
                  {selected.person_type === "pj"
                    ? (selected.cnpj ?? "—")
                    : (selected.cpf ?? "—")}
                </p>
                <p className="text-muted-foreground">
                  Nascimento:{" "}
                  {selected.birth_date
                    ? new Date(`${selected.birth_date}T00:00:00`).toLocaleDateString("pt-BR")
                    : "—"}
                </p>
                <p className="text-muted-foreground">CEP: {selected.zip_code ?? "—"}</p>
                <p className="text-muted-foreground">
                  Cidade:{" "}
                  {[selected.city, selected.state].filter(Boolean).join("/") || "—"}
                </p>
                <p className="text-muted-foreground">
                  Endereço:{" "}
                  {[
                    [selected.street, selected.number].filter(Boolean).join(", "),
                    selected.complement,
                    selected.district,
                  ]
                    .filter(Boolean)
                    .join(" — ") || "—"}
                </p>
                <p className="text-muted-foreground">
                  Entrega: {FULFILLMENT_LABEL[selected.fulfillment]}
                </p>
                <p className="text-muted-foreground">
                  Pagamento:{" "}
                  {selected.payment
                    ? (PAYMENT_LABEL[selected.payment] ?? selected.payment)
                    : "—"}
                </p>
              </section>
              <ul className="space-y-1">
                {selected.items.map((i) => (
                  <li key={i.productId} className="flex justify-between gap-4">
                    <span>
                      {i.qty}x {i.name}
                    </span>
                    <span>{money(Number(i.subtotal))}</span>
                  </li>
                ))}
              </ul>
              {formatDeliveryLine(selected) ? (
                <p className="text-muted-foreground">
                  Endereço: {formatDeliveryLine(selected)}
                </p>
              ) : null}
              <p className="text-muted-foreground">
                Pagamento:{" "}
                {selected.payment
                  ? (PAYMENT_LABEL[selected.payment] ?? selected.payment)
                  : "—"}
              </p>
              <p className="font-semibold">Total: {money(Number(selected.total))}</p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
