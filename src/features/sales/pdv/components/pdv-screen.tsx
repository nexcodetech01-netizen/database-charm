import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
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
import { pdvActivity, pdvCashStatus, resolvePdvStage } from "../lib/layout";
import { formatOpenedAt } from "@/features/cash";
import { usePdvFocus } from "../hooks/use-pdv-focus";
import { usePdvSaleWatch } from "../hooks/use-pdv-sale-watch";
import { resolveActiveCartKey } from "../lib/cart";
import { usePrintPreferences } from "@/features/printing";
import {
  usePdvShortcuts,
  clickPdvElement,
  PDV_CUSTOMER_TRIGGER_ID,
  PDV_FINALIZE_BUTTON_ID,
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
    lastSale,
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

  /**
   * P0.3 — Pagamento assíncrono (PIX / Bella Pay): enquanto o CheckoutDialog
   * estiver fechado, o PDV acompanha o status da venda no banco. A conclusão
   * depende da transação, nunca do modal continuar aberto.
   */
  usePdvSaleWatch({
    saleId: lastSale?.id ?? null,
    enabled: !!lastSale && !completed && !checkoutOpen,
    onPaid: (saleId, method) =>
      handlePaid(saleId, method as Parameters<typeof toFinancePaymentMethod>[0]),
  });

  // Foco automático (Sprint 2.8): abrir o PDV, adicionar produto e iniciar
  // nova venda devolvem o cursor para a pesquisa.
  const focus = usePdvFocus({ enabled: access.canOperate });

  // Item ativo do carrinho — alvo de F3 (quantidade) e DELETE (remover).
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const effectiveActiveKey = useMemo(
    () => resolveActiveCartKey(pdv.state.items, activeKey),
    [pdv.state.items, activeKey],
  );

  const handleAddProduct = useCallback(
    (product: Parameters<typeof pdv.addProduct>[0]) => {
      pdv.addProduct(product);
      focus.notify("product-added");
    },
    [focus, pdv],
  );

  function handleNewSale() {
    // Limpa recibo, venda concluída e carrinho. O caixa permanece aberto.
    pdv.clear();
    dispatchSession({ type: "NEW_SALE" });
    setActiveKey(null);
    focus.notify("new-sale");
  }

  /**
   * Cancelar venda em andamento — mesma ação já existente de limpar o
   * carrinho (nenhuma venda foi gravada ainda). UX apenas.
   */
  function handleCancelSale() {
    if (typeof window !== "undefined" && !window.confirm("Cancelar a venda?")) {
      return;
    }
    pdv.clear();
    setActiveKey(null);
    focus.focusSearch();
  }

  function handlePrintReceipt() {
    dispatchSession({ type: "OPEN_RECEIPT" });
    printPdvReceipt();
  }

  // P0.2 — cliente é opcional no balcão (consumidor final). A regra vive no
  // ponto único compartilhado (origem "pdv" em salesService.create).
  const canFinalize =
    pdv.state.items.length > 0 && pdv.stockIssues.length === 0;


  const cartEditable =
    pdv.state.items.length > 0 && !pendingSale && !completed;

  // Atalhos de teclado (Sprint 2.8) — apenas disparam as MESMAS ações dos
  // botões já existentes. Nenhuma regra nova.
  usePdvShortcuts({
    enabled: access.canOperate,
    // P0.1: com qualquer diálogo aberto (recibo ou pagamento) os atalhos da
    // tela ficam suspensos — nada vaza para trás do modal nem para o browser.
    context: { dialogOpen: receiptOpen || checkoutOpen },
    handlers: {
      "focus-search": focus.focusSearch,
      "clear-search": () => {
        pdv.setSearch("");
        focus.notify("search-cleared");
      },
      "open-customer": () => clickPdvElement(PDV_CUSTOMER_TRIGGER_ID),
      "focus-quantity": cartEditable
        ? () => focus.focusQuantity(effectiveActiveKey)
        : undefined,
      "focus-discount": cartEditable ? focus.focusDiscount : undefined,
      "open-payment":
        completed || pendingSale
          ? undefined
          : canFinalize && !checkout.isSaving
            ? () => clickPdvElement(PDV_FINALIZE_BUTTON_ID)
            : undefined,
      "remove-item":
        cartEditable && effectiveActiveKey
          ? () => {
              pdv.removeItem(effectiveActiveKey);
              setActiveKey(null);
              focus.focusSearch();
            }
          : undefined,
      "new-sale": !!completed || pdv.state.items.length === 0 ? handleNewSale : undefined,
      "print-receipt": completed ? handlePrintReceipt : undefined,
      "confirm-dialog": receiptOpen ? printPdvReceipt : undefined,
      "close-dialog": receiptOpen
        ? () => dispatchSession({ type: "CLOSE_RECEIPT" })
        : undefined,
      "clear-cart": cartEditable
        ? () => {
            if (
              typeof window === "undefined" ||
              window.confirm("Limpar o carrinho?")
            ) {
              pdv.clear();
              setActiveKey(null);
              focus.focusSearch();
            }
          }
        : undefined,
    },
  });


  // Sprint 4.0 — impressão automática do cupom após a venda concluída.
  const { prefs: printPrefs } = usePrintPreferences(companyId);
  useEffect(() => {
    if (completed && !receiptOpen && printPrefs.autoPrintAfterSale) {
      dispatchSession({ type: "OPEN_RECEIPT" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed?.id, printPrefs.autoPrintAfterSale]);

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
            onProduct={handleAddProduct}
            onClearSearch={focus.focusSearch}
            operatorName={operatorName}
            sessionLabel={session?.id ? session.id.slice(0, 8) : null}
            activity={pdvActivity({
              saving: checkout.isSaving,
              fiscalPending,
              stage,
            })}
          />
        }
        cart={
          <>
            <PDVCart
              items={pdv.state.items}
              onQuantityChange={pdv.setItemQuantity}
              onRemove={pdv.removeItem}
              activeKey={effectiveActiveKey}
              onActivate={setActiveKey}
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
              lineCount={pdv.state.items.length}
              discountValue={pdv.state.discount}
              discount={pdv.discount}
              onDiscountChange={pdv.setDiscount}
              changeDue={
                completed && completed.paymentMethod === "cash" ? 0 : null
              }

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
                onCancelSale={handleCancelSale}
                cancelDisabled={!cartEditable}
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
