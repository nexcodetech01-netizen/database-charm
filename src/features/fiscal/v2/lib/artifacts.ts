/**
 * Fiscal v2 — Persistência resiliente de artefatos (XML/DANFE/cancelamento).
 *
 * Módulo PURO (sem I/O): concentra as regras de nomeação, cálculo de
 * pendências e idempotência do reprocessamento. É importado tanto pelo motor
 * server-only quanto pela UI, por isso não pode tocar em Supabase/Node.
 */

export type FiscalArtifactKind = "xml_authorized" | "danfe" | "xml_cancellation";

export const FISCAL_ARTIFACT_KINDS: readonly FiscalArtifactKind[] = [
  "xml_authorized",
  "danfe",
  "xml_cancellation",
] as const;

export const ARTIFACT_LABELS: Record<FiscalArtifactKind, string> = {
  xml_authorized: "XML autorizado",
  danfe: "DANFE",
  xml_cancellation: "XML de cancelamento",
};

/** Estágio em que a persistência falhou — usado em evento/auditoria/log. */
export type ArtifactFailureStage = "download" | "upload" | "empty" | "unsupported";

export type ArtifactPersistResult =
  | { ok: true; path: string; skipped?: boolean }
  | { ok: false; stage: ArtifactFailureStage; message: string };

/** Documento mínimo necessário para raciocinar sobre artefatos. */
export type ArtifactDocLike = {
  id: string;
  status: string;
  accessKey?: string | null;
  xmlAuthorizedPath?: string | null;
  danfePath?: string | null;
  xmlCancellationPath?: string | null;
  artifactsPending?: string[] | null;
};

export function isFiscalArtifactKind(value: unknown): value is FiscalArtifactKind {
  return (
    typeof value === "string" &&
    (FISCAL_ARTIFACT_KINDS as readonly string[]).includes(value)
  );
}

/** Normaliza a lista vinda do banco (texto livre) para kinds válidos e únicos. */
export function normalizePendingKinds(value: unknown): FiscalArtifactKind[] {
  const arr = Array.isArray(value) ? value : [];
  const out: FiscalArtifactKind[] = [];
  for (const item of arr) {
    if (isFiscalArtifactKind(item) && !out.includes(item)) out.push(item);
  }
  return out;
}

/** Caminho canônico do objeto dentro de `fiscal-artifacts/<companyId>/`. */
export function artifactObjectPath(
  kind: FiscalArtifactKind,
  doc: { id: string; accessKey?: string | null },
): string {
  const key = doc.accessKey || doc.id;
  if (kind === "xml_authorized") return `nfe/${key}.xml`;
  if (kind === "danfe") return `nfe/${key}.pdf`;
  return `${doc.id}/cancelamento.xml`;
}

/** Coluna de `fiscal_documents` que guarda o caminho de cada artefato. */
export function artifactPathColumn(kind: FiscalArtifactKind): string {
  if (kind === "xml_authorized") return "xml_authorized_path";
  if (kind === "danfe") return "danfe_path";
  return "xml_cancellation_path";
}

export function artifactStoredPath(
  kind: FiscalArtifactKind,
  doc: ArtifactDocLike,
): string | null {
  if (kind === "xml_authorized") return doc.xmlAuthorizedPath ?? null;
  if (kind === "danfe") return doc.danfePath ?? null;
  return doc.xmlCancellationPath ?? null;
}

/**
 * Artefatos que o documento DEVERIA possuir no estado atual.
 * Só documentos que chegaram à SEFAZ têm artefatos esperados.
 */
export function expectedArtifacts(doc: ArtifactDocLike): FiscalArtifactKind[] {
  if (doc.status === "authorized") return ["xml_authorized", "danfe"];
  if (doc.status === "cancelled")
    return ["xml_authorized", "danfe", "xml_cancellation"];
  return [];
}

/** Pendências reais = esperado − já armazenado. Base da idempotência. */
export function computePendingArtifacts(doc: ArtifactDocLike): FiscalArtifactKind[] {
  return expectedArtifacts(doc).filter((kind) => !artifactStoredPath(kind, doc));
}

/** Adiciona uma pendência sem duplicar (merge idempotente). */
export function addPending(
  current: unknown,
  kind: FiscalArtifactKind,
): FiscalArtifactKind[] {
  const list = normalizePendingKinds(current);
  return list.includes(kind) ? list : [...list, kind];
}

/** Remove pendências resolvidas. */
export function clearPending(
  current: unknown,
  resolved: FiscalArtifactKind[],
): FiscalArtifactKind[] {
  return normalizePendingKinds(current).filter((k) => !resolved.includes(k));
}

/** `true` quando existe pelo menos um artefato pendente. */
export function hasPendingArtifacts(doc: ArtifactDocLike): boolean {
  return normalizePendingKinds(doc.artifactsPending).length > 0;
}

/** Documento pode ser reprocessado? Nunca reenvia NF-e — só recupera arquivos. */
export function canReprocessArtifacts(doc: ArtifactDocLike): boolean {
  return expectedArtifacts(doc).length > 0 && computePendingArtifacts(doc).length > 0;
}

export function describePending(kinds: FiscalArtifactKind[]): string {
  return kinds.map((k) => ARTIFACT_LABELS[k]).join(", ");
}

/** URLs conhecidas de artefatos, por kind. */
export type ArtifactUrlMap = Partial<Record<FiscalArtifactKind, string>>;

function pick(obj: Record<string, unknown> | null, keys: string[]): string | undefined {
  if (!obj) return undefined;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/**
 * Extrai URLs de artefatos de um payload do provedor (resposta armazenada em
 * `response_payload` ou retorno fresco de `getStatus`). Aceita tanto o formato
 * normalizado do NexOS (`xmlUrl`/`danfeUrl`) quanto o cru da Focus NFe.
 */
export function extractArtifactUrls(payload: unknown): ArtifactUrlMap {
  const root = (payload ?? null) as Record<string, unknown> | null;
  const raw = (root?.raw ?? null) as Record<string, unknown> | null;
  const out: ArtifactUrlMap = {};
  const xml =
    pick(root, ["xmlUrl", "xml_url", "caminho_xml_nota_fiscal"]) ??
    pick(raw, ["caminho_xml_nota_fiscal", "xmlUrl"]);
  const danfe =
    pick(root, ["danfeUrl", "danfe_url", "caminho_danfe"]) ??
    pick(raw, ["caminho_danfe", "danfeUrl"]);
  const cancel =
    pick(root, ["cancellationXmlUrl", "caminho_xml_cancelamento"]) ??
    pick(raw, ["caminho_xml_cancelamento", "cancellationXmlUrl"]);
  if (xml) out.xml_authorized = xml;
  if (danfe) out.danfe = danfe;
  if (cancel) out.xml_cancellation = cancel;
  return out;
}

/** Combina fontes de URL priorizando a primeira que tiver o valor. */
export function mergeArtifactUrls(...maps: ArtifactUrlMap[]): ArtifactUrlMap {
  const out: ArtifactUrlMap = {};
  for (const map of maps) {
    for (const kind of FISCAL_ARTIFACT_KINDS) {
      if (!out[kind] && map[kind]) out[kind] = map[kind];
    }
  }
  return out;
}
