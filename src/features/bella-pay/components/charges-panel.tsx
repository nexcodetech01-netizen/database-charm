import { useEffect, useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Eye,
  ExternalLink,
  Plus,
  X,
  Search,
  Receipt,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Percent,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatCurrency } from "@/lib/format";
import {
  useBellaPayCharges,
  useBellaPayMetrics,
  useCancelAsaasCharge,
} from "../hooks/use-bella-pay";
import { ChargeFormDialog } from "./charge-form-dialog";
import { ChargeDetailDialog } from "./charge-detail-dialog";
import type { BellaPayChargeWithMeta } from "../types";

interface Props {
  companyId: string;
}

type StatusFilter = "all" | "open" | "received" | "overdue" | "canceled";

const statusMeta: Record<
  string,
  { label: string; className: string }
> = {
  PENDING: { label: "Pendente", className: "bg-warning/10 text-warning border-warning/20" },
  AWAITING_RISK_ANALYSIS: {
    label: "Em análise",
    className: "bg-warning/10 text-warning border-warning/20",
  },
  CONFIRMED: {
    label: "Confirmado",
    className: "bg-success/10 text-success border-success/20",
  },
  RECEIVED: {
    label: "Recebido",
    className: "bg-success/10 text-success border-success/20",
  },
  OVERDUE: {
    label: "Vencido",
    className: "bg-destructive/10 text-destructive border-destructive/20",
  },
  REFUNDED: { label: "Estornado", className: "bg-muted text-muted-foreground" },
  CANCELED: { label: "Cancelado", className: "bg-muted text-muted-foreground" },
};

const billingLabel: Record<string, string> = {
  PIX: "PIX",
  CREDIT_CARD: "Cartão",
  UNDEFINED: "Link",
};

const STATUS_GROUPS: Record<StatusFilter, string[]> = {
  all: [],
  open: ["PENDING", "AWAITING_RISK_ANALYSIS"],
  received: ["RECEIVED", "CONFIRMED"],
  overdue: ["OVERDUE"],
  canceled: ["CANCELED", "REFUNDED"],
};

export function ChargesPanel({ companyId }: Props) {
  const { data: charges = [], isLoading } = useBellaPayCharges(companyId);
  const { data: metrics } = useBellaPayMetrics(companyId);
  const cancel = useCancelAsaasCharge(companyId);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [autoOpenLatest, setAutoOpenLatest] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const debouncedSearch = useDebouncedValue(search, 300).toLowerCase().trim();

  useEffect(() => {
    if (autoOpenLatest && charges.length > 0) {
      setSelectedId(charges[0].id);
      setAutoOpenLatest(false);
    }
  }, [autoOpenLatest, charges]);

  const filtered = useMemo(() => {
    return charges.filter((c) => {
      if (statusFilter !== "all") {
        const group = STATUS_GROUPS[statusFilter];
        if (!group.includes(c.status)) return false;
      }
      if (!debouncedSearch) return true;
      const haystack = [
        c.customer_name,
        c.description,
        c.sale_number != null ? `#${c.sale_number}` : null,
        billingLabel[c.billing_type] ?? c.billing_type,
        String(c.value),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(debouncedSearch);
    });
  }, [charges, statusFilter, debouncedSearch]);

  const selectedCharge: BellaPayChargeWithMeta | null =
    charges.find((c) => c.id === selectedId) ?? null;

  const conversionPct = metrics ? Math.round(metrics.conversionRate * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Cobranças em aberto"
          value={metrics?.open ?? 0}
          hint={formatCurrency(metrics?.openValue ?? 0)}
          icon={Clock}
          tone="text-warning"
          accent="bg-warning/10"
        />
        <KpiCard
          label="Cobranças pagas"
          value={metrics?.received ?? 0}
          hint={formatCurrency(metrics?.receivedValue ?? 0)}
          icon={CheckCircle2}
          tone="text-success"
          accent="bg-success/10"
        />
        <KpiCard
          label="Cobranças vencidas"
          value={metrics?.overdue ?? 0}
          hint={formatCurrency(metrics?.overdueValue ?? 0)}
          icon={AlertTriangle}
          tone="text-destructive"
          accent="bg-destructive/10"
        />
        <KpiCard
          label="Recebimentos do mês"
          valueText={formatCurrency(metrics?.monthReceivedValue ?? 0)}
          icon={TrendingUp}
          tone="text-primary"
          accent="bg-primary/10"
        />
        <KpiCard
          label="Total em aberto"
          valueText={formatCurrency(metrics?.openValue ?? 0)}
          icon={Wallet}
          tone="text-warning"
          accent="bg-warning/10"
        />
        <KpiCard
          label="Taxa de conversão"
          valueText={`${conversionPct}%`}
          hint={
            metrics?.averagePaymentDays != null
              ? `Pagamento médio em ${metrics.averagePaymentDays.toFixed(1)} dias`
              : undefined
          }
          icon={Percent}
          tone="text-primary"
          accent="bg-primary/10"
        />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border p-4">
          <div>
            <h2 className="text-base font-semibold">Cobranças</h2>
            <p className="text-sm text-muted-foreground">
              Todas as cobranças geradas via Asaas.
            </p>
          </div>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Nova cobrança
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 border-b border-border p-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por cliente, venda, descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas · Status</SelectItem>
              <SelectItem value="open">Em aberto</SelectItem>
              <SelectItem value="received">Recebidas</SelectItem>
              <SelectItem value="overdue">Vencidas</SelectItem>
              <SelectItem value="canceled">Canceladas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Venda</TableHead>
                <TableHead>Método</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Criada</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[120px] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-16">
                    <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                      <Receipt className="h-8 w-8" />
                      <p className="font-medium text-foreground">
                        {charges.length === 0
                          ? "Nenhuma cobrança gerada ainda"
                          : "Nenhuma cobrança corresponde ao filtro"}
                      </p>
                      <p className="text-sm">
                        {charges.length === 0
                          ? "Gere sua primeira cobrança via PIX, cartão ou link."
                          : "Ajuste a busca ou o filtro de status."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => {
                  const meta =
                    statusMeta[c.status] ?? {
                      label: c.status,
                      className: "bg-muted text-muted-foreground",
                    };
                  const canCancel = ["PENDING", "AWAITING_RISK_ANALYSIS", "OVERDUE"].includes(
                    c.status,
                  );
                  return (
                    <TableRow
                      key={c.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedId(c.id)}
                    >
                      <TableCell className="font-medium">
                        {c.customer_name ?? (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {c.sale_number != null ? `#${c.sale_number}` : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {billingLabel[c.billing_type] ?? c.billing_type}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(Number(c.value))}
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(c.due_date), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={meta.className}>
                          {meta.label}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setSelectedId(c.id)}
                            title="Ver detalhes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {c.invoice_url && (
                            <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                              <a
                                href={c.invoice_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir fatura"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          )}
                          {canCancel && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => cancel.mutate(c.id)}
                              disabled={cancel.isPending}
                              title="Cancelar"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <ChargeFormDialog
        companyId={companyId}
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setAutoOpenLatest(true);
        }}
      />

      <ChargeDetailDialog
        charge={selectedCharge}
        open={!!selectedCharge}
        onOpenChange={(v) => {
          if (!v) setSelectedId(null);
        }}
      />
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value?: number;
  valueText?: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  accent: string;
}

function KpiCard({ label, value, valueText, hint, icon: Icon, tone, accent }: KpiCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className={`grid h-8 w-8 place-items-center rounded-md ${accent}`}>
          <Icon className={`h-4 w-4 ${tone}`} />
        </div>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums">
        {valueText ?? value ?? 0}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
