import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { formatCurrency } from "@/lib/format";
import { BellaInlineSuggestion } from "@/features/bella-ai/components/bella-inline-suggestion";
import { useCashSummary, useCloseCash } from "../hooks/use-cash";
import type { CashSession } from "../types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  session: CashSession;
  companyName: string;
  onClosed: (sessionId: string) => void;
}

/** Máscara BRL simples baseada em centavos digitados. */
function formatMaskedBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function CloseSessionDialog({ open, onOpenChange, session, onClosed }: Props) {
  const { data: summary } = useCashSummary(open ? session : null);
  // Armazena valor em centavos (int) — mantém a mesma lógica de cálculo.
  const [countedCents, setCountedCents] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const { mutateAsync, isPending } = useCloseCash();
  const inputRef = useRef<HTMLInputElement>(null);

  const countedNum = useMemo(
    () => (countedCents == null ? 0 : countedCents / 100),
    [countedCents],
  );

  const difference = summary ? countedNum - summary.expectedCash : 0;
  const hasCounted = countedCents != null;

  const cardTotal = useMemo(() => {
    if (!summary) return 0;
    return (
      (summary.byMethod.credit_card.total ?? 0) +
      (summary.byMethod.debit_card.total ?? 0)
    );
  }, [summary]);

  const receiptCardTotal = useMemo(() => {
    if (!summary) return 0;
    return (
      (summary.receiptsByMethod.credit_card.total ?? 0) +
      (summary.receiptsByMethod.debit_card.total ?? 0)
    );
  }, [summary]);

  const linkTotal = summary?.byMethod.payment_link.total ?? 0;
  const otherTotal = summary?.byMethod.other?.total ?? 0;
  const salesTotal = summary?.salesTotal ?? 0;
  const receiptsTotal = summary?.receiptsTotal ?? 0;
  const receiptLinkTotal = summary?.receiptsByMethod.payment_link.total ?? 0;
  const receiptOtherTotal = summary?.receiptsByMethod.other?.total ?? 0;


  async function submit() {
    if (!hasCounted) {
      toast.error("Informe o dinheiro contado.");
      return;
    }
    try {
      const res = await mutateAsync({
        sessionId: session.id,
        countedCash: countedNum,
        closingNote: note.trim() || null,
      });
      toast.success("Caixa fechado.");
      onClosed(res.session.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao fechar caixa.");
    }
  }

  const diffTone =
    !hasCounted
      ? "neutral"
      : difference === 0
        ? "ok"
        : difference > 0
          ? "over"
          : "short";

  const diffCardCls = {
    neutral: "border-border bg-muted/30 text-muted-foreground",
    ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    over: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    short: "border-destructive/30 bg-destructive/10 text-destructive",
  }[diffTone];

  const diffLabel = {
    neutral: "Informe o valor contado",
    ok: "Caixa conferido",
    over: "Sobra de caixa",
    short: "Falta de caixa",
  }[diffTone];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-lg">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>Fechar caixa</DialogTitle>
          <DialogDescription>Confira os totais antes de encerrar a sessão.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
          {/* Bloco A — Vendas da sessão (origem: sales) */}
          <section className="rounded-lg border p-3 text-sm">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Vendas da sessão
            </div>
            <div className="divide-y">
              <SumRow label="Dinheiro" value={summary?.byMethod.cash.total ?? 0} />
              <SumRow label="PIX" value={summary?.byMethod.pix.total ?? 0} />
              <SumRow label="Cartão" value={cardTotal} />
              {linkTotal > 0 && <SumRow label="Link de pagamento" value={linkTotal} />}
              {otherTotal > 0 && <SumRow label="Outros" value={otherTotal} />}
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm font-semibold">
              <span>Total vendido</span>
              <span className="text-right tabular-nums">{formatCurrency(salesTotal)}</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Vendas emitidas nesta sessão e já pagas. PIX e Cartão são informativos.
            </p>
          </section>

          {/* Bloco B — Recebimentos realizados na sessão (origem: financial_transactions) */}
          <section className="rounded-lg border p-3 text-sm">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Recebimentos da sessão
            </div>
            {receiptsTotal === 0 ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma liquidação registrada nesta sessão.
              </p>
            ) : (
              <>
                <div className="divide-y">
                  <SumRow label="Dinheiro" value={summary?.receiptsByMethod.cash.total ?? 0} />
                  <SumRow label="PIX" value={summary?.receiptsByMethod.pix.total ?? 0} />
                  <SumRow label="Cartão" value={receiptCardTotal} />
                  {receiptLinkTotal > 0 && (
                    <SumRow label="Link de pagamento" value={receiptLinkTotal} />
                  )}
                  {receiptOtherTotal > 0 && (
                    <SumRow label="Outros" value={receiptOtherTotal} />
                  )}
                </div>
                <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm font-semibold">
                  <span>Total recebido</span>
                  <span className="text-right tabular-nums">
                    {formatCurrency(receiptsTotal)}
                  </span>
                </div>
              </>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Todas as liquidações ocorridas nesta sessão: vendas pagas na hora e baixas
              de contas a receber. Somente recebimentos em dinheiro entram na conferência.
            </p>
          </section>

          {/* Totais consolidados da sessão */}
          <section className="rounded-lg border p-3">
            <div className="grid gap-1.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Vendas da sessão
                </span>
                <span className="text-right font-semibold tabular-nums">
                  {formatCurrency(salesTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Recebimentos da sessão
                </span>
                <span className="text-right font-semibold tabular-nums">
                  {formatCurrency(receiptsTotal)}
                </span>
              </div>
              <div className="flex items-center justify-between border-t pt-1.5">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Dinheiro esperado
                </span>
                <span className="text-right font-semibold tabular-nums">
                  {formatCurrency(summary?.expectedCash ?? 0)}
                </span>
              </div>
            </div>
          </section>


          {/* Bloco C — Conferência do caixa (somente dinheiro físico) */}
          <section className="rounded-lg border p-3 text-sm">
            <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Conferência do caixa
            </div>
            <div className="grid gap-1.5">
              <Row label="Troco inicial" value={formatCurrency(summary?.openingBalance ?? 0)} />
              <Row label="Vendas em dinheiro" value={formatCurrency(summary?.cashSales ?? 0)} />
              <Row
                label="Recebimentos em dinheiro"
                value={formatCurrency(summary?.cashReceipts ?? 0)}
              />
              <Row label="Suprimentos" value={formatCurrency(summary?.cashIn ?? 0)} />
              <Row label="Sangrias" value={`- ${formatCurrency(summary?.cashOut ?? 0)}`} />
            </div>
            <div className="mt-2 flex items-center justify-between border-t pt-2 text-sm font-semibold">
              <span>Dinheiro esperado</span>
              <span className="text-right tabular-nums">
                {formatCurrency(summary?.expectedCash ?? 0)}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              PIX, cartão e gateway não alteram o dinheiro esperado.
            </p>
          </section>


          {/* Dinheiro físico contado */}
          <div className="grid gap-1.5">
            <Label htmlFor="counted">Dinheiro físico contado</Label>
            <Input
              id="counted"
              ref={inputRef}
              inputMode="numeric"
              value={countedCents == null ? "" : formatMaskedBRL(countedCents)}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                setCountedCents(digits === "" ? null : Number.parseInt(digits, 10));
              }}
              onFocus={(e) => e.currentTarget.select()}
              placeholder="R$ 0,00"
              autoFocus
              className="h-12 text-right text-lg font-semibold tabular-nums"
            />
            <p className="text-xs text-muted-foreground">
              Conte apenas o dinheiro existente na gaveta. PIX e Cartão não entram nesta conferência.
            </p>
          </div>

          {/* Card da Diferença */}
          <div
            className={cn(
              "flex items-center justify-between rounded-lg border p-4",
              diffCardCls,
            )}
          >
            <div className="flex flex-col">
              <span className="text-xs font-medium uppercase tracking-wider opacity-80">
                Diferença
              </span>
              <span className="text-sm">{diffLabel}</span>
            </div>
            <span className="text-2xl font-bold tabular-nums">
              {formatCurrency(hasCounted ? difference : 0)}
            </span>
          </div>

          {/* Alerta de Dinheiro Esperado Negativo */}
          {summary && summary.expectedCash < 0 && (
            <Alert variant="destructive" className="border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-sm font-bold">Atenção: Dinheiro esperado negativo</AlertTitle>
              <AlertDescription className="text-xs">
                As sangrias registradas ({formatCurrency(summary.cashOut)}) superaram o saldo inicial somado às vendas e suprimentos em dinheiro. Verifique os lançamentos.
              </AlertDescription>
            </Alert>
          )}

          {/* Bella IA — só quando há divergência */}
          {hasCounted && difference !== 0 && (
            <div className="[&_[data-bella-inline]]:py-2">
              <BellaInlineSuggestion
                title={`Diferença de ${formatCurrency(difference)}`}
                message={
                  difference > 0
                    ? "Sobra no caixa. Verifique suprimentos e trocos antes de encerrar."
                    : "Falta no caixa. Confira sangrias e retiradas antes de encerrar."
                }
                tone="danger"
              />
            </div>
          )}

          {/* Observação — colada ao bloco de diferença */}
          <div className="grid gap-1.5">
            <Label htmlFor="close-note">Observação do fechamento</Label>
            <Textarea
              id="close-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="h-[76px] resize-none"
              placeholder="Registre justificativas ou notas relevantes."
            />
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex items-center justify-between gap-3 border-t bg-background px-6 py-3">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isPending || !summary || !hasCounted}>
            {isPending ? "Fechando…" : "Confirmar fechamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between leading-tight">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-1 leading-tight">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right tabular-nums">{formatCurrency(value)}</span>
    </div>
  );
}
