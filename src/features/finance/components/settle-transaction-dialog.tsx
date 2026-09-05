import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { useCashGuard } from "@/features/cash";
import { useAccounts, useSettleTransaction } from "../hooks/use-finance";
import { useCreditSync } from "../hooks/use-credit-sync";
import { creditService } from "@/features/credit/services/credit.service";
import {
  FINANCE_PAYMENT_METHOD_OPTIONS,
  type FinancePaymentMethod,
  type FinancialTransaction,
} from "../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  transaction: FinancialTransaction | null;
  /** "Receber" | "Pagar" */
  verb?: string;
  onSettled?: () => void;
  defaultPaymentMethod?: FinancePaymentMethod | "";
}

type DiscountType = "value" | "percent";
type SettlementMode = "full" | "partial";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function round2(n: number) {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

/** Aceita "12,50" e "12.50". Retorna null quando não é um número. */
function parseDecimal(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (cleaned === "") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}


export function SettleTransactionDialog({
  open,
  onOpenChange,
  companyId,
  transaction,
  verb = "Receber",
  onSettled,
  defaultPaymentMethod = "",
}: Props) {
  const { data: accounts } = useAccounts(companyId);
  const settleMut = useSettleTransaction();
  const { data: creditInfo, isLoading: isCheckingCredit } = useCreditSync(transaction?.id);

  const [paymentMethod, setPaymentMethod] = useState<FinancePaymentMethod | "">(defaultPaymentMethod);
  const [accountId, setAccountId] = useState("");
  const [paidAt, setPaidAt] = useState(today());
  const [notes, setNotes] = useState("");
  const [discountType, setDiscountType] = useState<DiscountType>("value");
  const [discountInput, setDiscountInput] = useState("");

  // Baixa parcial (RC 2026-09-05): "full" é o comportamento original
  // (Desconto/acréscimo, fecha o lançamento inteiro). "partial" paga só uma
  // parte agora e gera um novo título pendente com o saldo restante.
  const [settlementMode, setSettlementMode] = useState<SettlementMode>("full");
  const [paidNowInput, setPaidNowInput] = useState("");
  const [remainingDueDate, setRemainingDueDate] = useState("");

  const originalAmount = round2(Number(transaction?.amount ?? 0));

  useEffect(() => {
    if (!open) return;
    setPaymentMethod(defaultPaymentMethod);
    setPaidAt(today());
    setNotes("");
    setAccountId(transaction?.account_id ?? "");
    setDiscountType("value");
    setDiscountInput("");
    setSettlementMode("full");
    setPaidNowInput("");
    setRemainingDueDate("");
  }, [open, transaction?.account_id, transaction?.amount]);

  // ---- Modo "full" (desconto/acréscimo) — lógica original, intacta ----
  const rawDiscount = parseDecimal(discountInput);
  const discountFilled = discountInput.trim() !== "";
  const discountParseError = discountFilled && (rawDiscount === null || rawDiscount < 0);

  const discountAmount = round2(
    discountType === "percent"
      ? (originalAmount * Math.min(rawDiscount ?? 0, 100)) / 100
      : (rawDiscount ?? 0),
  );
  const discountTooLarge = discountAmount > originalAmount;
  const discountValid = !discountParseError && !discountTooLarge;

  const fullSettledAmount = round2(Math.max(originalAmount - discountAmount, 0));
  const fullAmountValid = discountValid && fullSettledAmount > 0;

  // ---- Modo "partial" (pagamento parcial de verdade) ----
  const rawPaidNow = parseDecimal(paidNowInput);
  const paidNowFilled = paidNowInput.trim() !== "";
  const paidNowParseError = paidNowFilled && (rawPaidNow === null || rawPaidNow <= 0);
  const paidNowAmount = round2(rawPaidNow ?? 0);
  const paidNowTooLarge = paidNowAmount > originalAmount;
  const remainingAmount = round2(Math.max(originalAmount - paidNowAmount, 0));
  const remainingDateMissing = remainingAmount > 0 && !remainingDueDate;
  const partialValid =
    paidNowFilled && !paidNowParseError && !paidNowTooLarge && paidNowAmount > 0 && !remainingDateMissing;

  const isPartial = settlementMode === "partial";
  const settledAmount = isPartial ? paidNowAmount : fullSettledAmount;
  const amountValid = isPartial ? partialValid : fullAmountValid;
  const difference = isPartial ? 0 : discountAmount;


  const activeAccounts = (accounts ?? []).filter((a) => a.status === "active");
  const { runWithCashGuard, cashGuardDialog } = useCashGuard({
    companyId,
    accountName: activeAccounts.find((a) => a.id === accountId)?.name ?? null,
  });

  async function handleConfirm() {
    if (!transaction) return;
    if (!paymentMethod) {
      toast.error("Selecione a forma de recebimento.");
      return;
    }
    if (!accountId) {
      toast.error("Selecione a conta de destino.");
      return;
    }
    if (!paidAt) {
      toast.error("Informe a data do recebimento.");
      return;
    }
    if (isPartial) {
      if (paidNowParseError) {
        toast.error("Informe um valor válido para o pagamento de hoje.");
        return;
      }
      if (paidNowTooLarge) {
        toast.error("O pagamento parcial não pode ser maior que o valor original.");
        return;
      }
      if (remainingDateMissing) {
        toast.error("Informe o vencimento do saldo restante.");
        return;
      }
    } else {
      if (discountParseError) {
        toast.error("Informe um desconto válido.");
        return;
      }
      if (discountTooLarge) {
        toast.error("O desconto não pode ser maior que o valor original.");
        return;
      }
    }
    if (!amountValid) {
      toast.error("O valor final da baixa precisa ser maior que zero.");
      return;
    }
    try {
      const result = await runWithCashGuard(() =>
        settleMut.mutateAsync({
          id: transaction.id,
          input: {
            paymentMethod,
            accountId,
            paidAt,
            notes,
            settledAmount,
            settlementMode,
            remainingDueDate: isPartial && remainingAmount > 0 ? remainingDueDate : null,
          },
        }),
      );

      // Se houver vínculo com crediário, liquida a parcela correspondente
      if (result && creditInfo?.creditAccountId) {
        try {
          await creditService.receivePayment({
            companyId,
            creditAccountId: creditInfo.creditAccountId,
            amount: settledAmount,
            paymentMethod,
            paidAt: new Date(paidAt).toISOString(),
            accountId,
            notes: `Baixa automática via Financeiro: ${notes}`.trim(),
          });
        } catch (creditErr) {
          console.error("[SettleTransactionDialog] Erro ao sincronizar baixa com crediário:", creditErr);
          // Não falha a baixa principal se a sincronização falhar, apenas loga.
        }
      }

      if (result === undefined) return;
      toast.success(
        isPartial && remainingAmount > 0
          ? `Pagamento parcial de ${formatCurrency(settledAmount)} registrado. Saldo de ${formatCurrency(remainingAmount)} criado como novo título pendente.`
          : difference > 0
          ? `Baixa de ${formatCurrency(settledAmount)} registrada com desconto de ${formatCurrency(difference)}`
          : "Baixa registrada",
      );

      onOpenChange(false);
      onSettled?.();
    } catch (err) {
      toast.error("Não foi possível registrar a baixa", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }


  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b px-5 py-3 text-left">
            <DialogTitle>Registrar baixa de {verb.toLowerCase()}</DialogTitle>
            <DialogDescription>
              {transaction ? (
                <>
                  {transaction.description} · {formatCurrency(Number(transaction.amount ?? 0))}
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Tipo de baixa</Label>
              <div className="flex h-10 overflow-hidden rounded-md border">
                {(
                  [
                    { value: "full", label: "Total (com desconto)" },
                    { value: "partial", label: "Parcial" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={settlementMode === opt.value}
                    onClick={() => setSettlementMode(opt.value)}
                    className={`flex h-full flex-1 items-center justify-center text-sm font-medium leading-none transition-colors ${
                      settlementMode === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {isPartial
                  ? "Paga só uma parte agora e cria um novo título pendente com o restante."
                  : "Fecha o lançamento inteiro agora; qualquer diferença vira desconto/acréscimo."}
              </p>
            </div>

            {isPartial ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="settle-paid-now">
                    Valor pago agora <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="settle-paid-now"
                    className="h-10 px-3 py-2 text-sm leading-none tabular-nums"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0,00"
                    value={paidNowInput}
                    onChange={(e) => setPaidNowInput(e.target.value)}
                  />
                  {paidNowParseError ? (
                    <p className="text-xs text-destructive">
                      Informe um número válido maior que zero (use vírgula ou ponto).
                    </p>
                  ) : paidNowTooLarge ? (
                    <p className="text-xs text-destructive">
                      O valor pago não pode ser maior que o valor original de{" "}
                      {formatCurrency(originalAmount)}.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Valor original</span>
                    <span className="tabular-nums">{formatCurrency(originalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Pago agora</span>
                    <span className="tabular-nums">{formatCurrency(paidNowAmount)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-4 border-t pt-3 font-semibold">
                    <span>Saldo restante (novo título)</span>
                    <span className="tabular-nums text-base">
                      {formatCurrency(remainingAmount)}
                    </span>
                  </div>
                  {remainingAmount > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Um novo título pendente de {formatCurrency(remainingAmount)} será criado
                      automaticamente para você quitar depois.
                    </p>
                  ) : null}
                </div>

                {remainingAmount > 0 ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="settle-remaining-due-date">
                      Vencimento do saldo restante <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="settle-remaining-due-date"
                      type="date"
                      value={remainingDueDate}
                      onChange={(e) => setRemainingDueDate(e.target.value)}
                    />
                    {remainingDateMissing ? (
                      <p className="text-xs text-destructive">
                        Informe o vencimento do novo título.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="settle-discount">Desconto</Label>
                  <div className="flex items-stretch gap-2">
                    <Input
                      id="settle-discount"
                      className="h-10 flex-1 px-3 py-2 text-sm leading-none tabular-nums"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder={discountType === "percent" ? "0" : "0,00"}
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                    />
                    <div className="flex h-10 shrink-0 overflow-hidden rounded-md border">
                      {(
                        [
                          { value: "value", label: "R$" },
                          { value: "percent", label: "%" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          aria-pressed={discountType === opt.value}
                          onClick={() => setDiscountType(opt.value)}
                          className={`flex h-full w-11 items-center justify-center text-sm font-medium leading-none transition-colors ${
                            discountType === opt.value
                              ? "bg-primary text-primary-foreground"
                              : "bg-background text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {discountParseError ? (
                    <p className="text-xs text-destructive">
                      Informe um número válido (use vírgula ou ponto).
                    </p>
                  ) : discountTooLarge ? (
                    <p className="text-xs text-destructive">
                      O desconto não pode ser maior que o valor original de{" "}
                      {formatCurrency(originalAmount)}.
                    </p>
                  ) : discountAmount > 0 && fullSettledAmount === 0 ? (
                    <p className="text-xs text-destructive">
                      O valor final precisa ser maior que zero.
                    </p>
                  ) : null}
                </div>

                <div className="space-y-1.5 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">Valor original</span>
                    <span className="tabular-nums">{formatCurrency(originalAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">(-) Desconto</span>
                    <span
                      className={`tabular-nums ${
                        discountAmount > 0 ? "text-amber-600 dark:text-amber-500" : ""
                      }`}
                    >
                      {discountAmount > 0 ? "-" : ""}
                      {formatCurrency(discountAmount)}
                      {discountType === "percent" && discountAmount > 0 && !discountTooLarge ? (
                        <span className="ml-1 text-xs text-muted-foreground">
                          ({Math.min(Number(rawDiscount) || 0, 100).toLocaleString("pt-BR")}%)
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-4 border-t pt-3 font-semibold">

                    <span>
                      (=) Valor final a {verb.toLowerCase() === "pagar" ? "pagar" : "receber"}
                    </span>
                    <span className="tabular-nums text-base">
                      {fullAmountValid ? formatCurrency(fullSettledAmount) : "—"}
                    </span>
                  </div>
                  {discountAmount > 0 && discountValid ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      O desconto de {formatCurrency(discountAmount)} será registrado no lançamento
                      financeiro.
                    </p>
                  ) : null}
                </div>
              </>
            )}


            <div className="space-y-1.5">

              <Label>
                Forma de {verb.toLowerCase() === "pagar" ? "pagamento" : "recebimento"} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as FinancePaymentMethod)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {FINANCE_PAYMENT_METHOD_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>
                Conta de destino <span className="text-destructive">*</span>
              </Label>
              {activeAccounts.length === 0 ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-muted-foreground">
                  Nenhuma conta financeira ativa encontrada. Cadastre uma conta em Financeiro &gt;
                  Contas Financeiras.
                </div>
              ) : (
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>
                Data do {verb.toLowerCase() === "pagar" ? "pagamento" : "recebimento"} <span className="text-destructive">*</span>
              </Label>
              <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
            </div>

            <div className="space-y-1.5">
              <Label>Observação</Label>
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional"
              />
            </div>
          </div>

          </div>

          <DialogFooter className="shrink-0 border-t bg-card px-5 py-3">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={settleMut.isPending || isCheckingCredit || activeAccounts.length === 0 || !amountValid}
            >
              {settleMut.isPending || isCheckingCredit ? "Registrando..." : `Confirmar ${verb.toLowerCase()}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {cashGuardDialog}
    </>
  );
}
