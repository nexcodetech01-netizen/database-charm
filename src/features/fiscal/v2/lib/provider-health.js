/**
 * Fiscal v2 — Diagnóstico do provedor, item a item (puro, testável).
 *
 * Não faz I/O: recebe os FATOS já coletados (credenciais presentes, probes
 * HTTP, certificado, provisionamento) e devolve o veredito de cada item.
 *
 * Regras de ouro:
 *  - Produção e Homologação são avaliadas separadamente, cada uma com as
 *    suas próprias credenciais/URL. Nunca há herança entre ambientes.
 *  - O Token Principal (Admin) responde por `/v2/empresas`; o Token Empresa
 *    responde por `/v2/nfe`. Cada um tem o seu item de diagnóstico.
 *  - HTTP 404 no probe de emissão prova apenas que a AUTENTICAÇÃO passou.
 *    Nunca é traduzido como "tudo certo": o veredito global só é `ok`
 *    quando TODOS os itens estão `ok`.
 */
export const HEALTH_ITEM_LABEL = {
    admin_token: "Token Principal (Admin)",
    company_token: "Token Empresa (Emissão)",
    api: "API",
    certificate: "Certificado A1",
    provisioning: "Provisionamento",
};
function item(id, status, message) {
    return { id, label: HEALTH_ITEM_LABEL[id], status, message };
}
/** Traduz um probe autenticado em veredito de credencial. */
function judgeToken(probe, opts) {
    if (probe.networkError) {
        return { status: "error", message: `Falha de rede: ${probe.networkError}` };
    }
    if (opts.authOkStatuses.includes(probe.httpStatus)) {
        return {
            status: "ok",
            message: `Autenticação aceita (HTTP ${probe.httpStatus}, ${probe.durationMs}ms).`,
        };
    }
    if (probe.httpStatus === 401) {
        return {
            status: "error",
            message: "Credencial recusada (HTTP 401). A Focus emite tokens distintos por ambiente — confirme que este token é deste ambiente.",
        };
    }
    if (probe.httpStatus === 403) {
        return {
            status: "error",
            message: `Escopo insuficiente para este token (HTTP 403).${probe.detail ? ` ${probe.detail}` : ""}`,
        };
    }
    if (probe.httpStatus >= 500) {
        return {
            status: "warning",
            message: `Serviço do provedor indisponível (HTTP ${probe.httpStatus}).`,
        };
    }
    return {
        status: "warning",
        message: `Resposta inesperada (HTTP ${probe.httpStatus}).${probe.detail ? ` ${probe.detail}` : ""}`,
    };
}
export function buildProviderHealthItems(facts) {
    const isMock = facts.providerId === "mock" || !facts.providerId;
    if (isMock) {
        return [
            item("admin_token", "skipped", "Provedor Mock não usa credenciais."),
            item("company_token", "skipped", "Provedor Mock não usa credenciais."),
            item("api", "warning", "Provedor ainda em Mock (selecione Focus NFe)."),
            item("certificate", facts.hasActiveCertificate ? "ok" : "warning", facts.hasActiveCertificate
                ? "Certificado A1 ativo."
                : "Nenhum certificado A1 ativo (não exigido pelo Mock)."),
            item("provisioning", "skipped", "Provedor Mock não exige provisionamento."),
        ];
    }
    const items = [];
    // 1) Token Principal (Admin) — /v2/empresas.
    if (!facts.hasAdminToken) {
        items.push(item("admin_token", facts.provisionedAt ? "warning" : "error", facts.provisionedAt
            ? "Não cadastrado. A empresa já está provisionada, então a emissão segue funcionando; cadastre-o antes de trocar o certificado A1."
            : "Não cadastrado. É obrigatório para cadastrar a empresa e o certificado A1 no provedor (POST /v2/empresas)."));
    }
    else if (!facts.adminProbe) {
        items.push(item("admin_token", "warning", "Cadastrado (sem probe disponível)."));
    }
    else {
        const verdict = judgeToken(facts.adminProbe, { authOkStatuses: [200] });
        items.push(item("admin_token", verdict.status, verdict.message));
    }
    // 2) Token Empresa — /v2/nfe.
    if (!facts.hasCompanyToken) {
        items.push(item("company_token", "error", "Não cadastrado. Sem ele não é possível emitir NF-e."));
    }
    else if (!facts.companyProbe) {
        items.push(item("company_token", "warning", "Cadastrado (sem probe disponível)."));
    }
    else {
        // 404 em `/v2/nfe/{ref inexistente}` = credencial válida.
        const verdict = judgeToken(facts.companyProbe, { authOkStatuses: [200, 404] });
        items.push(item("company_token", verdict.status, verdict.message));
    }
    // 3) API (URL + alcançabilidade).
    if (!facts.apiUrl) {
        items.push(item("api", "error", "URL da API não informada para este ambiente."));
    }
    else {
        const probes = [facts.companyProbe, facts.adminProbe].filter(Boolean);
        const networkError = probes.find((p) => p.networkError)?.networkError;
        const unavailable = probes.find((p) => p.httpStatus >= 500);
        if (networkError) {
            items.push(item("api", "error", `Não foi possível contatar ${facts.apiUrl}: ${networkError}`));
        }
        else if (unavailable) {
            items.push(item("api", "warning", `Provedor respondeu HTTP ${unavailable.httpStatus} em ${facts.apiUrl}.`));
        }
        else if (probes.length === 0) {
            items.push(item("api", "warning", `URL configurada (${facts.apiUrl}), sem probe executado.`));
        }
        else {
            items.push(item("api", "ok", `Endpoint respondendo em ${facts.apiUrl}.`));
        }
    }
    // 4) Certificado A1.
    items.push(item("certificate", facts.hasActiveCertificate ? "ok" : "error", facts.hasActiveCertificate
        ? "Certificado A1 ativo."
        : "Nenhum certificado A1 ativo cadastrado."));
    // 5) Provisionamento no provedor (POST /v2/empresas já executado).
    items.push(item("provisioning", facts.provisionedAt ? "ok" : "error", facts.provisionedAt
        ? `Empresa provisionada neste ambiente em ${facts.provisionedAt}.`
        : "Empresa ainda não provisionada neste ambiente (execute o envio do certificado ao provedor)."));
    return items;
}
/** Veredito global: `ok` somente quando nenhum item está em warning/error. */
export function summarizeProviderHealth(items) {
    const failed = items.filter((i) => i.status === "error");
    const warned = items.filter((i) => i.status === "warning");
    if (failed.length > 0) {
        return {
            status: "error",
            message: failed.map((i) => `${i.label}: ${i.message}`).join(" "),
        };
    }
    if (warned.length > 0) {
        return {
            status: "warning",
            message: warned.map((i) => `${i.label}: ${i.message}`).join(" "),
        };
    }
    return { status: "ok", message: "Todos os itens verificados com sucesso." };
}
