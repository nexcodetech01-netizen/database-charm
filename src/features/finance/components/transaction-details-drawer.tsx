import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  CheckCircle2,
  Ban,
  Copy,
  Printer,
  Pencil,
  ExternalLink,
  ShieldCheck,
  Zap,
  Landmark,
  ShoppingCart,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { BellaInlineSuggestion } from "@/features/bella-ai/components/bella-inline-suggestion";
import { MoneyValue } from "@/components/layout/money-value";
import {
  useSetTransactionStatus,
  useReverseTransaction,
  useCreateTransaction,
} from "../hooks/use-finance";
import type {
  TransactionWithMeta,
  TransactionType,
  TransactionSource,
} from "../types";
import { summarize, daysOverdue } from "../lib/receivables";
import { FINANCE_PAYMENT_METHOD_LABEL } from "../types";
import { TransactionStatusBadge } from "./transaction-status-badge";
import { TransactionFormDialog } from "./transaction-form-dialog";
import { SettleTransactionDialog } from "./settle-transaction-dialog";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: TransactionWithMeta | null;
  companyId: string;
}

const SOURCE_META: Record<
  TransactionSource,
  { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }
> = {
  manual: { label: "Manual", icon: ReceiptText, tone: "text-muted-foreground" },
  sale: { label: "Venda", icon: ShoppingCart, tone: "text-primary" },
  purchase: { label: "Compra", icon: Landmark, tone: "text-primary" },
  bella_pay: { label: "Bella Pay", icon: Zap, tone: "text-primary" },
  transfer: { label: "Transferência", icon: ArrowLeftRight, tone: "text-muted-foreground" },
};

const TYPE_ICON: Record<TransactionType, React.ComponentType<{ className?: string }>> = {
  income: ArrowDownRight,
  expense: ArrowUpRight,
  transfer: ArrowLeftRight,
};

const TYPE_TONE: Record<TransactionType, string> = {
  income: "text-success",
  expense: "text-destructive",
  transfer: "text-muted-foreground",
};

export function TransactionDetailsDrawer({
  open,
  onOpenChange,
  transaction,
  companyId,
}: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [settleOpen, setSettleOpen] = useState(false);
  const setStatusMut = useSetTransactionStatus();
  const reverseMut = useReverseTransaction();
  const createMut = useCreateTransaction();

  // FIN-002 — carrega parcelas relacionadas (mesma origem) para
  // compor resumo/saldo/histórico sem tocar service.
  const referenceId = transaction?.reference_id ?? null;
  const { data: siblings } = useQuery({
    queryKey: ["finance", "siblings", referenceId],
    enabled: !!referenceId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_transactions")
        .select("*")
        .eq("reference_id", referenceId!)
        .order("due_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TransactionWithMeta[];
    },
  });

  if (!transaction) return null;

  const t = transaction;
  const type = (t.type as TransactionType) ?? "expense";
  const source = (t.source as TransactionSource) ?? "manual";
  const meta = SOURCE_META[source] ?? SOURCE_META.manual;
  const SourceIcon = meta.icon;
  const TypeIcon = TYPE_ICON[type];
  const reconciled =
    t.status === "paid" && (source === "bella_pay" || source === "sale" || source === "purchase");
  const summary = summarize(t, siblings ?? null);
  const history = (siblings ?? []).filter((s) => s.status === "paid");
  const overdueDays = daysOverdue(t);
  const isSaleReturn = t.source === "sale_return" || t.category_name?.toLowerCase().includes("estorno") || t.category_name?.toLowerCase().includes("reembolso");
  const verb = isSaleReturn ? "Reembolsar" : type === "income" ? "Receber" : "Pagar";
  const verbPast = isSaleReturn ? "estornada" : type === "income" ? "recebida" : "paga";
  void verbPast;


  async function handleStatus(status: string, label: string) {
    try {
      await setStatusMut.mutateAsync({ id: t.id, status });
      toast.success(`Movimentação ${label}`);
      onOpenChange(false);
    } catch (err) {
      toast.error("Não foi possível atualizar", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }


  /** Estorno passa exclusivamente pelo motor único (RPC). */
  async function handleReverse() {
    if (
      !confirm(
        "Estornar esta baixa? O valor será devolvido ao saldo da conta e, se houver, será gerada a saída no caixa.",
      )
    )
      return;
    try {
      await reverseMut.mutateAsync({ id: t.id });
      toast.success("Movimentação estornada");
      onOpenChange(false);
    } catch (err) {
      toast.error("Não foi possível estornar", {
        description: err instanceof Error ? err.message : undefined,
      });
  }

  }

  async function handleDuplicate() {
    try {
      await createMut.mutateAsync({
        company_id: companyId,
        description: `${t.description} (cópia)`,
        amount: Number(t.amount ?? 0),
        type: t.type,
        status: "pending",
        transaction_date: new Date().toISOString().slice(0, 10),
        due_date: t.due_date,
        account_id: t.account_id,
        category_id: t.category_id,
        cost_center_id: t.cost_center_id,
        notes: t.notes,
        source: "manual",
      });
      toast.success("Movimentação duplicada");
    } catch (err) {
      toast.error("Não foi possível duplicar", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
          <SheetHeader className="space-y-3 border-b border-border p-6">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-accent",
                  TYPE_TONE[type],
                )}
              >
                <TypeIcon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="truncate text-base">{t.description}</SheetTitle>
                <SheetDescription className="mt-1 flex flex-wrap items-center gap-2">
                  <TransactionStatusBadge status={t.status} />
                  <Badge variant="outline" className="gap-1">
                    <SourceIcon className={cn("h-3 w-3", meta.tone)} />
                    {meta.label}
                  </Badge>
                  {reconciled ? (
                    <Badge
                      variant="outline"
                      className="gap-1 border-success/30 bg-success/10 text-success"
                    >
                      <ShieldCheck className="h-3 w-3" />
                      Conciliado automaticamente
                    </Badge>
                  ) : null}
                </SheetDescription>
              </div>
            </div>
            <div className={cn("text-3xl font-semibold tabular-nums", TYPE_TONE[type])}>
              {type === "expense" ? "-" : type === "income" ? "+" : ""}
              {formatCurrency(Number(t.amount ?? 0))}
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-6 overflow-y-auto p-6">
            {/* FIN-002 — Resumo financeiro (Original / Recebido / Saldo) */}
            <Section title="Resumo">
              <Row
                label="Valor original"
                value={<MoneyValue value={summary.original} />}
              />
              <Row
                label={type === "income" ? "Recebido" : "Pago"}
                value={
                  <MoneyValue
                    value={summary.received}
                    intent={summary.received > 0 ? "positive" : "neutral"}
                  />
                }
              />
              <Row
                label="Saldo"
                value={
                  <MoneyValue
                    value={summary.balance}
                    intent={summary.balance > 0 ? "negative" : "positive"}
                  />
                }
              />
              <Row
                label="Vencimento"
                value={t.due_date ? formatDate(t.due_date) : "—"}
              />
              {overdueDays > 0 && summary.balance > 0 ? (
                <Row
                  label="Dias em atraso"
                  value={
                    <span className="font-semibold text-destructive">
                      {overdueDays} {overdueDays === 1 ? "dia" : "dias"}
                    </span>
                  }
                />
              ) : null}
              {summary.installments.total > 1 ? (
                <Row
                  label="Parcelas"
                  value={`${summary.installments.paid}/${summary.installments.total} pagas`}
                />
              ) : null}
            </Section>

            {/* FIN-002 — Bella inline sugestão contextual */}
            {summary.status === "overdue" && summary.balance > 0 ? (
              <BellaInlineSuggestion
                tone="danger"
                title={`Cobrança vencida há ${overdueDays} ${overdueDays === 1 ? "dia" : "dias"}.`}
                message={`Saldo em aberto de ${formatCurrency(summary.balance)}.`}
                contextPrompt={`A cobrança "${t.description}" está vencida há ${overdueDays} dias com saldo de ${formatCurrency(summary.balance)}. Como abordar o cliente?`}
                action={{ label: "Avisar cliente", to: "/whatsapp" }}
              />
            ) : summary.status === "partial" ? (
              <BellaInlineSuggestion
                tone="warning"
                title={type === "income" ? "Cliente pagou parcialmente." : "Pagamento parcial em aberto."}
                message={`Saldo restante ${formatCurrency(summary.balance)}.`}
                action={{
                  label: type === "income" ? "Receber saldo" : "Pagar saldo",
                  onClick: () => setSettleOpen(true),
                }}
              />
            ) : summary.status === "scheduled" && overdueDays === 0 && t.due_date ? (
              <BellaInlineSuggestion
                tone="info"
                title={type === "income" ? "Recebimento previsto." : "Pagamento previsto."}
                message={`Vencimento em ${formatDate(t.due_date)}.`}
                action={{
                  label: "Confirmar",
                  onClick: () => setSettleOpen(true),
                }}
              />
            ) : null}

            <Section title="Informações">

              <Row label="Data" value={formatDate(t.transaction_date)} />
              <Row
                label="Vencimento"
                value={t.due_date ? formatDate(t.due_date) : "—"}
              />
              {t.paid_at ? (
                <Row label="Data da baixa" value={formatDate(t.paid_at)} />
              ) : null}
              <Row
                label={type === "income" ? "Forma de recebimento" : "Forma de pagamento"}
                value={
                  t.payment_method
                    ? (FINANCE_PAYMENT_METHOD_LABEL[t.payment_method] ??
                      t.payment_method)
                    : "—"
                }
              />
              <Row label="Categoria" value={t.category_name ?? "—"} />
              <Row
                label={t.status === "paid" ? "Conta de destino" : "Conta"}
                value={
                  t.account_name ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
                      {t.account_name}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
              {t.reference_number ? (
                <Row label="Nº referência" value={t.reference_number} />
              ) : null}
            </Section>

            {source === "bella_pay" || source === "sale" || source === "purchase" ? (
              <Section title="Origem">
                <Row
                  label="Módulo"
                  value={
                    <span className="inline-flex items-center gap-1.5">
                      <SourceIcon className={cn("h-3.5 w-3.5", meta.tone)} />
                      {meta.label}
                    </span>
                  }
                />
                {t.asaas_charge_id ? (
                  <Row label="ID Asaas" value={<code className="text-xs">{t.asaas_charge_id}</code>} />
                ) : null}
                {t.bella_pay_charge_id ? (
                  <Row
                    label="Cobrança Bella Pay"
                    value={<code className="text-xs">{t.bella_pay_charge_id}</code>}
                  />
                ) : null}
                {t.reference_id ? (
                  <Row
                    label="Documento vinculado"
                    value={<code className="text-xs">{t.reference_id}</code>}
                  />
                ) : null}
                {t.bella_pay_charge_id ? (
                  <div className="pt-2">
                    <Button size="sm" variant="outline" asChild>
                      <a href="/bella-pay">
                        <ExternalLink className="mr-1.5 h-4 w-4" />
                        Abrir cobrança
                      </a>
                    </Button>
                  </div>
                ) : null}
              </Section>
            ) : null}

            {t.notes ? (
              <Section title="Observações">
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {t.notes}
                </p>
              </Section>
            ) : null}

            {/* FIN-002 — Histórico de recebimentos (parcelas pagas) */}
            {history.length > 0 ? (
              <Section title="Histórico de recebimentos">
                <ul className="space-y-2">
                  {history.map((h) => {
                    const when = h.paid_at ?? h.transaction_date;
                    const src = (h.source as TransactionSource) ?? "manual";
                    return (
                      <li
                        key={h.id}
                        className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-muted/30 p-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium tabular-nums">
                            {formatCurrency(Number(h.amount ?? 0))}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {formatDate(when)} · {SOURCE_META[src]?.label ?? "Manual"}
                          </p>
                        </div>
                        <TransactionStatusBadge status="paid" />
                      </li>
                    );
                  })}
                </ul>
              </Section>
            ) : null}
          </div>


          <div className="border-t border-border p-4">
            <div className="flex flex-wrap gap-2">
              {t.status !== "paid" && t.status !== "cancelled" ? (
                <Button
                  size="sm"
                  onClick={() => setSettleOpen(true)}
                >
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  {isSaleReturn ? "Comprovante de Reembolso" : verb}
                </Button>
              ) : null}
              {t.status === "paid" ? (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reverseMut.isPending}
                    onClick={handleReverse}
                  >
                    <ArrowLeftRight className="mr-1.5 h-4 w-4" />
                    Estornar
                  </Button>
                  {isSaleReturn && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.print()}
                    >
                      <Printer className="mr-1.5 h-4 w-4" />
                      Comprovante de Reembolso
                    </Button>
                  )}
                </>
              ) : null}
              <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="mr-1.5 h-4 w-4" />
                Editar
              </Button>
              <Button size="sm" variant="outline" onClick={handleDuplicate}>
                <Copy className="mr-1.5 h-4 w-4" />
                Duplicar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.print()}
              >
                <Printer className="mr-1.5 h-4 w-4" />
                Imprimir
              </Button>
              {t.status !== "cancelled" && t.status !== "paid" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleStatus("cancelled", "cancelada")}
                >
                  <Ban className="mr-1.5 h-4 w-4" />
                  Cancelar
                </Button>
              ) : null}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <TransactionFormDialog
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) onOpenChange(false);
        }}
        companyId={companyId}
        transaction={t}
        defaultType={type}
      />

      <SettleTransactionDialog
        open={settleOpen}
        onOpenChange={setSettleOpen}
        companyId={companyId}
        transaction={t}
        verb={verb}
        onSettled={() => onOpenChange(false)}
      />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
      <Separator />
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}
