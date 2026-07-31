import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { SupplierForm } from "@/features/suppliers";
import {
  ArrowLeft,
  Pencil,
  Truck,
  Mail,
  Phone,
  Globe,
  MapPin,
  Package,
  ShoppingCart,
  CalendarClock,
  FileText,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/layout/empty-state";
import {
  SupplierStatusBadge,
  useSupplier,
  useSupplierProducts,
  useSupplierPurchases,
  useSupplierTimeline,
  PAYMENT_TERM_OPTIONS,
} from "@/features/suppliers";
import { formatDate, formatDateTime, formatCurrency, formatNumber } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/fornecedores_/$supplierId")({
  beforeLoad: requirePermission("suppliers.view"),
  component: SupplierDetailPage,
});

function formatDoc(doc: string | null | undefined) {
  if (!doc) return "—";
  const d = doc.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (d.length === 14) return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
}

function formatPhone(phone: string | null | undefined) {
  if (!phone) return "—";
  const d = phone.replace(/\D/g, "");
  if (d.length === 11) return d.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (d.length === 10) return d.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return phone;
}

function formatCep(cep: string | null | undefined) {
  if (!cep) return "—";
  const d = cep.replace(/\D/g, "");
  if (d.length === 8) return d.replace(/(\d{5})(\d{3})/, "$1-$2");
  return cep;
}

const PURCHASE_STATUS: Record<string, { label: string; tone: string }> = {
  draft: { label: "Rascunho", tone: "bg-muted text-muted-foreground" },
  pending: { label: "Pendente", tone: "bg-warning/15 text-warning" },
  received: { label: "Recebida", tone: "bg-success/15 text-success" },
  cancelled: { label: "Cancelada", tone: "bg-destructive/10 text-destructive" },
};

function SupplierDetailPage() {
  const { supplierId } = Route.useParams();
  const { company } = Route.useRouteContext();
  const { data: supplier, isLoading } = useSupplier(supplierId);
  const [editOpen, setEditOpen] = useState(false);
  const { data: products = [] } = useSupplierProducts(supplierId);
  const { data: purchases = [] } = useSupplierPurchases(supplierId);
  const { data: timeline = [] } = useSupplierTimeline(supplier ?? null);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!supplier) throw notFound();

  const paymentLabel =
    PAYMENT_TERM_OPTIONS.find((p) => p.value === supplier.payment_terms)?.label ??
    supplier.payment_terms ??
    "—";

  const fullAddress = [
    [supplier.address, supplier.number].filter(Boolean).join(", "),
    supplier.complement,
    supplier.neighborhood,
    [supplier.city, supplier.state].filter(Boolean).join(" / "),
    formatCep(supplier.zip),
  ]
    .filter((s) => s && s !== "—")
    .join(" • ");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/fornecedores">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Fornecedores
          </Link>
        </Button>
        <Button onClick={() => setEditOpen(true)}>
          <Pencil className="mr-1.5 h-4 w-4" /> Editar
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-accent">
              <Truck className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                {supplier.legal_name || "Fornecedor"}
              </p>
              <h1 className="text-2xl font-semibold tracking-tight">
                {supplier.name}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                {supplier.document ? (
                  <span className="font-mono text-xs">{formatDoc(supplier.document)}</span>
                ) : null}
                {fullAddress ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {fullAddress}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <SupplierStatusBadge status={supplier.status} />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <QuickInfo icon={<Phone className="h-4 w-4" />} label="Telefone" value={formatPhone(supplier.phone)} />
          <QuickInfo icon={<Mail className="h-4 w-4" />} label="E-mail" value={supplier.email} />
          <QuickInfo icon={<Globe className="h-4 w-4" />} label="Site" value={supplier.website} />
          <QuickInfo
            icon={<ShoppingCart className="h-4 w-4" />}
            label="Total comprado"
            value={
              supplier.total_purchased > 0
                ? formatCurrency(supplier.total_purchased)
                : "—"
            }
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Metric icon={<Package className="h-4 w-4" />} label="Produtos" value={String(supplier.products_count)} />
          <Metric icon={<ShoppingCart className="h-4 w-4" />} label="Pedidos" value={String(supplier.purchases_count)} />
          <Metric
            icon={<CalendarClock className="h-4 w-4" />}
            label="Última compra"
            value={supplier.last_purchase_at ? formatDate(supplier.last_purchase_at) : "—"}
          />
          <Metric
            icon={<Clock className="h-4 w-4" />}
            label="Prazo médio"
            value={supplier.delivery_days != null ? `${supplier.delivery_days} dias` : "—"}
          />
        </div>
      </div>

      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Dados</TabsTrigger>
          <TabsTrigger value="contact">Contato</TabsTrigger>
          <TabsTrigger value="address">Endereço</TabsTrigger>
          <TabsTrigger value="purchases">Compras</TabsTrigger>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4 space-y-4">
          <Card title="Identificação">
            <Row label="Razão social" value={supplier.legal_name ?? "—"} />
            <Row label="Nome fantasia" value={supplier.name} />
            <Row label="CNPJ / CPF" value={formatDoc(supplier.document)} mono />
            <Row label="Inscrição estadual" value={supplier.state_registration ?? "—"} />
            <Row label="Inscrição municipal" value={supplier.municipal_registration ?? "—"} />
            <Row label="Status" value={supplier.status} />
          </Card>
          <Card title="Comercial">
            <Row label="Condição de pagamento" value={paymentLabel} />
            <Row
              label="Prazo médio de entrega"
              value={
                supplier.delivery_days != null
                  ? `${supplier.delivery_days} dias`
                  : "—"
              }
            />
          </Card>
          <Card title="Histórico do cadastro">
            <Row label="Cadastrado em" value={formatDateTime(supplier.created_at)} />
            <Row label="Última atualização" value={formatDateTime(supplier.updated_at)} />
          </Card>
          {supplier.notes ? (
            <Card title="Anotações">
              <p className="whitespace-pre-wrap p-4 text-sm">{supplier.notes}</p>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="contact" className="mt-4">
          <Card title="Contato">
            <Row label="Responsável" value={supplier.contact_name ?? "—"} />
            <Row label="Telefone" value={formatPhone(supplier.phone)} />
            <Row label="WhatsApp" value={formatPhone(supplier.whatsapp)} />
            <Row label="E-mail" value={supplier.email ?? "—"} />
            <Row label="Site" value={supplier.website ?? "—"} />
          </Card>
        </TabsContent>

        <TabsContent value="address" className="mt-4">
          <Card title="Endereço">
            <Row label="CEP" value={formatCep(supplier.zip)} mono />
            <Row label="Rua" value={supplier.address ?? "—"} />
            <Row label="Número" value={supplier.number ?? "—"} />
            <Row label="Complemento" value={supplier.complement ?? "—"} />
            <Row label="Bairro" value={supplier.neighborhood ?? "—"} />
            <Row label="Cidade" value={supplier.city ?? "—"} />
            <Row label="Estado" value={supplier.state ?? "—"} />
          </Card>
        </TabsContent>

        <TabsContent value="purchases" className="mt-4">
          <Card title={`Histórico de compras (${purchases.length})`}>
            {purchases.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="Nenhuma compra registrada"
                description="As compras vinculadas a este fornecedor aparecerão aqui."
                className="border-0 bg-transparent py-10"
              />
            ) : (
              <div className="divide-y divide-border">
                {purchases.map((p) => {
                  const st = PURCHASE_STATUS[p.status] ?? {
                    label: p.status,
                    tone: "bg-muted text-muted-foreground",
                  };
                  return (
                    <Link
                      key={p.id}
                      to="/compras/$purchaseId"
                      params={{ purchaseId: p.id }}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-accent/50"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">#{p.number}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(p.purchase_date)}
                            {p.received_at
                              ? ` • recebida ${formatDate(p.received_at)}`
                              : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <Badge className={st.tone} variant="secondary">
                          {st.label}
                        </Badge>
                        <span className="tabular-nums font-medium">
                          {formatCurrency(p.grand_total)}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <Card title={`Produtos fornecidos (${supplier.products_count})`}>
            {products.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Nenhum produto vinculado"
                description="Os produtos deste fornecedor aparecerão aqui."
                className="border-0 bg-transparent py-10"
              />
            ) : (
              <div className="divide-y divide-border">
                {products.map((p) => (
                  <Link
                    key={p.id}
                    to="/produtos/$productId"
                    params={{ productId: p.id }}
                    className="flex items-center justify-between px-4 py-3 hover:bg-accent/50"
                  >
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {p.sku ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="tabular-nums">
                        {formatCurrency(Number(p.price))}
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatNumber(Number(p.stock))} un
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card title="Linha do tempo">
            {timeline.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="Nenhum evento ainda"
                description="A linha do tempo mostrará interações e atualizações deste fornecedor."
                className="border-0 bg-transparent py-10"
              />
            ) : (
              <ol className="space-y-4 p-5">
                {timeline.map((ev) => (
                  <li key={ev.id} className="flex gap-3">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div>
                      <p className="text-sm font-medium">{ev.title}</p>
                      {ev.description ? (
                        <p className="text-xs text-muted-foreground">
                          {ev.description}
                        </p>
                      ) : null}
                      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {formatDateTime(ev.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-6 sm:max-w-2xl"
        >
          <SheetHeader className="mb-4">
            <SheetTitle>Editar fornecedor</SheetTitle>
            <SheetDescription>{supplier.name}</SheetDescription>
          </SheetHeader>
          <SupplierForm
            companyId={company.id}
            supplier={supplier}
            variant="dialog"
            onCancel={() => setEditOpen(false)}
            onSaved={() => setEditOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

function QuickInfo({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background/40 p-3">
      <div className="text-muted-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm">{value || "—"}</p>
      </div>
    </div>
  );
}

function Metric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span className="uppercase tracking-wider text-[11px]">{label}</span>
      </div>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">
        {title}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
