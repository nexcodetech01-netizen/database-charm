import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Inbox, MessageCircle, MoreVertical, Phone, Package } from "lucide-react";
import { requirePermission } from "@/features/rbac";
import { usePermissions } from "@/features/rbac/hooks/use-permissions";
import { PageHeader } from "@/components/layout";
import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import { EmptyState } from "@/components/layout/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  COMMERCIAL_INBOX_STATUS,
  COMMERCIAL_STATUS_LABEL,
  FULFILLMENT_LABEL,
  PAYMENT_LABEL,
  formatDeliveryLine,
} from "@/features/whatsapp/inbound/commercial-inbox";
import {
  useCommercialInbox,
  useCommercialInboxDetail,
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

/**
 * Cores por status, ligadas ao tema "Ametista Noturna" do NexOS —
 * aguardando usa o dourado champanhe de destaque (chama atenção,
 * precisa de ação), atendido fica neutro (já foi visto), convertido
 * em verde (venda concluída), cancelado apagado (morto, baixa
 * prioridade visual).
 */
const STATUS_STYLE: Record<string, string> = {
  [COMMERCIAL_INBOX_STATUS.waiting]:
    "bg-[#E5A855]/15 text-[#E5A855] ring-1 ring-inset ring-[#E5A855]/30",
  [COMMERCIAL_INBOX_STATUS.attended]:
    "bg-slate-400/15 text-slate-300 ring-1 ring-inset ring-slate-400/25",
  [COMMERCIAL_INBOX_STATUS.converted]:
    "bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30",
  [COMMERCIAL_INBOX_STATUS.cancelled]:
    "bg-muted text-muted-foreground ring-1 ring-inset ring-border",
};

function StatusPill({ status }: { status: string }) {
  const label = (COMMERCIAL_STATUS_LABEL as Record<string, string>)[status] ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        STATUS_STYLE[status] ?? STATUS_STYLE[COMMERCIAL_INBOX_STATUS.cancelled],
      )}
    >
      {label}
    </span>
  );
}

/** Iniciais do nome (até 2 letras) pro avatar quando não há foto. */
function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Telefone brasileiro formatado: 55 14 99625-0549 → (14) 99625-0549. */
function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  const local = digits.length > 11 && digits.startsWith("55") ? digits.slice(2) : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return raw;
}

/** Data relativa amigável — "Hoje 12:34", "Ontem 13:52", ou completa se mais antiga. */
function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  if (isSameDay(date, now)) return `Hoje, ${time}`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return `Ontem, ${time}`;

  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) + `, ${time}`;
}

function CommercialInboxPage() {
  const perms = usePermissions();
  const companyId = perms.companyId ?? null;
  const [page, setPage] = useState(1);
  const { data, isLoading } = useCommercialInbox(companyId, page);
  useCommercialInboxRealtime(companyId);
  const updateStatus = useUpdateCommercialInboxStatus();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: selectedDetail } = useCommercialInboxDetail(selectedId);
  const selected = selectedDetail ?? null;

  const tickets = useMemo(() => data?.rows ?? [], [data]);
  const total = data?.total ?? 0;
  const pageSize = 50;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="space-y-6">
      <BreadcrumbNav />

      <PageHeader
        title="Inbox WhatsApp"
        description="Atendimentos encaminhados pela Bella. Nenhuma venda é criada automaticamente."
      />

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : tickets.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title="Nenhum atendimento"
            description="Quando um cliente confirmar o pedido no WhatsApp, ele aparece aqui."
          />
        ) : (
          <div className="divide-y divide-border">
            {tickets.map((t: CommercialInboxTicket) => (
              <div
                key={t.id}
                className="flex flex-col gap-3 p-4 transition-colors hover:bg-muted/40 sm:flex-row sm:items-center sm:gap-4"
              >
                {/* Identidade do cliente */}
                <div className="flex min-w-0 items-center gap-3 sm:w-56 sm:shrink-0">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-[#B392E0]/15 text-sm font-semibold text-[#B392E0]">
                      {initials(t.buyer_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.buyer_name ?? "Sem nome"}</p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      {formatPhone(t.phone)}
                    </p>
                  </div>
                </div>

                {/* Itens, total, origem, data — agrupados numa linha só no mobile */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground sm:flex-1 sm:flex-nowrap">
                  <span className="flex items-center gap-1.5 sm:w-20 sm:shrink-0">
                    <Package className="h-3.5 w-3.5" />
                    {t.item_count} {t.item_count === 1 ? "item" : "itens"}
                  </span>
                  <span className="text-sm font-semibold text-foreground sm:w-28 sm:shrink-0">
                    {money(Number(t.total))}
                  </span>
                  <span className="flex items-center gap-1.5 text-emerald-500 sm:w-28 sm:shrink-0">
                    <MessageCircle className="h-3.5 w-3.5" />
                    WhatsApp
                  </span>
                  <span className="sm:w-32 sm:shrink-0">{formatRelativeDate(t.created_at)}</span>
                </div>

                {/* Status */}
                <div className="sm:w-40 sm:shrink-0">
                  <StatusPill status={t.status} />
                </div>

                {/* Ações: CTA principal visível, secundárias num menu */}
                <div className="flex items-center gap-2 sm:ml-auto sm:shrink-0">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedId(t.id)}>
                    Abrir
                  </Button>
                  {isConverted(t) && t.sale_id ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/vendas/$saleId" params={{ saleId: t.sale_id }}>
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
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label="Mais ações"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        disabled={
                          t.status !== COMMERCIAL_INBOX_STATUS.waiting || updateStatus.isPending
                        }
                        onClick={() =>
                          updateStatus.mutate({
                            id: t.id,
                            status: COMMERCIAL_INBOX_STATUS.attended,
                          })
                        }
                      >
                        Marcar atendido
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        disabled={
                          t.status !== COMMERCIAL_INBOX_STATUS.waiting || updateStatus.isPending
                        }
                        onClick={() =>
                          updateStatus.mutate({
                            id: t.id,
                            status: COMMERCIAL_INBOX_STATUS.cancelled,
                          })
                        }
                      >
                        Cancelar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-muted-foreground">
              Mostrando {tickets.length} de {total} atendimentos
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Anterior
              </Button>
              <span className="text-sm font-medium">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={Boolean(selectedId)} onOpenChange={(o) => !o && setSelectedId(null)}>
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
          ) : selectedId ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Carregando…</div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
