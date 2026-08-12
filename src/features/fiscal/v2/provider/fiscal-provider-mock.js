function fakeAccessKey() {
    // 44 dígitos, apenas para simular estrutura.
    let key = "";
    for (let i = 0; i < 44; i++)
        key += Math.floor(Math.random() * 10).toString();
    return key;
}
function fakeProtocol() {
    return `MOCK-${Date.now()}-${Math.floor(Math.random() * 100000)
        .toString()
        .padStart(5, "0")}`;
}
export class FiscalProviderMock {
    id = "mock";
    async issueNfe(payload) {
        // Rejeições determinísticas úteis nos testes:
        if (!payload.customer.document) {
            return {
                ok: false,
                status: "rejected",
                rejectionReason: "Documento do destinatário ausente.",
            };
        }
        if (payload.items.length === 0) {
            return {
                ok: false,
                status: "rejected",
                rejectionReason: "NF-e sem itens.",
            };
        }
        const accessKey = fakeAccessKey();
        return {
            ok: true,
            status: "authorized",
            accessKey,
            protocol: fakeProtocol(),
            number: Math.floor(Math.random() * 1000000) + 1,
            series: 1,
            providerRef: `mock-${accessKey.slice(-8)}`,
            xmlSignedPath: `mock/xml/signed/${accessKey}.xml`,
            xmlAuthorizedPath: `mock/xml/authorized/${accessKey}.xml`,
            danfePath: `mock/danfe/${accessKey}.pdf`,
        };
    }
    async getStatus() {
        return { ok: true, status: "authorized" };
    }
    async cancelNfe(_ref, _reason) {
        return {
            ok: true,
            status: "cancelled",
            protocol: fakeProtocol(),
            cancelledAt: new Date().toISOString(),
        };
    }
}
