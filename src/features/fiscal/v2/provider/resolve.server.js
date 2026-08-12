import { FiscalProviderMock } from "./fiscal-provider-mock";
import { FiscalProviderFocusNfe } from "./fiscal-provider-focus.server";
export class FiscalProviderNotConfiguredError extends Error {
}
export function resolveFiscalProviderFor(input) {
    const id = (input.providerId ?? "mock").toLowerCase();
    // Diagnóstico: valores carregados da configuração antes de instanciar o
    // provider (nunca loga a credencial, apenas se ela existe).
    console.info("[fiscal] resolveFiscalProviderFor", {
        providerId: id,
        environment: input.environment,
        apiUrl: input.apiUrl ?? "(fallback do provider)",
        hasApiKey: Boolean(input.apiKey),
        hasAdminApiKey: Boolean(input.adminApiKey),
    });
    if (id === "mock" || id === "")
        return new FiscalProviderMock();
    if (id === "focusnfe" || id === "focus_nfe" || id === "focus") {
        if (!input.apiKey) {
            throw new FiscalProviderNotConfiguredError("API key do provedor não configurada. Cadastre em Fiscal → Configuração → Provedor.");
        }
        return new FiscalProviderFocusNfe({
            token: input.apiKey,
            adminToken: input.adminApiKey ?? null,
            environment: input.environment,
            baseUrl: input.apiUrl ?? null,
        });
    }
    throw new FiscalProviderNotConfiguredError(`Provedor "${id}" ainda não possui integração implementada. Use Focus NFe ou Mock.`);
}
