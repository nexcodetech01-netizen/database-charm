/**
 * Fiscal v2 — Barrel (Sprint 007 + 007.2).
 */
export * from "./types";
export * from "./schemas";
export * from "./provider";
export * from "./repository";
// export * from "./service"; // Server-only, moved to internal imports to prevent client bundle leakage
// export * from "./skills";
// export { fiscalV2BaseSkills } from "./skills"; // Server-only skills moved to internal registration
export {
  listFiscalDocuments,
  getFiscalDashboard,
  getFiscalDocument,
  issueFiscalFromSale,
  cancelFiscalDocument,
  refreshFiscalStatus,
  getFiscalArtifactUrl,
  getFiscalProviderConfig,
  updateFiscalProviderConfig,
  listFiscalCertificates,
  uploadFiscalCertificate,
  deactivateFiscalCertificate,
  type FiscalDocumentDto,
  type FiscalEventDto,
  type FiscalDashboard,
  type FiscalProviderConfig,
  type FiscalCertificateSummary,
} from "./functions/fiscal.functions";
export * from "./hooks/use-fiscal";
export * from "./lib/fiscal-status";
