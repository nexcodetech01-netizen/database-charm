/**
 * Fiscal v2 — Persistência resiliente de artefatos (XML/DANFE/cancelamento).
 *
 * Módulo PURO (sem I/O): concentra as regras de nomeação, cálculo de
 * pendências e idempotência do reprocessamento. É importado tanto pelo motor
 * server-only quanto pela UI, por isso não pode tocar em Supabase/Node.
 */
export const FISCAL_ARTIFACT_KINDS = [
    "xml_authorized",
    "danfe",
    "xml_cancellation",
];
export const ARTIFACT_LABELS = {
    xml_authorized: "XML autorizado",
    danfe: "DANFE",
    xml_cancellation: "XML de cancelamento",
};
export function isFiscalArtifactKind(value) {
    return (typeof value === "string" &&
        FISCAL_ARTIFACT_KINDS.includes(value));
}
/** Normaliza a lista vinda do banco (texto livre) para kinds válidos e únicos. */
export function normalizePendingKinds(value) {
    const arr = Array.isArray(value) ? value : [];
    const out = [];
    for (const item of arr) {
        if (isFiscalArtifactKind(item) && !out.includes(item))
            out.push(item);
    }
    return out;
}
/** Caminho canônico do objeto dentro de `fiscal-artifacts/<companyId>/`. */
export function artifactObjectPath(kind, doc) {
    const key = doc.accessKey || doc.id;
    if (kind === "xml_authorized")
        return `nfe/${key}.xml`;
    if (kind === "danfe")
        return `nfe/${key}.pdf`;
    return `${doc.id}/cancelamento.xml`;
}
/** Coluna de `fiscal_documents` que guarda o caminho de cada artefato. */
export function artifactPathColumn(kind) {
    if (kind === "xml_authorized")
        return "xml_authorized_path";
    if (kind === "danfe")
        return "danfe_path";
    return "xml_cancellation_path";
}
export function artifactStoredPath(kind, doc) {
    if (kind === "xml_authorized")
        return doc.xmlAuthorizedPath ?? null;
    if (kind === "danfe")
        return doc.danfePath ?? null;
    return doc.xmlCancellationPath ?? null;
}
/**
 * Artefatos que o documento DEVERIA possuir no estado atual.
 * Só documentos que chegaram à SEFAZ têm artefatos esperados.
 */
export function expectedArtifacts(doc) {
    if (doc.status === "authorized")
        return ["xml_authorized", "danfe"];
    if (doc.status === "cancelled")
        return ["xml_authorized", "danfe", "xml_cancellation"];
    return [];
}
/** Pendências reais = esperado − já armazenado. Base da idempotência. */
export function computePendingArtifacts(doc) {
    return expectedArtifacts(doc).filter((kind) => !artifactStoredPath(kind, doc));
}
/** Adiciona uma pendência sem duplicar (merge idempotente). */
export function addPending(current, kind) {
    const list = normalizePendingKinds(current);
    return list.includes(kind) ? list : [...list, kind];
}
/** Remove pendências resolvidas. */
export function clearPending(current, resolved) {
    return normalizePendingKinds(current).filter((k) => !resolved.includes(k));
}
/** `true` quando existe pelo menos um artefato pendente. */
export function hasPendingArtifacts(doc) {
    return normalizePendingKinds(doc.artifactsPending).length > 0;
}
/** Documento pode ser reprocessado? Nunca reenvia NF-e — só recupera arquivos. */
export function canReprocessArtifacts(doc) {
    return expectedArtifacts(doc).length > 0 && computePendingArtifacts(doc).length > 0;
}
export function describePending(kinds) {
    return kinds.map((k) => ARTIFACT_LABELS[k]).join(", ");
}
function pick(obj, keys) {
    if (!obj)
        return undefined;
    for (const k of keys) {
        const v = obj[k];
        if (typeof v === "string" && v.trim())
            return v.trim();
    }
    return undefined;
}
/**
 * Extrai URLs de artefatos de um payload do provedor (resposta armazenada em
 * `response_payload` ou retorno fresco de `getStatus`). Aceita tanto o formato
 * normalizado do NexOS (`xmlUrl`/`danfeUrl`) quanto o cru da Focus NFe.
 */
export function extractArtifactUrls(payload) {
    const root = (payload ?? null);
    const raw = (root?.raw ?? null);
    const out = {};
    const xml = pick(root, ["xmlUrl", "xml_url", "caminho_xml_nota_fiscal"]) ??
        pick(raw, ["caminho_xml_nota_fiscal", "xmlUrl"]);
    const danfe = pick(root, ["danfeUrl", "danfe_url", "caminho_danfe"]) ??
        pick(raw, ["caminho_danfe", "danfeUrl"]);
    const cancel = pick(root, ["cancellationXmlUrl", "caminho_xml_cancelamento"]) ??
        pick(raw, ["caminho_xml_cancelamento", "cancellationXmlUrl"]);
    if (xml)
        out.xml_authorized = xml;
    if (danfe)
        out.danfe = danfe;
    if (cancel)
        out.xml_cancellation = cancel;
    return out;
}
/** Combina fontes de URL priorizando a primeira que tiver o valor. */
export function mergeArtifactUrls(...maps) {
    const out = {};
    for (const map of maps) {
        for (const kind of FISCAL_ARTIFACT_KINDS) {
            if (!out[kind] && map[kind])
                out[kind] = map[kind];
        }
    }
    return out;
}
