import { FISCAL_DOCUMENT_COLUMNS } from "../lib/document-columns";
import { normalizePendingKinds } from "../lib/artifacts";
const DOC_COLS = FISCAL_DOCUMENT_COLUMNS;
/** Normaliza linhas de `fiscal_documents` para o formato DTO. */
export function mapDocument(row) {
    return {
        id: row.id,
        companyId: row.company_id,
        saleId: row.sale_id ?? null,
        number: row.number ?? null,
        series: row.series ?? null,
        accessKey: row.access_key ?? null,
        status: row.status,
        environment: row.environment,
        totalAmount: Number(row.total_amount ?? 0),
        xmlSignedPath: row.xml_signed_path ?? null,
        xmlAuthorizedPath: row.xml_authorized_path ?? null,
        danfePath: row.danfe_path ?? null,
        protocol: row.protocol ?? null,
        protocolAt: row.protocol_at ?? null,
        cancelledAt: row.cancelled_at ?? null,
        cancellationReason: row.cancellation_reason ?? null,
        cancellationProtocol: row.cancellation_protocol ?? null,
        cancelledBy: row.cancelled_by ?? null,
        xmlCancellationPath: row.xml_cancellation_path ?? null,
        rejectionCode: row.rejection_code ?? null,
        rejectionReason: row.rejection_reason ?? null,
        provider: row.provider ?? null,
        discardedAt: row.discarded_at ?? null,
        discardedBy: row.discarded_by ?? null,
        discardReason: row.discard_reason ?? null,
        artifactsPending: normalizePendingKinds(row.artifacts_pending),
        artifactsLastError: row.artifacts_last_error ?? null,
        artifactsCheckedAt: row.artifacts_checked_at ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
export async function fetchFiscalDocuments(supabase, companyId, filter) {
    let q = supabase
        .from("fiscal_documents")
        .select(DOC_COLS)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(filter.limit ?? 100);
    if (filter.status && filter.status !== "all")
        q = q.eq("status", filter.status);
    if (filter.saleId)
        q = q.eq("sale_id", filter.saleId);
    if (filter.from)
        q = q.gte("created_at", filter.from);
    if (filter.to)
        q = q.lte("created_at", filter.to);
    if (filter.search) {
        const term = filter.search.replace(/[%,]/g, "");
        q = q.or(`access_key.ilike.%${term}%,protocol.ilike.%${term}%`);
    }
    const { data, error } = await q;
    if (error)
        throw error;
    return (data ?? []).map(mapDocument);
}
export async function fetchFiscalDashboard(supabase, companyId) {
    const { data: rows, error } = await supabase
        .from("fiscal_documents")
        .select("status, total_amount, protocol_at")
        .eq("company_id", companyId);
    if (error)
        throw error;
    const totals = {
        draft: 0, validating: 0, signing: 0, sending: 0, authorized: 0,
        rejected: 0, cancelling: 0, cancelled: 0, error: 0, discarded: 0,
    };
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    let monthAuthorized = 0;
    let monthValue = 0;
    const list = (rows ?? []);
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
        lastDocument: lastRow ? mapDocument(lastRow) : null,
    };
}
export async function fetchFiscalDocument(supabase, companyId, documentId) {
    const { data, error } = await supabase
        .from("fiscal_documents")
        .select(DOC_COLS)
        .eq("company_id", companyId)
        .eq("id", documentId)
        .maybeSingle();
    if (error)
        throw error;
    return data ? mapDocument(data) : null;
}
export async function fetchFiscalDocumentEvents(supabase, companyId, documentId) {
    const { data, error } = await supabase
        .from("fiscal_events")
        .select("id, document_id, event_type, payload, created_at")
        .eq("company_id", companyId)
        .eq("document_id", documentId)
        .order("created_at", { ascending: true });
    if (error)
        throw error;
    return (data ?? []).map((r) => ({
        id: r.id,
        documentId: r.document_id,
        eventType: r.event_type,
        payloadJson: r.payload == null ? null : JSON.stringify(r.payload),
        createdAt: r.created_at,
    }));
}
export async function fetchFiscalDocumentContext(supabase, companyId, documentId) {
    const { data: docRow } = await supabase
        .from("fiscal_documents")
        .select("sale_id")
        .eq("company_id", companyId)
        .eq("id", documentId)
        .maybeSingle();
    const saleId = docRow?.sale_id ?? null;
    let customerName = null;
    let customerDocument = null;
    let itemCount = 0;
    let saleNumber = null;
    if (saleId) {
        const { data: sale } = await supabase
            .from("sales")
            .select("number, customer_id")
            .eq("company_id", companyId)
            .eq("id", saleId)
            .maybeSingle();
        const s = sale;
        saleNumber = s?.number ?? null;
        if (s?.customer_id) {
            const { data: cust } = await supabase
                .from("customers")
                .select("name, document")
                .eq("company_id", companyId)
                .eq("id", s.customer_id)
                .maybeSingle();
            const c = cust;
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
    const st = settings;
    return {
        customerName,
        customerDocument,
        itemCount,
        cfop: st?.default_cfop ?? null,
        natureza: st?.operation_nature ?? null,
        saleNumber,
    };
}
