import { useEffect, useReducer } from "react";
import { Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePDV } from "../hooks/use-pdv";
import { usePdvCash } from "../hooks/use-pdv-cash";
import { usePdvCheckout } from "../hooks/use-pdv-checkout";
import { PDVCustomerSelect } from "./pdv-customer-select";
import { PDVHeader } from "./pdv-header";
import { PDVCart } from "./pdv-cart";
import { PDVWorkspace } from "./pdv-workspace";
import { PDVOperationBar } from "./pdv-operation-bar";
import { PDVSummary } from "./pdv-summary";
import { PDVPaymentPanel } from "./pdv-payment-panel";
import { CheckoutDialog } from "../../components/checkout-dialog";
import { toFinancePaymentMethod } from "../lib/payments";
import { usePdvFiscal } from "../hooks/use-pdv-fiscal";
import { PDVCompletedPanel } from "./pdv-completed-panel";
import { ReceiptDialog } from "../../components/receipt-dialog";
import {
  PDV_SESSION_INITIAL,
  pdvSessionReducer,
  printPdvReceipt,
} from "../lib/completion";
import { pdvCashStatus, resolvePdvStage } from "../lib/layout";
import { formatOpenedAt } from "@/features/cash";
import {
  usePdvShortcuts,
  focusPdvElement,
  clickPdvElement,
  PDV_SEARCH_INPUT_ID,
  PDV_BARCODE_INPUT_ID,
  PDV_CUSTOMER_TRIGGER_ID,
} from "../hooks/use-pdv-shortcuts";

type Props = {
  companyId: string;
  operatorId: string;
  operatorName: string;
};

/**
 * PDVScreen — sessão de venda em memória (Sprint 2.2) com guarda de caixa
 * reutilizando o fluxo existente (Sprint 2.3). Nenhuma venda é persistida.
 */
export function PDVScreen({ companyId, operatorId, operatorName }: Props) {
  const pdv = usePDV(companyId);
  const { access, session, requestOpenCash, cashDialogs } = usePdvCash({
    companyId,
    operatorId,
    operatorName,
  });

  // Sessão do balcão: venda criada -> recebida -> recibo (Sprints 2.5/2.6).
  const [pdvSession, dispatchSession] = useReducer(
    pdvSessionReducer,
    PDV_SESSION_INITIAL,
  );
  const {
    pendingSale,
    completed,
    receiptOpen,
    checkoutOpen,
    fiscal,
    fiscalPending,
  } = pdvSession;

  const checkout = usePdvCheckout({
    companyId,
    cashSessionId: session?.id ?? null,
    onSuccess: (sale) =>
      dispatchSession({
        type: "SALE_CREATED",
        sale: {
          id: sale.id,
          number: pdv.state.number,
          total: pdv.totals.grand_total,
        },
      }),
  });

  // NFC-e (Sprint 2.10): emissão automática após o recebimento, delegada
  // ao módulo fiscal existente. Falha nunca cancela a venda.
  const pdvFiscal = usePdvFiscal({
    onStart: () => dispatchSession({ type: "FISCAL_START" }),
    onOutcome: (outcome) => dispatchSession({ type: "FISCAL_RESULT", outcome }),
  });

  /**
   * Pagamento confirmado pelo CheckoutDialog (motor único do NexOS).
   * O PDV apenas reage: marca a venda como recebida e dispara a NFC-e.
   */
  function handlePaid(saleId: string, method?: Parameters<
    typeof toFinancePaymentMethod
  >[0]) {
    dispatchSession({
      type: "SALE_RECEIVED",
      paymentMethod: toFinancePaymentMethod(method),
    });
    void pdvFiscal.issue(saleId);
  }

  function handleNewSale() {
    // Limpa recibo, venda concluída e carrinho. O caixa permanece aberto.
    pdv.clear();
    dispatchSession({ type: "NEW_SALE" });
  }

  function handlePrintReceipt() {
    dispatchSession({ type: "OPEN_RECEIPT" });
    printPdvReceipt();
  }

  const canFinalize =
    pdv.state.items.length > 0 &&
    !!pdv.state.customerId &&
    pdv.stockIssues.length === 0;

  // Atalhos de teclado (Sprint 2.8) — apenas disparam as MESMAS ações dos
  // botões já existentes. Nenhuma regra nova.
  const canNewSale = !!completed || pdv.state.items.length === 0;
  usePdvShortcuts({
    enabled: access.canOperate,
    context: { dialogOpen: receiptOpen },
    handlers: {
      "focus-search": () => focusPdvElement(PDV_SEARCH_INPUT_ID),
      "focus-barcode": () => focusPdvElement(PDV_BARCODE_INPUT_ID),
      "open-customer": () => clickPdvElement(PDV_CUSTOMER_TRIGGER_ID),
      "new-sale": canNewSale ? handleNewSale : undefined,
      receive:
        completed || pendingSale
          ? undefined
          : canFinalize && !checkout.isSaving
            ? () => checkout.finalize(pdv.state)
            : undefined,
      "print-receipt": completed ? handlePrintReceipt : undefined,
      "confirm-dialog": receiptOpen ? printPdvReceipt : undefined,
      "close-dialog": receiptOpen
        ? () => dispatchSession({ type: "CLOSE_RECEIPT" })
        : undefined,
      "clear-cart":
        pdv.state.items.length > 0 && !pendingSale && !completed
          ? () => {
              if (
                typeof window === "undefined" ||
                window.confirm("Limpar o carrinho?")
              ) {
                pdv.clear();
              }
            }
          : undefined,
    },
  });

  const blocked = access.state === "blocked";
  useEffect(() => {
    if (blocked) requestOpenCash();
  }, [blocked, requestOpenCash]);

  if (access.state === "loading") {
    return (
      <Card className="p-10 text-center text-sm text-muted-foreground">
        Verificando caixa...
      </Card>
    );
  }

  if (!access.canOperate) {
    return (
      <>
        <div className="space-y-4">
          <PDVHeader />
          <Card className="flex flex-col items-center gap-3 p-10 text-center">
            <Wallet className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{access.message}</p>
            {access.state === "blocked" && (
              <Button onClick={requestOpenCash}>Abrir Caixa</Button>
            )}
          </Card>
        </div>
        {cashDialogs}
      </>
    );
  }

  const stage = resolvePdvStage({ pendingSale, completed });
  const cashStatus = pdvCashStatus({
    canOperate: access.canOperate,
    openedAtLabel: session?.opened_at ? formatOpenedAt(session.opened_at) : null,
  });
  const cartLocked = stage !== "cart";

  return (
    <>
      <PDVWorkspace
        operationBar={
          <PDVOperationBar
            companyId={companyId}
            saleNumber={pdv.state.number}
            stage={stage}
            cashStatus={cashStatus}
            search={pdv.search}
            onSearchChange={pdv.setSearch}
            onProduct={(product) => pdv.addProduct(product)}
          />
        }
        cart={
          <>
            <PDVCart
              items={pdv.state.items}
              onQuantityChange={pdv.setItemQuantity}
              onRemove={pdv.removeItem}
              readOnly={cartLocked}
            />
            {pdv.stockIssues.length > 0 && (
              <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-medium text-destructive">
                Há {pdv.stockIssues.length} item(ns) com quantidade acima do
                estoque disponível.
              </p>
            )}
          </>
        }
        panel={
          <>
            <PDVCustomerSelect
              companyId={companyId}
              value={pdv.state.customerId}
              onChange={pdv.setCustomer}
            />
            <PDVSummary
              totals={pdv.totals}
              itemCount={pdv.itemCount}
              discountValue={pdv.state.discount}
              discount={pdv.discount}
              onDiscountChange={pdv.setDiscount}
              onClear={pdv.clear}
              readOnly={cartLocked}
            />
            {completed ? (
              <PDVCompletedPanel
                sale={completed}
                onViewReceipt={() => dispatchSession({ type: "OPEN_RECEIPT" })}
                onPrint={handlePrintReceipt}
                onNewSale={handleNewSale}
                fiscal={fiscal}
                fiscalPending={fiscalPending}
                onRetryFiscal={() => void pdvFiscal.issue(completed.id)}
              />
            ) : (
              <PDVPaymentPanel
                onFinalize={() => checkout.finalize(pdv.state)}
                isSaving={checkout.isSaving}
                disabled={!canFinalize}
              />
            )}
          </>
        }
      />
      {pendingSale || completed ? (
        <CheckoutDialog
          open={checkoutOpen}
          onOpenChange={(v) => {
            if (!v) dispatchSession({ type: "CLOSE_CHECKOUT" });
          }}
          companyId={companyId}
          saleId={(pendingSale ?? completed)!.id}
          saleNumber={(pendingSale ?? completed)!.number}
          customerId={pdv.state.customerId}
          amount={(pendingSale ?? completed)!.total}
          subtotal={pdv.totals.items_total}
          discount={pdv.state.discount}
          onPaid={(info) =>
            handlePaid((pendingSale ?? completed)!.id, info?.method)
          }
          onNewSale={handleNewSale}
        />
      ) : null}
      {completed ? (
        <ReceiptDialog
          open={receiptOpen}
          onOpenChange={(v) =>
            dispatchSession({ type: v ? "OPEN_RECEIPT" : "CLOSE_RECEIPT" })
          }
          saleId={completed.id}
          companyId={companyId}
          paymentMethod={completed.paymentMethod}
          operatorName={operatorName}
          onNewSale={handleNewSale}
        />
      ) : null}
      {cashDialogs}
    </>
  );
}
