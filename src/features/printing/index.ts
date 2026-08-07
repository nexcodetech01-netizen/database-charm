export { LabelPrintDialog } from "./components/label-print-dialog";
export { PrintManager } from "./components/enterprise/PrintManager";
export { printManager, printService } from "./services/print.service";
export { DanfePrintButton } from "./components/danfe-print-button";
export { PrintSettingsSection } from "./components/print-settings-section";
export { usePrintPreferences } from "./hooks/use-print-preferences";
export {
  DEFAULT_PRINT_PREFERENCES,
  getPrintPreferences,
  savePrintPreferences,
  normalizePrintPreferences,
  type PrintPreferences,
  type ReceiptPaperWidth,
} from "./lib/print-preferences";
export {
  detectPrinterCapabilities,
  describePrinter,
  applyThermalPageStyle,
  buildThermalPageCss,
  printHtmlDocument,
  printPdfUrl,
  type PrinterCapabilities,
  type PrintMethod,
} from "./lib/printer";
export {
  LABEL_LAYOUTS,
  LABEL_LAYOUT_LIST,
  buildLabelsDocument,
  buildLabelCss,
  renderLabelHtml,
  resolveLabelLayout,
  resolveBarcodeValue,
  expandLabelCopies,
  type LabelItem,
  type LabelLayout,
  type LabelLayoutId,
} from "./lib/labels";
export { encodeCode128, renderCode128Svg } from "./lib/barcode";
