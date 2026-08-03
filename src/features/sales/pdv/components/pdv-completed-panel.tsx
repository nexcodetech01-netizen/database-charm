import { lazy, Suspense } from "react";
import { CheckCircle2, Plus, Printer, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { paymentMethodLabel } from "../../lib/whatsapp-receipt";
import type { PdvCompletedSale } from "../lib/completion";
import type { PdvFiscalOutcome } from "../lib/fiscal";

const PDVFiscalStatus = lazy(() =>
  import("./pdv-fiscal-status").then((m) => ({ default: m.PDVFiscalStatus })),
);

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
    <div className="space-y-2 rounded-xl border border-status-success/30 bg-status-success-surface p-3 shadow-sm">
      <div className="flex items-center gap-2 text-status-success">
        <CheckCircle2 className="h-4 w-4" />
        <p className="text-sm font-semibold">Venda concluída</p>
      </div>

      <dl className="space-y-0.5 text-[13px]">
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
        <Suspense fallback={<Skeleton className="h-10 w-full rounded-xl" />}>
          <PDVFiscalStatus
            outcome={fiscal}
            isIssuing={fiscalPending}
            onRetry={() => onRetryFiscal?.()}
          />
        </Suspense>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <Button type="button" variant="outline" size="sm" onClick={onViewReceipt}>
          <Receipt className="mr-1.5 h-3.5 w-3.5" /> Recibo
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onPrint}>
          <Printer className="mr-1.5 h-3.5 w-3.5" /> Imprimir
        </Button>
        <Button
          type="button"
          size="sm"
          className="col-span-2"
          onClick={onNewSale}
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Nova Venda
        </Button>
      </div>
    </div>
  );
}
