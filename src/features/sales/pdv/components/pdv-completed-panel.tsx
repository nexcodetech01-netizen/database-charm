import { CheckCircle2, Plus, Printer, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { paymentMethodLabel } from "../../lib/whatsapp-receipt";
import type { PdvCompletedSale } from "../lib/completion";
import type { PdvFiscalOutcome } from "../lib/fiscal";
import { PDVFiscalStatus } from "./pdv-fiscal-status";

type Props = {
  sale: PdvCompletedSale;
  onViewReceipt: () => void;
  onPrint: () => void;
  onNewSale: () => void;
  /** Resultado da emissão da NFC-e (Sprint 2.10). */
  fiscal?: PdvFiscalOutcome | null;
  fiscalPending?: boolean;
  onRetryFiscal?: () => void;
};

/**
 * PDV — resumo da venda concluída (Sprint 2.6).
 * O recibo em si é o `ReceiptDialog`/`SaleReceipt` existentes.
 */
export function PDVCompletedPanel({
  sale,
  onViewReceipt,
  onPrint,
  onNewSale,
  fiscal = null,
  fiscalPending = false,
  onRetryFiscal,
}: Props) {
  return (
    <div className="space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-sm">
      <div className="flex items-center gap-2 text-emerald-600">
        <CheckCircle2 className="h-5 w-5" />
        <p className="text-sm font-medium">Venda concluída</p>
      </div>

      <dl className="space-y-1 text-sm">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Venda</dt>
          <dd className="font-mono">{sale.number}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Total</dt>
          <dd className="font-medium">{formatCurrency(sale.total)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Forma de pagamento</dt>
          <dd>{paymentMethodLabel(sale.paymentMethod)}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Data/Hora</dt>
          <dd>{formatDateTime(sale.receivedAt)}</dd>
        </div>
      </dl>

      {(fiscalPending || fiscal) && (
        <PDVFiscalStatus
          outcome={fiscal}
          isIssuing={fiscalPending}
          onRetry={() => onRetryFiscal?.()}
        />
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="default" onClick={onViewReceipt}>
          <Receipt className="mr-1.5 h-4 w-4" /> Visualizar recibo
        </Button>
        <Button type="button" variant="outline" size="default" onClick={onPrint}>
          <Printer className="mr-1.5 h-4 w-4" /> Imprimir
        </Button>
        <Button type="button" size="default" onClick={onNewSale}>
          <Plus className="mr-1.5 h-4 w-4" /> Nova Venda
        </Button>
      </div>
    </div>
  );
}
