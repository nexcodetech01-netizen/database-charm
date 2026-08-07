/**
 * Fiscal v2 — Repositório de fiscal_documents (Sprint 007.3).
 *
 * Alinhado ao schema real do banco:
 *  - colunas: provider (não provider_id), xml_signed_path (não xml_sent_path),
 *    protocol_at (não authorized_at), cancellation_reason, cancellation_protocol,
 *    rejection_code
 *  - environment: enum ÚNICO em todo o sistema — "homologation" | "production".
 *
 * Acesso via cliente RLS-scoped do ExecutionContext. company_id
 * sempre injetado.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  FiscalDocument,
  NfeEnvironment,
  NfeStatus,
} from "../types";
import { normalizeFiscalEnvironment } from "../types/environment";

type Row = Record<string, unknown>;

function toDbEnv(env: NfeEnvironment): NfeEnvironment {
  return normalizeFiscalEnvironment(env);
}
function fromDbEnv(v: unknown): NfeEnvironment {
  return normalizeFiscalEnvironment(v);
}


function map(row: Row): FiscalDocument {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    saleId: (row.sale_id as string) ?? null,
    number: (row.number as number) ?? null,
    series: (row.series as number) ?? null,
    accessKey: (row.access_key as string) ?? null,
    status: row.status as NfeStatus,
    environment: fromDbEnv(row.environment),
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
    artifactsPending: [], // Map if needed
    artifactsLastError: null,
    artifactsCheckedAt: null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}


export interface CreateDocumentInput {
  saleId: string | null;
  totalAmount: number;
  environment: NfeEnvironment;
  provider: string | null;
}

export interface SearchDocumentsFilter {
  status?: NfeStatus;
  saleId?: string;
  accessKey?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

export type UpdateDocumentPatch = Partial<
  Pick<
    FiscalDocument,
    | "status"
    | "accessKey"
    | "number"
    | "series"
    | "protocol"
    | "protocolAt"
    | "cancelledAt"
    | "cancellationReason"
    | "cancellationProtocol"
    | "rejectionCode"
    | "rejectionReason"
    | "xmlSignedPath"
    | "xmlAuthorizedPath"
    | "danfePath"
    | "provider"
  >
>;

export class FiscalDocumentsRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly companyId: string,
  ) {}

  async create(input: CreateDocumentInput): Promise<FiscalDocument> {
    const { data, error } = await this.supabase
      .from("fiscal_documents")
      .insert({
        company_id: this.companyId,
        sale_id: input.saleId,
        total_amount: input.totalAmount,
        environment: toDbEnv(input.environment),
        provider: input.provider ?? "mock",
        status: "draft",
      })
      .select("*")
      .single();
    if (error) throw error;
    return map(data as Row);
  }

  async findById(id: string): Promise<FiscalDocument | null> {
    const { data, error } = await this.supabase
      .from("fiscal_documents")
      .select("*")
      .eq("company_id", this.companyId)
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    return data ? map(data as Row) : null;
  }

  async findByAccessKey(key: string): Promise<FiscalDocument | null> {
    const { data, error } = await this.supabase
      .from("fiscal_documents")
      .select("*")
      .eq("company_id", this.companyId)
      .eq("access_key", key)
      .maybeSingle();
    if (error) throw error;
    return data ? map(data as Row) : null;
  }

  async findBySaleId(saleId: string): Promise<FiscalDocument | null> {
    const { data, error } = await this.supabase
      .from("fiscal_documents")
      .select("*")
      .eq("company_id", this.companyId)
      .eq("sale_id", saleId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data ? map(data as Row) : null;
  }

  async search(filter: SearchDocumentsFilter): Promise<FiscalDocument[]> {
    let q = this.supabase
      .from("fiscal_documents")
      .select("*")
      .eq("company_id", this.companyId);
    if (filter.status) q = q.eq("status", filter.status);
    if (filter.saleId) q = q.eq("sale_id", filter.saleId);
    if (filter.accessKey) q = q.eq("access_key", filter.accessKey);
    if (filter.dateFrom) q = q.gte("created_at", filter.dateFrom);
    if (filter.dateTo) q = q.lte("created_at", filter.dateTo);
    q = q.order("created_at", { ascending: false }).limit(filter.limit ?? 20);
    const { data, error } = await q;
    if (error) throw error;
    return ((data ?? []) as Row[]).map(map);
  }

  async updateStatus(id: string, patch: UpdateDocumentPatch): Promise<FiscalDocument> {
    const row: Row = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.accessKey !== undefined) row.access_key = patch.accessKey;
    if (patch.number !== undefined) row.number = patch.number;
    if (patch.series !== undefined) row.series = patch.series;
    if (patch.protocol !== undefined) row.protocol = patch.protocol;
    if (patch.protocolAt !== undefined) row.protocol_at = patch.protocolAt;
    if (patch.cancelledAt !== undefined) row.cancelled_at = patch.cancelledAt;
    if (patch.cancellationReason !== undefined)
      row.cancellation_reason = patch.cancellationReason;
    if (patch.cancellationProtocol !== undefined)
      row.cancellation_protocol = patch.cancellationProtocol;
    if (patch.rejectionCode !== undefined) row.rejection_code = patch.rejectionCode;
    if (patch.rejectionReason !== undefined) row.rejection_reason = patch.rejectionReason;
    if (patch.xmlSignedPath !== undefined) row.xml_signed_path = patch.xmlSignedPath;
    if (patch.xmlAuthorizedPath !== undefined)
      row.xml_authorized_path = patch.xmlAuthorizedPath;
    if (patch.danfePath !== undefined) row.danfe_path = patch.danfePath;
    if (patch.provider !== undefined) row.provider = patch.provider;

    const { data, error } = await this.supabase
      .from("fiscal_documents")
      .update(row)
      .eq("company_id", this.companyId)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return map(data as Row);
  }
}
