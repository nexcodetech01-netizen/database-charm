import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Receipt,
  User,
  ShoppingCart,
  XCircle,
  Link as LinkIcon,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatCurrency } from "@/lib/format";
import { useSale } from "@/features/sales/hooks/use-sales";
import type { BellaPayChargeWithMeta } from "../types";

interface Props {
  charge: BellaPayChargeWithMeta | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const statusMeta: Record<
  string,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  PENDING: {
    label: "Pendente",
    className: "bg-warning/10 text-warning border-warning/20",
    icon: Clock,
  },
  AWAITING_RISK_ANALYSIS: {
    label: "Em análise",
    className: "bg-warning/10 text-warning border-warning/20",
    icon: Clock,
  },
  CONFIRMED: {
    label: "Confirmado",
    className: "bg-success/10 text-success border-success/20",
    icon: CheckCircle2,
  },
  RECEIVED: {
    label: "Recebido",
    className: "bg-success/10 text-success border-success/20",
    icon: CheckCircle2,
  },
  OVERDUE: {
    label: "Vencido",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    icon: AlertTriangle,
  },
  REFUNDED: {
    label: "Estornado",
    className: "bg-muted text-muted-foreground",
    icon: XCircle,
  },
  CANCELED: {
    label: "Cancelado",
    className: "bg-muted text-muted-foreground",
    icon: XCircle,
  },
};

const billingLabel: Record<string, string> = {
  PIX: "PIX",
  CREDIT_CARD: "Cartão de crédito",
  UNDEFINED: "Link de pagamento",
};

function fmtDate(d: string | null) {
  if (!d) return "—";
  try {
    return format(new Date(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return d;
  }
}

export function ChargeDetailDialog({ charge, open, onOpenChange }: Props) {
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const saleQuery = useSale(charge?.sale_id ?? "");

  const meta = useMemo(() => {
    if (!charge) return null;
    return statusMeta[charge.status] ?? {
      label: charge.status,
      className: "bg-muted text-muted-foreground",
      icon: Clock,
    };
  }, [charge]);

  if (!charge || !meta) return null;

  const Icon = meta.icon;
  const isPaid = ["RECEIVED", "CONFIRMED"].includes(charge.status);
  const isCanceled = ["CANCELED", "REFUNDED"].includes(charge.status);
  const isOverdue = charge.status === "OVERDUE";
  const qrImage = charge.pix_qr_code
    ? charge.pix_qr_code.startsWith("data:")
      ? charge.pix_qr_code
      : `data:image/png;base64,${charge.pix_qr_code}`
    : null;

  async function copy(value: string, field: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success(`${label} copiado`);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  }

  const timeline: {
    label: string;
    date: string | null;
    tone: "primary" | "success" | "danger" | "warning" | "muted";
  }[] = [
    { label: "Cobrança criada", date: charge.created_at, tone: "primary" },
    {
      label: "Vencimento",
      date: charge.due_date,
      tone: isOverdue ? "warning" : "muted",
    },
  ];
  if (isPaid) {
    timeline.push({
      label: "Pagamento confirmado",
      date: charge.paid_at ?? charge.updated_at,
      tone: "success",
    });
  }
  if (isOverdue) {
    timeline.push({ label: "Cobrança vencida", date: charge.due_date, tone: "warning" });
  }
  if (isCanceled) {
    timeline.push({
      label: charge.status === "REFUNDED" ? "Cobrança estornada" : "Cobrança cancelada",
      date: charge.canceled_at ?? charge.updated_at,
      tone: "danger",
    });
  }

  const toneToClass: Record<string, string> = {
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-destructive",
    muted: "bg-muted",
  };

  const saleItems = saleQuery.data?.items ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-muted-foreground" />
            Cobrança Bella Pay
          </DialogTitle>
          <DialogDescription>
            {billingLabel[charge.billing_type] ?? charge.billing_type} ·{" "}
            {charge.customer_name ?? "Cliente não vinculado"}
          </DialogDescription>
        </DialogHeader>

        {isPaid ? (
          <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success/5 p-3 text-sm">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
            <div>
              <p className="font-medium text-success">Pagamento confirmado</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Recebido em {fmtDate(charge.paid_at)}.
              </p>
            </div>
          </div>
        ) : isOverdue ? (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Cobrança vencida</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Vencimento em{" "}
                {format(new Date(charge.due_date), "dd/MM/yyyy", { locale: ptBR })}.
              </p>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Valor</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatCurrency(Number(charge.value))}
            </p>
            {charge.net_value != null ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Líquido: {formatCurrency(Number(charge.net_value))}
              </p>
            ) : null}
          </div>
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className={meta.className}>
                <Icon className="mr-1 h-3.5 w-3.5" />
                {meta.label}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Vencimento: {format(new Date(charge.due_date), "dd/MM/yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-border p-3 text-sm">
          <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Vinculações
          </p>
          <div className="space-y-1.5">
            <InfoRow
              icon={User}
              label="Cliente"
              value={charge.customer_name ?? "—"}
            />
            <InfoRow
              icon={ShoppingCart}
              label="Venda"
              value={charge.sale_number != null ? `#${charge.sale_number}` : "—"}
            />
            {charge.description ? (
              <div className="pt-1 text-xs text-muted-foreground">{charge.description}</div>
            ) : null}
          </div>
        </div>

        {charge.sale_id ? (
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Itens da venda
            </p>
            {saleQuery.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : saleItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum item registrado.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {saleItems.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-center justify-between gap-3 border-b border-border/60 pb-1.5 last:border-0 last:pb-0"
                  >
                    <span className="flex-1 truncate">
                      <span className="text-muted-foreground">{it.quantity}×</span>{" "}
                      {it.description ?? "Item"}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {formatCurrency(Number(it.unit_price) * Number(it.quantity))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {charge.billing_type === "PIX" && (qrImage || charge.pix_payload) && !isPaid ? (
          <div className="rounded-lg border border-border p-4">
            <p className="mb-3 text-sm font-medium">Pague via PIX</p>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              {qrImage ? (
                <img
                  src={qrImage}
                  alt="QR Code PIX"
                  className="h-40 w-40 rounded-md border border-border bg-white p-2"
                />
              ) : null}
              <div className="flex-1 space-y-2">
                {charge.pix_payload ? (
                  <>
                    <p className="text-xs text-muted-foreground">Código copia e cola:</p>
                    <div className="break-all rounded-md border border-border bg-muted/40 p-2 font-mono text-[11px]">
                      {charge.pix_payload}
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => copy(charge.pix_payload!, "pix", "Código PIX")}
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      {copiedField === "pix" ? "Copiado!" : "Copiar código"}
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        {charge.invoice_url && charge.billing_type !== "PIX" && !isPaid ? (
          <div className="rounded-lg border border-border p-4">
            <p className="mb-2 text-sm font-medium">Link de pagamento</p>
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
              <LinkIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate flex-1 font-mono text-xs">{charge.invoice_url}</span>
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copy(charge.invoice_url!, "link", "Link")}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                {copiedField === "link" ? "Copiado!" : "Copiar"}
              </Button>
              <Button type="button" size="sm" variant="outline" asChild>
                <a href={charge.invoice_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Abrir
                </a>
              </Button>
            </div>
          </div>
        ) : null}

        <div className="rounded-lg border border-border p-3">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Timeline
          </p>
          <ol className="space-y-3">
            {timeline.map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <div
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${toneToClass[step.tone]}`}
                />
                <div className="flex-1">
                  <p className="font-medium">{step.label}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(step.date)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <Separator />

        <DialogFooter className="gap-2 sm:justify-between">
          {charge.invoice_url ? (
            <Button variant="outline" asChild>
              <a href={charge.invoice_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" />
                Abrir fatura
              </a>
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className="text-right">{value}</span>
    </div>
  );
}
