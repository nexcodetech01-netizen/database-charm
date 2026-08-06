import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  lazy,
  Suspense,
} from "react";
import { Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePDV } from "../hooks/use-pdv";
import { usePdvCash } from "../hooks/use-pdv-cash";
import { usePdvCheckout } from "../hooks/use-pdv-checkout";
import { PDVHeader } from "./pdv-header";
import { PDVCart } from "./pdv-cart";
import { PDVWorkspace } from "./pdv-workspace";
import { PDVShortcutBar } from "./pdv-shortcut-bar";
import { PDVOperationBar } from "./pdv-operation-bar";
import { PDVSummary } from "./pdv-summary";
import { PDVPaymentPanel } from "./pdv-payment-panel";
import { PDVItemPriceDialog, PDVItemDiscountDialog } from "./pdv-item-dialogs";
import type { SaleItemDraft } from "../../types";
import { toFinancePaymentMethod } from "../lib/payments";
import { usePdvFiscal } from "../hooks/use-pdv-fiscal";
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
import { usePdvCatalogIndex } from "../hooks/use-pdv-catalog-index";

// Componentes pesados ou utilizados apenas após eventos carregados sob demanda (Sprint RC.1.3).
const PDVCustomerSelect = lazy(() =>
  import("./pdv-customer-select").then((m) => ({ default: m.PDVCustomerSelect })),
);
const PDVCompletedPanel = lazy(() =>
  import("./pdv-completed-panel").then((m) => ({ default: m.PDVCompletedPanel })),
);
const CheckoutDialog = lazy(() =>
  import("../../components/checkout-dialog").then((m) => ({
    default: m.CheckoutDialog,
  })),
);
const ReceiptDialog = lazy(() =>
  import("../../components/receipt-dialog").then((m) => ({ default: m.ReceiptDialog })),
);


type Props = {
  companyId: string;
  operatorId: string;
  operatorName: string;
  companyName?: string;
};

/**
 * PDVScreen — sessão de venda em memória (Sprint 2.2) com guarda de caixa
 * reutilizando o fluxo existente (Sprint 2.3). Nenhuma venda é persistida.
 *
 * Sprint RC.1.2: Prefetch paralelo do catálogo iniciado aqui para não bloquear.
 */
export function PDVScreen({
  companyId,
  operatorId,
  operatorName,
  companyName,
}: Props) {
  // Prefetch paralelo do catálogo (não bloqueia a UI do caixa).
  const catalog = usePdvCatalogIndex(companyId);

  const pdv = usePDV(companyId);
  const {
    access,
    session,
    requestOpenCash,
    requestCloseCash,
    closeCashOpen,
    cashMenu,
    cashDialogs,
  } = usePdvCash({ companyId, operatorId, operatorName, companyName });

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

  // Estados para diálogos de item
  const [editingPriceItem, setEditingPriceItem] = useState<SaleItemDraft | null>(null);
  const [editingDiscountItem, setEditingDiscountItem] = useState<SaleItemDraft | null>(null);
  const [editingAdditionItem, setEditingAdditionItem] = useState<SaleItemDraft | null>(null);

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
    console.log("[PDVScreen] handlePrintReceipt invocado. Estado receiptOpen:", receiptOpen);
    
    // Se o diálogo não estiver aberto, abre ele. 
    // O useEffect em PDVScreen ou ReceiptDialog tratará a auto-impressão se configurada,
    // mas aqui garantimos que a função seja rastreável.
    if (!receiptOpen) {
      console.log("[PDVScreen] Abrindo ReceiptDialog...");
      dispatchSession({ type: "OPEN_RECEIPT" });
    } else {
      console.log("[PDVScreen] ReceiptDialog já aberto. O clique no botão 'Imprimir cupom' dentro do modal deve ser usado.");
    }
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
    context: { 
      dialogOpen: receiptOpen || 
                  checkoutOpen || 
                  closeCashOpen || 
                  !!editingPriceItem || 
                  !!editingDiscountItem || 
                  !!editingAdditionItem 
    },
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
      "print-receipt": completed ? () => {
        console.log("[PDVScreen] Atalho print-receipt detectado.");
        handlePrintReceipt();
      } : undefined,
      // F12 apenas ABRE o diálogo de fechamento existente.
      "close-cash": session ? requestCloseCash : undefined,
      "confirm-dialog": receiptOpen ? () => {
        console.log("[PDVScreen] Atalho confirm-dialog detectado (Impressão).");
        handlePrintReceipt();
      } : undefined,
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
            cashMenu={cashMenu}
            activity={pdvActivity({
              saving: checkout.isSaving,
              fiscalPending,
              stage,
            })}
            isSyncing={catalog.isSyncing}
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
              onEditPrice={setEditingPriceItem}
              onEditDiscount={setEditingDiscountItem}
              onEditAddition={setEditingAdditionItem}
            />

            {pdv.stockIssues.length > 0 && (
              <p className="rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-2 text-sm font-medium text-destructive">
                Há {pdv.stockIssues.length} item(ns) com quantidade acima do
                estoque disponível.
              </p>
            )}
          </>
        }
        panel={
          <>
            <Suspense fallback={<Skeleton className="h-[52px] w-full rounded-xl" />}>
              <PDVCustomerSelect
                companyId={companyId}
                value={pdv.state.customerId}
                onChange={pdv.setCustomer}
              />
            </Suspense>
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
              <Suspense fallback={<Skeleton className="h-[200px] w-full rounded-xl" />}>
                <PDVCompletedPanel
                  sale={completed}
                  onViewReceipt={() => dispatchSession({ type: "OPEN_RECEIPT" })}
                  onPrint={handlePrintReceipt}
                  onNewSale={handleNewSale}
                  fiscal={fiscal}
                  fiscalPending={fiscalPending}
                  onRetryFiscal={() => void pdvFiscal.issue(completed.id)}
                />
              </Suspense>
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
        footer={<PDVShortcutBar />}
      />


      {pendingSale || completed ? (
        <Suspense fallback={null}>
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
        </Suspense>
      ) : null}
      {completed ? (
        <Suspense fallback={null}>
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
        </Suspense>
      ) : null}
      
      <PDVItemPriceDialog
        item={editingPriceItem}
        open={!!editingPriceItem}
        onOpenChange={(open) => !open && setEditingPriceItem(null)}
        onConfirm={pdv.setItemPrice}
      />

      <PDVItemDiscountDialog
        item={editingDiscountItem}
        open={!!editingDiscountItem}
        onOpenChange={(open) => !open && setEditingDiscountItem(null)}
        onConfirm={pdv.setItemDiscount}
        type="discount"
      />

      <PDVItemDiscountDialog
        item={editingAdditionItem}
        open={!!editingAdditionKey}
        onOpenChange={(open) => !open && setEditingAdditionItem(null)}
        onConfirm={pdv.setItemAddition}
        type="addition"
      />

      {cashDialogs}
    </>
  );
}
