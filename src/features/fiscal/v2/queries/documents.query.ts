import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { 
  FiscalDocumentDto, 
  NfeStatus, 
  NfeEnvironment, 
  FiscalArtifactKind,
  FiscalDashboard,
  FiscalDocumentContext
} from "../types";
import { FISCAL_DOCUMENT_COLUMNS } from "../lib/document-columns";
import { normalizePendingKinds } from "../lib/artifacts";

const DOC_COLS = FISCAL_DOCUMENT_COLUMNS;

type Row = Record<string, unknown>;

/** Normaliza linhas de `fiscal_documents` para o formato DTO. */
export function mapDocument(row: Row): FiscalDocumentDto {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    saleId: (row.sale_id as string) ?? null,
    number: (row.number as number) ?? null,
    series: (row.series as number) ?? null,
    accessKey: (row.access_key as string) ?? null,
    status: row.status as NfeStatus,
    environment: row.environment as NfeEnvironment,
    totalAmount: Number(row.total_amount ?? 0),
    xmlSignedPath: (row.xml_signed_path as string) ?? null,
    xmlAuthorizedPath: (row.xml_authorized_path as string) ?? null,
    danfePath: (row.danfe_path as string) ?? null,
    protocol: (row.protocol as string) ?? null,
    protocolAt: (row.protocol_at as string) ?? null,
    cancelledAt: (row.cancelled_at as string) ?? null,
    cancellationReason: (row.cancellation_reason as string) ?? null,
    cancellationProtocol: (row.cancellation_protocol as string) ?? null,
    cancelledBy: (row.cancelled_by as string) ?? null,
    xmlCancellationPath: (row.xml_cancellation_path as string) ?? null,
    rejectionCode: (row.rejection_code as string) ?? null,
    rejectionReason: (row.rejection_reason as string) ?? null,
    provider: (row.provider as string) ?? null,
    discardedAt: (row.discarded_at as string) ?? null,
    discardedBy: (row.discarded_by as string) ?? null,
    discardReason: (row.discard_reason as string) ?? null,
    artifactsPending: normalizePendingKinds(row.artifacts_pending),
    artifactsLastError: (row.artifacts_last_error as string) ?? null,
    artifactsCheckedAt: (row.artifacts_checked_at as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export interface ListDocumentsFilter {
  status?: string;
  saleId?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export async function fetchFiscalDocuments(
  supabase: SupabaseClient,
  companyId: string,
  filter: ListDocumentsFilter,
): Promise<FiscalDocumentDto[]> {
  let q = supabase
    .from("fiscal_documents")
    .select(DOC_COLS)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(filter.limit ?? 100);

  if (filter.status && filter.status !== "all") q = q.eq("status", filter.status);
  if (filter.saleId) q = q.eq("sale_id", filter.saleId);
  if (filter.from) q = q.gte("created_at", filter.from);
  if (filter.to) q = q.lte("created_at", filter.to);
  if (filter.search) {
    const term = filter.search.replace(/[%,]/g, "");
    q = q.or(`access_key.ilike.%${term}%,protocol.ilike.%${term}%`);
  }

  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as Row[]).map(mapDocument);
}

export async function fetchFiscalDashboard(
  supabase: SupabaseClient,
  companyId: string,
): Promise<FiscalDashboard> {
  const { data: rows, error } = await supabase
    .from("fiscal_documents")
    .select("status, total_amount, protocol_at")
    .eq("company_id", companyId);
  if (error) throw error;

  const totals: Record<NfeStatus, number> = {
    draft: 0, validating: 0, signing: 0, sending: 0, authorized: 0,
    rejected: 0, cancelling: 0, cancelled: 0, error: 0, discarded: 0,
  };
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  let monthAuthorized = 0;
  let monthValue = 0;

  const list = (rows ?? []) as Array<{
    status: NfeStatus;
    total_amount: number | null;
    protocol_at: string | null;
  }>;

  list.forEach((r) => {
    totals[r.status] = (totals[r.status] ?? 0) + 1;
    if (r.status === "authorized" && r.protocol_at && r.protocol_at >= monthStart) {
      monthAuthorized += 1;
      monthValue += Number(r.total_amount ?? 0);
    }
  });

  const { data: lastRow } = await supabase
    .from("fiscal_documents")
    .select(DOC_COLS)
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    totals,
    monthAuthorized,
    monthValue,
    lastDocument: lastRow ? mapDocument(lastRow as Row) : null,
  };
}

export async function fetchFiscalDocument(
  supabase: SupabaseClient,
  companyId: string,
  documentId: string,
): Promise<FiscalDocumentDto | null> {
  const { data, error } = await supabase
    .from("fiscal_documents")
    .select(DOC_COLS)
    .eq("company_id", companyId)
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapDocument(data as Row) : null;
}

export async function fetchFiscalDocumentEvents(
  supabase: SupabaseClient,
  companyId: string,
  documentId: string,
) {
  const { data, error } = await supabase
    .from("fiscal_events")
    .select("id, document_id, event_type, payload, created_at")
    .eq("company_id", companyId)
    .eq("document_id", documentId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    documentId: r.document_id,
    eventType: r.event_type,
    payloadJson: r.payload == null ? null : JSON.stringify(r.payload),
    createdAt: r.created_at,
  }));
}

export async function fetchFiscalDocumentContext(
  supabase: SupabaseClient,
  companyId: string,
  documentId: string,
): Promise<FiscalDocumentContext> {
  const { data: docRow } = await supabase
    .from("fiscal_documents")
    .select("sale_id")
    .eq("company_id", companyId)
    .eq("id", documentId)
    .maybeSingle();
  const saleId = (docRow as any)?.sale_id ?? null;

  let customerName: string | null = null;
  let customerDocument: string | null = null;
  let itemCount = 0;
  let saleNumber: number | null = null;

  if (saleId) {
    const { data: sale } = await supabase
      .from("sales")
      .select("number, customer_id")
      .eq("company_id", companyId)
      .eq("id", saleId)
      .maybeSingle();
    const s = sale as any;
    saleNumber = s?.number ?? null;
    if (s?.customer_id) {
      const { data: cust } = await supabase
        .from("customers")
        .select("name, document")
        .eq("company_id", companyId)
        .eq("id", s.customer_id)
        .maybeSingle();
      const c = cust as any;
      customerName = c?.name ?? null;
      customerDocument = c?.document ?? null;
    }
    const { count } = await supabase
      .from("sale_items")
      .select("id", { count: "exact", head: true })
      .eq("sale_id", saleId);
    itemCount = count ?? 0;
  }

  const { data: settings } = await supabase
    .from("fiscal_settings")
    .select("default_cfop, operation_nature")
    .eq("company_id", companyId)
    .maybeSingle();
  const st = settings as any;

  return {
    customerName,
    customerDocument,
    itemCount,
    cfop: st?.default_cfop ?? null,
    natureza: st?.operation_nature ?? null,
    saleNumber,
  };
}
