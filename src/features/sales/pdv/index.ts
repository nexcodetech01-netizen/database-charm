export { PDVScreen } from "./components/pdv-screen";
export { PDVHeader } from "./components/pdv-header";
export { PDVCart } from "./components/pdv-cart";
export { PDVSummary } from "./components/pdv-summary";
export { PDVSearch } from "./components/pdv-search";
export { PDVPaymentPanel } from "./components/pdv-payment-panel";
export { usePDV } from "./hooks/use-pdv";
export { usePdvProductSearch } from "./hooks/use-pdv-product-search";
export { usePdvCash } from "./hooks/use-pdv-cash";
export { usePdvCheckout } from "./hooks/use-pdv-checkout";
export { usePdvReceiving } from "./hooks/use-pdv-receiving";
export { PDVReceivePanel } from "./components/pdv-receive-panel";
export { receivePdvSale, pdvSettlementDate, PDV_PAYMENT_METHODS } from "./lib/receiving";
export { PDVCustomerSelect } from "./components/pdv-customer-select";
export { nextPdvSaleNumber, validatePdvSale, submitPdvSale } from "./lib/checkout";
export { resolvePdvCashAccess } from "./lib/cash-access";
export type { PdvCashAccess, PdvCashState } from "./lib/cash-access";
export { toCartItem, findCartItemByProduct, countCartUnits } from "./lib/cart";
export type { PDVCartItem, PDVProductOption } from "./types";
export { PDVCompletedPanel } from "./components/pdv-completed-panel";
export {
  PDV_SESSION_INITIAL,
  pdvSessionReducer,
  printPdvReceipt,
  startNewPdvSale,
} from "./lib/completion";
export type {
  PdvSessionState,
  PdvSessionAction,
  PdvPendingSale,
  PdvCompletedSale,
} from "./lib/completion";
export { usePdvBarcode } from "./hooks/use-pdv-barcode";
export { PDVBarcodeInput } from "./components/pdv-barcode-input";
export {
  handleBarcodeScan,
  pickScannedProduct,
  normalizeBarcode,
  isScannableCode,
  isNumericBarcode,
  BARCODE_NOT_FOUND_MESSAGE,
} from "./lib/barcode";
export {
  usePdvShortcuts,
  resolvePdvShortcut,
  createPdvShortcutHandler,
  registerPdvShortcuts,
  isTypingTarget,
  focusPdvElement,
  clickPdvElement,
  PDV_SEARCH_INPUT_ID,
  PDV_BARCODE_INPUT_ID,
  PDV_CUSTOMER_TRIGGER_ID,
} from "./hooks/use-pdv-shortcuts";
export type {
  PdvShortcutAction,
  PdvShortcutHandlers,
  PdvShortcutContext,
} from "./hooks/use-pdv-shortcuts";
export { PDVWorkspace } from "./components/pdv-workspace";
export { PDVOperationBar } from "./components/pdv-operation-bar";
export {
  PDV_LAYOUT,
  PDV_STAGE_LABEL,
  PDV_STATUS_TONE_CLASS,
  resolvePdvStage,
  pdvCashStatus,
  buildPdvCustomerDisplay,
} from "./lib/layout";
export type {
  PdvStage,
  PdvCashStatus,
  PdvStatusTone,
  PdvCustomerDisplayModel,
  PdvCustomerDisplayItem,
} from "./lib/layout";
export { usePdvFiscal } from "./hooks/use-pdv-fiscal";
export { PDVFiscalStatus } from "./components/pdv-fiscal-status";
export {
  issuePdvNfce,
  isPdvNfceEnabled,
  classifyPdvFiscalError,
  canPrintPdvDanfe,
  PDV_NFCE_FAILURE_MESSAGE,
} from "./lib/fiscal";
export type {
  PdvFiscalOutcome,
  PdvFiscalDocument,
  PdvFiscalFailureReason,
} from "./lib/fiscal";
export * from "./lib/payments";
