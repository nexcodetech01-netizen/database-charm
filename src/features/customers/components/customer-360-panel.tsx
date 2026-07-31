import { Link } from "@tanstack/react-router";
import {
  Award,
  Cake,
  Package,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { useCustomer360 } from "../hooks/use-customers";
import type {
  Customer360Alert,
  Customer360TimelineItem,
} from "../services/customer-360.service";

const PAYMENT_LABEL: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  credit_card: "Cartão de Crédito",
  debit_card: "Cartão de Débito",
  boleto: "Boleto",
  link: "Link de pagamento",
  transfer: "Transferência",
};

function AlertBadge({ alert }: { alert: Customer360Alert }) {
  const toneMap: Record<Customer360Alert["tone"], string> = {
    info: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
    success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
    danger: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
  };
  const iconMap: Record<Customer360Alert["code"], typeof Sparkles> = {
    new: Sparkles,
    vip: Award,
    inactive_30: TrendingDown,
    inactive_60: TrendingDown,
    inactive_90: TrendingDown,
    birthday_month: Cake,
  };
  const Icon = iconMap[alert.code];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${toneMap[alert.tone]}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {alert.label}
    </span>
  );
}

function KpiTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function TimelineIcon({ kind }: { kind: Customer360TimelineItem["kind"] }) {
  if (kind === "sale")
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ShoppingBag className="h-4 w-4" />
      </span>
    );
  if (kind === "payment")
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
        <ReceiptText className="h-4 w-4" />
      </span>
    );
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/10 text-amber-600">
      <RotateCcw className="h-4 w-4" />
    </span>
  );
}

export function Customer360Panel({ customerId }: { customerId: string }) {
  const { data, isLoading } = useCustomer360(customerId);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
        Sem dados 360 para este cliente.
      </div>
    );
  }

  const preferred = data.preferredPaymentMethod
    ? (PAYMENT_LABEL[data.preferredPaymentMethod] ?? data.preferredPaymentMethod)
    : "—";

  return (
    <div className="space-y-6">
      {data.alerts.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {data.alerts.map((a) => (
            <AlertBadge key={a.code} alert={a} />
          ))}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiTile
          label="Total gasto"
          value={formatCurrency(data.totalSpent)}
          hint={`${data.paidCount} venda(s) paga(s)`}
        />
        <KpiTile
          label="Ticket médio"
          value={formatCurrency(data.averageTicket)}
        />
        <KpiTile
          label="Compras"
          value={String(data.purchaseCount)}
          hint={data.firstPurchaseAt ? `Desde ${formatDate(data.firstPurchaseAt)}` : undefined}
        />
        <KpiTile
          label="Última compra"
          value={data.lastPurchaseAt ? formatDate(data.lastPurchaseAt) : "—"}
          hint={
            data.daysSinceLast !== null
              ? `Há ${data.daysSinceLast} dia(s)`
              : "Sem histórico"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Wallet className="h-4 w-4 text-muted-foreground" /> Forma preferida
          </h3>
          <p className="mt-3 text-lg font-semibold">{preferred}</p>
          <p className="text-xs text-muted-foreground">
            Baseado nas vendas pagas
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 lg:col-span-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Package className="h-4 w-4 text-muted-foreground" /> Produtos mais comprados
          </h3>
          {data.topProducts.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">Sem itens registrados.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {data.topProducts.map((p) => (
                <li
                  key={p.product_id ?? p.description}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate">{p.description}</span>
                  <span className="whitespace-nowrap text-muted-foreground">
                    {p.quantity.toLocaleString("pt-BR")} un · {formatCurrency(p.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">Categorias favoritas</h3>
        {data.topCategories.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Sem categorias registradas.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {data.topCategories.map((c) => (
              <Badge key={c.category_id ?? c.name} variant="secondary" className="gap-1.5">
                {c.name}
                <span className="text-muted-foreground">· {formatCurrency(c.total)}</span>
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold text-foreground">Histórico</h3>
        {data.timeline.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum evento registrado.</p>
        ) : (
          <ol className="mt-4 space-y-4">
            {data.timeline.map((ev) => (
              <li key={ev.id} className="flex items-start gap-3">
                <TimelineIcon kind={ev.kind} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {ev.sale_id && ev.kind !== "return" ? (
                        <Link
                          to="/vendas/$saleId"
                          params={{ saleId: ev.sale_id }}
                          className="hover:underline"
                        >
                          {ev.title}
                        </Link>
                      ) : (
                        ev.title
                      )}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(ev.occurred_at)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {ev.status ? <Badge variant="outline">{ev.status}</Badge> : null}
                    {ev.description ? <span>{ev.description}</span> : null}
                    {ev.amount !== null ? (
                      <span className="ml-auto font-medium text-foreground">
                        {formatCurrency(ev.amount)}
                      </span>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
