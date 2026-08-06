import { createFileRoute, Link, notFound, Outlet } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import {
  ArrowLeft,
  Pencil,
  ShoppingCart,
  Truck,
  Calendar,
  CreditCard,
  PackageCheck,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/layout/empty-state";
import {
  PurchaseStatusBadge,
  PurchaseTimeline,
  PURCHASE_PAYMENT_TERMS,
  usePurchase,
  useSetPurchaseStatus,
  useReprocessPurchaseReceipt,
} from "@/features/purchases";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/compras_/$purchaseId")({
  beforeLoad: requirePermission("purchases.view"),
  component: PurchaseDetailPage,
});


function PurchaseDetailPage() {
  const { purchaseId } = Route.useParams();
  const isEditing = window.location.pathname.endsWith("/editar");

  if (isEditing) {
    return <Outlet />;
  }


  const { data: purchase, isLoading } = usePurchase(purchaseId);
  const setStatus = useSetPurchaseStatus();
  const reprocess = useReprocessPurchaseReceipt();

  async function receive() {
    if (!purchase) return;
    try {
      await setStatus.mutateAsync({ id: purchase.id, status: "received" });
      toast.success("Compra recebida", {
        description: "Estoque atualizado automaticamente.",
      });
    } catch (err) {
      toast.error("Não foi possível marcar como recebida", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    }
  }

  async function reprocessReceipt() {
    if (!purchase) return;
    try {
      await reprocess.mutateAsync(purchase.id);
      toast.success("Recebimento reprocessado", {
        description: "Produtos criados e estoque atualizado.",
      });
    } catch (err) {
      toast.error("Não foi possível reprocessar", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    }
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!purchase) throw notFound();

  const paymentLabel =
    PURCHASE_PAYMENT_TERMS.find((p) => p.value === purchase.payment_terms)?.label ??
    purchase.payment_terms ??
    "—";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/compras">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Compras
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          {purchase.status !== "received" && purchase.status !== "cancelled" ? (
            <Button
              variant="outline"
              onClick={receive}
              disabled={setStatus.isPending}
            >
              {setStatus.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <PackageCheck className="mr-1.5 h-4 w-4" />
              )}
              Marcar como recebida
            </Button>
          ) : null}
          {purchase.status === "received" && !purchase.stock_applied ? (
            <Button
              variant="outline"
              onClick={reprocessReceipt}
              disabled={reprocess.isPending}
            >
              {reprocess.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              )}
              Reprocessar recebimento
            </Button>
          ) : null}
          <Button asChild>
            <Link
              to="/compras/$purchaseId/editar"
              params={{ purchaseId: purchase.id }}
            >
              <Pencil className="mr-1.5 h-4 w-4" /> Editar
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 place-items-center rounded-lg bg-accent">
              <ShoppingCart className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">
                Compra
              </p>
              <h1 className="font-mono text-2xl font-semibold tracking-tight">
                {purchase.number}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />{" "}
                  {formatDate(purchase.purchase_date)}
                </span>
                {purchase.supplier_name ? (
                  <span className="inline-flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" /> {purchase.supplier_name}
                  </span>
                ) : null}
                {purchase.payment_terms ? (
                  <span className="inline-flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5" /> {paymentLabel}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="text-right">
            <PurchaseStatusBadge status={purchase.status} />
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {formatCurrency(Number(purchase.grand_total))}
            </p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Itens</TabsTrigger>
          <TabsTrigger value="info">Dados</TabsTrigger>
          <TabsTrigger value="costs">Custos</TabsTrigger>
          <TabsTrigger value="timeline">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4">
          <Card title={`Itens (${purchase.items.length})`}>
            {purchase.items.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="Nenhum item registrado nesta compra"
                className="border-0 bg-transparent py-10"
              />
            ) : (
              <div className="divide-y divide-border">
                <div className="grid grid-cols-[1fr_100px_140px_140px] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground">
                  <div>Descrição</div>
                  <div className="text-right">Qtd.</div>
                  <div className="text-right">Valor unit.</div>
                  <div className="text-right">Total</div>
                </div>
                {purchase.items.map((it) => (
                  <div
                    key={it.id}
                    className="grid grid-cols-[1fr_100px_140px_140px] gap-3 px-4 py-3 text-sm"
                  >
                    <div>{it.description}</div>
                    <div className="text-right tabular-nums">
                      {Number(it.quantity)}
                    </div>
                    <div className="text-right tabular-nums">
                      {formatCurrency(Number(it.unit_price))}
                    </div>
                    <div className="text-right tabular-nums font-medium">
                      {formatCurrency(Number(it.total))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="info" className="mt-4 space-y-4">
          <Card title="Identificação">
            <Row label="Número" value={purchase.number} mono />
            <Row label="Fornecedor" value={purchase.supplier_name ?? "—"} />
            <Row label="Data da compra" value={formatDate(purchase.purchase_date)} />
            <Row
              label="Previsão de entrega"
              value={
                purchase.expected_delivery_date
                  ? formatDate(purchase.expected_delivery_date)
                  : "—"
              }
            />
            <Row label="Forma de pagamento" value={paymentLabel} />
          </Card>

          <Card title="Observações">
            {purchase.notes ? (
              <p className="whitespace-pre-wrap p-4 text-sm">{purchase.notes}</p>
            ) : (
              <EmptyState
                title="Nenhuma observação registrada"
                className="border-0 bg-transparent py-10"
              />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="mt-4">
          <Card title="Custos">
            <Row
              label="Subtotal (itens)"
              value={formatCurrency(Number(purchase.items_total))}
            />
            <Row
              label="Desconto"
              value={`- ${formatCurrency(Number(purchase.discount))}`}
            />
            <Row label="Frete" value={formatCurrency(Number(purchase.shipping))} />
            <Row label="Seguro" value={formatCurrency(Number(purchase.insurance))} />
            <Row
              label="Outros custos"
              value={formatCurrency(Number(purchase.other_costs))}
            />
            <Row
              label="Total geral"
              value={formatCurrency(Number(purchase.grand_total))}
              bold
            />
          </Card>

          <div className="mt-4 rounded-xl border border-dashed border-border bg-background/40 p-4 text-xs text-muted-foreground">
            Ao marcar esta compra como{" "}
            <strong className="text-foreground">recebida</strong>, o{" "}
            <strong className="text-foreground">estoque</strong> dos produtos
            vinculados é atualizado automaticamente.
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <PurchaseTimeline purchase={purchase} />
            <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
              Última atualização: {formatDateTime(purchase.updated_at)}
            </div>
          </div>
        </TabsContent>
      </Tabs>
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
  bold,
}: {
  label: string;
  value: string;
  mono?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm ${mono ? "font-mono" : ""} ${bold ? "font-semibold" : ""} tabular-nums`}
      >
        {value}
      </span>
    </div>
  );
}
