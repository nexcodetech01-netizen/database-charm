/**
 * Fiscal v2 — Fonte única das colunas de `fiscal_documents`.
 *
 * Antes desta consolidação a mesma lista existia duplicada em
 * `functions/fiscal.functions.ts` e `functions/nfe-engine.server.ts`,
 * com divergências que já causaram regressões (HTTP 400 por coluna
 * ausente). Nenhuma regra de negócio vive aqui — apenas a projeção.
 */
export const FISCAL_DOCUMENT_COLUMNS = [
  "id",
  "company_id",
  "sale_id",
  "number",
  "series",
  "access_key",
  "status",
  "environment",
  "total_amount",
  "xml_signed_path",
  "xml_authorized_path",
  "danfe_path",
  "protocol",
  "protocol_at",
  "cancelled_at",
  "cancellation_reason",
  "cancellation_protocol",
  "cancelled_by",
  "xml_cancellation_path",
  "rejection_code",
  "rejection_reason",
  "provider",
  "discarded_at",
  "discarded_by",
  "discard_reason",
  "artifacts_pending",
  "artifacts_last_error",
  "artifacts_checked_at",
  "created_at",
  "updated_at",
].join(", ");
