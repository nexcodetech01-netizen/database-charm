/**
 * Fiscal v2 — Feature flags (SERVER-ONLY).
 *
 * `ENABLE_CRT4_MEI` controla se `regime_tributario_emitente=4` (MEI) é
 * efetivamente enviado ao provedor fiscal. Default: false — mantém o
 * comportamento atual (envia 1) até a validação em homologação.
 */
function readBoolean(name, fallback = false) {
    const raw = typeof process !== "undefined" ? process.env?.[name] : undefined;
    if (raw == null || raw === "")
        return fallback;
    return ["1", "true", "on", "yes"].includes(String(raw).trim().toLowerCase());
}
/** Default false. Ligue com ENABLE_CRT4_MEI=true no ambiente. */
export function isCrt4MeiEnabled() {
    return readBoolean("ENABLE_CRT4_MEI", false);
}
