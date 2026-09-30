import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/format";
import { calcParcela } from "@/lib/pricing/card-price";
import {
  computeCreditCardCharge,
  CREDIT_CARD_ALLOWED_INSTALLMENTS,
  SETTLEMENT_DAYS_PIX,
} from "@/features/bella-pay/lib/credit-card-fee";
import { BellaInlineSuggestion } from "@/features/bella-ai/components/bella-inline-suggestion";
import { SummaryLine } from "../summary-line";
import type { UiCheckoutMethod } from "../types";

type CreditCardPreview = ReturnType<typeof computeCreditCardCharge>;

interface CardChargePanelProps {
  method: UiCheckoutMethod;
  amount: number;
  chargeableAmount: number;
  installments: number;
  onInstallmentsChange: (installments: number) => void;
  absorb: boolean;
  onAbsorbChange: (absorb: boolean) => void;
  creditCardPreview: CreditCardPreview | null;
  bellaConfig:
    | {
        credit_card_fee_percent?: number | string | null;
        credit_card_max_installments?: number | string | null;
      }
    | null
    | undefined;
    cardFixedFee: number;
  /** Máximo de parcelas para este valor (limite do Asaas + mínimo para parcelar). */
  maxInstallments: number;
  /** Venda do PDV: parcelas calculadas pelo preço de cartão já aplicado. */
  hasPdvItems: boolean;
  entradaExcedeu: boolean;
  entradaValue: number;
  saldoValue: number;
  isGenerating: boolean;
  onGenerate: () => void;
  onSwitchToPix: () => void;
}

/** Cartão / Link / Boleto (Asaas) antes de gerar a cobrança. */
export function CardChargePanel({
  method,
  amount,
  chargeableAmount,
  installments,
  onInstallmentsChange,
  absorb,
  onAbsorbChange,
  creditCardPreview,
  bellaConfig,
    cardFixedFee,
  maxInstallments,
  hasPdvItems,
  entradaExcedeu,
  entradaValue,
  saldoValue,
  isGenerating,
  onGenerate,
  onSwitchToPix,
}: CardChargePanelProps) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">

        {method === "credit_card"
            ? "Escolha o parcelamento e gere a cobrança. O cliente pagará em ambiente seguro."
            : method === "boleto"
              ? "Gera boleto bancário via Asaas. Compensação em até 2 dias úteis após pagamento."
              : "Gera link de pagamento (PIX, cartão ou boleto) para compartilhar."}
      </div>


      {method === "credit_card" && creditCardPreview ? (
        <div className="space-y-3 rounded-md border p-3">
          {/* FIN-001 — Switch "Loja absorve a taxa" (override de sessão) */}
          <div className="flex items-start justify-between gap-3 rounded-md bg-muted/40 p-3">
            <div className="min-w-0">
              <Label htmlFor="absorb-fee" className="text-sm font-medium">
                Loja absorve a taxa
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {absorb
                  ? "A taxa sai do seu lucro. O cliente paga o preço cheio."
                  : "A taxa é somada ao valor cobrado do cliente."}
              </p>
            </div>
            <Switch
              id="absorb-fee"
              checked={absorb}
              onCheckedChange={onAbsorbChange}
            />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
              Parcelamento
            </Label>
            <div className="flex gap-2">
                            {CREDIT_CARD_ALLOWED_INSTALLMENTS.filter((n) => n <= maxInstallments).map((n) => {
                const preview = computeCreditCardCharge(chargeableAmount, n, {
                  absorb,
                  feePercent: Number(
                    bellaConfig?.credit_card_fee_percent ?? 0,
                  ),
                  maxInstallments: Number(
                    bellaConfig?.credit_card_max_installments ?? 3,
                  ),
                  fixedFee: cardFixedFee,
                });
                const selected = installments === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onInstallmentsChange(n)}
                    className={`flex-1 rounded-md border px-3 py-2 text-left text-sm transition ${
                      selected
                        ? "border-primary bg-blue-600/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="font-medium">
                      {n}x {n === 1 ? "à vista" : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(hasPdvItems ? calcParcela(amount, n) : preview.installmentValue)}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PDV-014 — Resumo inteligente. Sempre mostra líquido e recebimento. */}
          <div className="space-y-1 rounded-md bg-muted/40 p-3 text-xs">
            {absorb ? (
              <>
                <SummaryLine
                  label="Produto"
                  value={formatCurrency(creditCardPreview.originalValue)}
                />
                <SummaryLine
                  label="Taxa"
                  value={`+${formatCurrency(creditCardPreview.addedFee)}`}
                />
                <SummaryLine
                  label="Total cobrado do cliente"
                  value={formatCurrency(creditCardPreview.chargedValue)}
                  strong
                />
              </>
            ) : (
              <>
                <SummaryLine
                  label="Valor da venda"
                  value={formatCurrency(creditCardPreview.chargedValue)}
                />
                <SummaryLine
                  label="Taxa"
                  value={`-${formatCurrency(creditCardPreview.processorFee)}`}
                />
                <SummaryLine
                  label="Você receberá"
                  value={formatCurrency(creditCardPreview.netValue)}
                  strong
                />
              </>
            )}
            <div className="mt-1 flex justify-between border-t pt-1 text-muted-foreground">
              <span>Recebimento</span>
              <span>{creditCardPreview.settlementDays} dias</span>
            </div>
            <div className="pt-1 text-center text-[11px] text-muted-foreground">
              {creditCardPreview.installmentCount}x de{" "}
              {formatCurrency(creditCardPreview.installmentValue)}
            </div>
          </div>

          {/* Bella — sugestão contextual */}
          {creditCardPreview.processorFee >= 5 ? (
            <div className="flex items-start justify-between gap-3 rounded-md border border-primary/30 bg-blue-600/5 p-3 text-xs">
              <div>
                <div className="font-medium text-gray-100">Bella sugere</div>
                <p className="mt-0.5 text-muted-foreground">
                  Esta venda perde{" "}
                  <strong className="text-foreground">
                    {formatCurrency(creditCardPreview.processorFee)}
                  </strong>{" "}
                  em taxas. PIX recebe em {SETTLEMENT_DAYS_PIX} dia
                  {SETTLEMENT_DAYS_PIX > 1 ? "s" : ""}, sem taxa.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onSwitchToPix}
              >
                Alterar para PIX
              </Button>
            </div>
          ) : null}

          {/* FIN-001 — Aviso de absorção da taxa */}
          {absorb && creditCardPreview.processorFee > 0 ? (
            <BellaInlineSuggestion
              tone="warning"
              title="Loja absorvendo a taxa"
              message={`Lucro reduzido em ${formatCurrency(creditCardPreview.processorFee)} devido à absorção da taxa.`}
              action={{
                label: "Repassar ao cliente",
                onClick: () => onAbsorbChange(false),
              }}
            />
          ) : null}
        </div>
      ) : null}


      <Button
        type="button"
        onClick={onGenerate}
        disabled={
          isGenerating ||
          entradaExcedeu ||
          chargeableAmount <= 0
        }
      >
        {isGenerating ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : null}
        Gerar cobrança {entradaValue > 0 ? `de ${formatCurrency(saldoValue)}` : ""}
      </Button>
    </div>
  );
}
