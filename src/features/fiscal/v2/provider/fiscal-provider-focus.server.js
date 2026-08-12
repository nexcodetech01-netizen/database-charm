import { allocateDiscount, round2 } from "../lib/document-totals";
import { resolveCommercialCode, resolveCommercialUnit } from "../lib/item-identity";
import { resolveItemTaxes, toFocusTaxFields } from "../lib/item-taxes";
import { resolveProviderCrt } from "../lib/crt";
import { isCrt4MeiEnabled } from "../lib/feature-flags.server";
import { integrationFetch } from "@/lib/http-client.server";
const HOMOLOG_BASE = "https://homologacao.focusnfe.com.br";
const PROD_BASE = "https://api.focusnfe.com.br";
/** Protocolo do evento de cancelamento, tolerando as variações da Focus. */
function cancellationProtocolOf(json) {
    return (json.protocolo_cancelamento ??
        json.numero_protocolo_cancelamento ??
        json.cancelamento?.protocolo ??
        json.cancelamento?.numero_protocolo ??
        undefined);
}
/**
 * Recurso da API Focus por modelo do documento.
 * `55` → /v2/nfe (NF-e) · `65` → /v2/nfce (NFC-e). Mesma API, mesmo token.
 */
function resourceFor(model) {
    return model === "65" ? "nfce" : "nfe";
}
/**
 * Código SEFAZ da forma de pagamento (tabela tPag) a partir do meio de
 * pagamento do motor de vendas. Default 99 (outros) — nunca lança.
 */
export function focusPaymentCode(method) {
    switch ((method ?? "").toLowerCase()) {
        case "cash":
        case "dinheiro":
            return "01";
        case "credit":
        case "credit_card":
        case "cartao_credito":
            return "03";
        case "debit":
        case "debit_card":
        case "cartao_debito":
            return "04";
        case "pix":
            return "17";
        case "boleto":
            return "15";
        case "transfer":
        case "transferencia":
            return "16";
        default:
            return "99";
    }
}
function digits(value) {
    return (value ?? "").replace(/\D/g, "");
}
function mapFocusStatus(status) {
    switch (status) {
        case "autorizado":
            return "authorized";
        case "cancelado":
            return "cancelled";
        case "processando_cancelamento":
            return "cancelling";
        case "processando_autorizacao":
            return "sending";
        case "erro_autorizacao":
        case "denegado":
            return "rejected";
        default:
            return "sending";
    }
}
export class FiscalProviderFocusNfe {
    options;
    id = "focusnfe";
    requiresCertificate = true;
    base;
    constructor(options) {
        this.options = options;
        const fallback = options.environment === "production" ? PROD_BASE : HOMOLOG_BASE;
        this.base = (options.baseUrl || fallback).replace(/\/+$/, "");
    }
    // ------------------------------------------------------------- transport
    /** Token efetivo para a credencial pedida (admin cai para empresa por compat). */
    tokenFor(credential) {
        if (credential === "admin") {
            return this.options.adminToken?.trim() || this.options.token;
        }
        return this.options.token;
    }
    /** Indica se a credencial administrativa foi realmente cadastrada. */
    hasDedicatedAdminToken() {
        return Boolean(this.options.adminToken?.trim());
    }
    authHeader(credential) {
        const raw = `${this.tokenFor(credential)}:`;
        const encoded = typeof btoa === "function" ? btoa(raw) : Buffer.from(raw, "utf8").toString("base64");
        return `Basic ${encoded}`;
    }
    async request(method, path, body, credential = "company") {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 30000);
        try {
            const resp = await integrationFetch(`${this.base}${path}`, {
                method,
                headers: {
                    Authorization: this.authHeader(credential),
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: controller.signal,
            }, { integration: `focus-nfe:${credential}`, timeoutMs: 30000 });
            const text = await resp.text();
            let json = {};
            try {
                json = text ? JSON.parse(text) : {};
            }
            catch {
                json = { mensagem: text.slice(0, 400) };
            }
            return { httpStatus: resp.status, json };
        }
        finally {
            clearTimeout(timer);
        }
    }
    reason(json) {
        const detail = (json.erros ?? [])
            .map((e) => [e.campo, e.mensagem].filter(Boolean).join(": "))
            .filter(Boolean)
            .join(" | ");
        return json.mensagem_sefaz ?? json.mensagem ?? detail ?? "Falha não detalhada pelo provedor.";
    }
    absolute(path) {
        if (!path)
            return undefined;
        return path.startsWith("http") ? path : `${this.base}${path}`;
    }
    // ----------------------------------------------------------- poll (único)
    /**
     * Mecanismo ÚNICO de polling do provedor — usado tanto pela emissão quanto
     * pelo cancelamento. `isFinal` decide quando o estado deixou de ser
     * transitório. Nunca lança: devolve o último estado observado.
     */
    async pollStatus(ref, isFinal, seed, scope) {
        const attempts = this.options.pollAttempts ?? 8;
        const interval = this.options.pollIntervalMs ?? 1500;
        let last = seed;
        const startedAt = Date.now();
        for (let i = 0; i < attempts; i++) {
            await new Promise((r) => setTimeout(r, interval));
            last = await this.getStatus(ref);
            console.info("[fiscal] provider.poll", {
                scope,
                attempt: i + 1,
                attempts,
                status: last.status,
                elapsedMs: Date.now() - startedAt,
            });
            if (isFinal(last))
                return last;
        }
        console.warn("[fiscal] provider.poll.timeout", {
            scope,
            attempts,
            status: last.status,
            elapsedMs: Date.now() - startedAt,
        });
        return last;
    }
    // ---------------------------------------------------------------- issue
    async issueNfe(payload) {
        const ref = payload.reference ?? payload.saleId;
        const body = this.buildBody(payload);
        const resource = resourceFor(payload.model);
        const sent = await this.request("POST", `/v2/${resource}?ref=${encodeURIComponent(ref)}`, body);
        // 422/400 → rejeição imediata (erro de schema/validação Focus).
        if (sent.httpStatus >= 400 && sent.httpStatus !== 409) {
            return {
                ok: false,
                status: "rejected",
                providerRef: ref,
                rejectionCode: String(sent.json.codigo ?? sent.httpStatus),
                rejectionReason: this.reason(sent.json),
                raw: sent.json,
            };
        }
        // Focus processa de forma assíncrona: consulta até obter estado final.
        const last = await this.pollStatus({ providerRef: ref, model: payload.model }, (r) => r.status !== "sending", {
            ok: true,
            status: mapFocusStatus(sent.json.status),
            providerRef: ref,
            raw: sent.json,
        }, "issue");
        if (last.status === "rejected") {
            return {
                ok: false,
                status: "rejected",
                providerRef: ref,
                rejectionCode: last.rejectionCode,
                rejectionReason: last.rejectionReason,
                raw: last.raw,
            };
        }
        return {
            ok: true,
            status: last.status,
            providerRef: ref,
            accessKey: last.accessKey,
            protocol: last.protocol,
            number: last.number,
            series: last.series,
            xmlUrl: last.xmlUrl,
            danfeUrl: last.danfeUrl,
            raw: last.raw,
        };
    }
    // --------------------------------------------------------------- status
    async getStatus(ref) {
        const key = ref.providerRef ?? ref.accessKey;
        if (!key) {
            return {
                ok: false,
                status: "error",
                rejectionReason: "Referência do documento ausente.",
            };
        }
        const resp = await this.request("GET", `/v2/${resourceFor(ref.model)}/${encodeURIComponent(key)}?completa=1`);
        if (resp.httpStatus >= 400) {
            return {
                ok: false,
                status: "error",
                rejectionCode: String(resp.json.codigo ?? resp.httpStatus),
                rejectionReason: this.reason(resp.json),
                raw: resp.json,
            };
        }
        const json = resp.json;
        const status = mapFocusStatus(json.status);
        return {
            ok: true,
            status,
            providerRef: key,
            accessKey: json.chave_nfe ?? undefined,
            protocol: json.protocolo ?? undefined,
            number: json.numero != null ? Number(json.numero) : undefined,
            series: json.serie != null ? Number(json.serie) : undefined,
            xmlUrl: this.absolute(json.caminho_xml_nota_fiscal),
            danfeUrl: this.absolute(json.caminho_danfe),
            cancellationProtocol: cancellationProtocolOf(json),
            cancellationXmlUrl: this.absolute(json.caminho_xml_cancelamento),
            cancelledAt: json.data_cancelamento ?? json.cancelamento?.data_evento ?? undefined,
            rejectionCode: status === "rejected" ? String(json.status_sefaz ?? json.codigo ?? "") : undefined,
            rejectionReason: status === "rejected" ? this.reason(json) : undefined,
            raw: json,
        };
    }
    // --------------------------------------------------------------- cancel
    /**
     * Solicita o cancelamento e AGUARDA a confirmação oficial usando o mesmo
     * mecanismo de polling da emissão.
     *
     * - `status: "cancelled"` só é devolvido com protocolo do evento e/ou
     *   status `cancelado` confirmado pelo provedor/SEFAZ.
     * - Enquanto a SEFAZ não confirma, devolve `status: "cancelling"` — o motor
     *   mantém o documento em estado transitório e reconsulta depois.
     */
    async cancelNfe(ref, reason) {
        const key = ref.providerRef ?? ref.accessKey;
        const startedAt = Date.now();
        const resp = await this.request("DELETE", `/v2/${resourceFor(ref.model)}/${encodeURIComponent(key)}`, { justificativa: reason });
        console.info("[fiscal] provider.cancel.requested", {
            ref: key,
            httpStatus: resp.httpStatus,
            status: resp.json.status ?? null,
        });
        if (resp.httpStatus >= 400) {
            return {
                ok: false,
                status: "authorized",
                rejectionCode: String(resp.json.codigo ?? resp.httpStatus),
                rejectionReason: this.reason(resp.json),
                raw: resp.json,
            };
        }
        const immediate = {
            ok: true,
            status: mapFocusStatus(resp.json.status),
            providerRef: key,
            cancellationProtocol: cancellationProtocolOf(resp.json),
            cancellationXmlUrl: this.absolute(resp.json.caminho_xml_cancelamento),
            raw: resp.json,
        };
        // Confirmação já veio completa na resposta do DELETE (raro, mas válido).
        const confirmed = (r) => r.status === "cancelled" && Boolean(r.cancellationProtocol);
        const last = confirmed(immediate)
            ? immediate
            : await this.pollStatus({ providerRef: key, model: ref.model }, (r) => confirmed(r) || r.status === "rejected" || r.status === "error", immediate, "cancel");
        console.info("[fiscal] provider.cancel.result", {
            ref: key,
            status: last.status,
            hasProtocol: Boolean(last.cancellationProtocol),
            elapsedMs: Date.now() - startedAt,
        });
        if (last.status === "rejected" || last.status === "error") {
            return {
                ok: false,
                status: "authorized",
                rejectionCode: last.rejectionCode,
                rejectionReason: last.rejectionReason ?? "SEFAZ recusou o pedido de cancelamento.",
                raw: last.raw,
            };
        }
        if (!confirmed(last)) {
            // Sem confirmação oficial: NUNCA reportar como cancelada.
            return {
                ok: true,
                status: "cancelling",
                cancellationXmlUrl: last.cancellationXmlUrl,
                raw: last.raw,
            };
        }
        return {
            ok: true,
            status: "cancelled",
            protocol: last.cancellationProtocol,
            cancelledAt: last.cancelledAt ?? new Date().toISOString(),
            cancellationXmlUrl: last.cancellationXmlUrl,
            raw: last.raw,
        };
    }
    // --------------------------------------------------------- certificate
    /**
     * `POST /v2/empresas` — endpoint ADMINISTRATIVO.
     * Sempre autenticado com o Token Principal da conta.
     */
    async registerCertificate(material) {
        const resp = await this.request("POST", "/v2/empresas", {
            cnpj: digits(material.cnpj),
            arquivo_certificado_base64: material.pfxBase64,
            senha_certificado: material.password,
            habilita_nfe: true,
        }, "admin");
        // 409/422 quando a empresa já existe com o mesmo certificado — não fatal.
        if (resp.httpStatus >= 400) {
            const hint = resp.httpStatus === 401 && !this.hasDedicatedAdminToken()
                ? " Cadastre o Token Principal (Admin) deste ambiente: o token de empresa não tem permissão em /v2/empresas."
                : "";
            return { ok: false, message: `${this.reason(resp.json)}${hint}` };
        }
        return { ok: true };
    }
    // ----------------------------------------------------------- healthcheck
    /**
     * Probe do Token EMPRESA (emissão). Consulta uma referência
     * propositalmente inexistente: a Focus responde 404 quando a credencial é
     * válida e 401 quando não é. Nunca toca a raiz do domínio (ELB → 403).
     */
    async healthCheck() {
        const ref = `nexos-healthcheck-${Date.now()}`;
        return this.probe("GET", `/v2/nfe/${encodeURIComponent(ref)}`, "company");
    }
    /**
     * Probe do Token PRINCIPAL (admin) contra `GET /v2/empresas`.
     * 200 = credencial administrativa válida; 401/403 = escopo errado.
     */
    async adminHealthCheck() {
        return this.probe("GET", "/v2/empresas", "admin");
    }
    async probe(method, path, credential) {
        const endpoint = `${this.base}${path}`;
        const startedAt = Date.now();
        try {
            const resp = await this.request(method, path, undefined, credential);
            return {
                endpoint,
                method,
                credential,
                httpStatus: resp.httpStatus,
                durationMs: Date.now() - startedAt,
                detail: resp.json.mensagem ?? resp.json.mensagem_sefaz ?? undefined,
            };
        }
        catch (err) {
            return {
                endpoint,
                method,
                credential,
                httpStatus: 0,
                durationMs: Date.now() - startedAt,
                networkError: err instanceof Error ? err.message : String(err),
            };
        }
    }
    // ------------------------------------------------------------ artifacts
    async downloadArtifact(url) {
        const resp = await integrationFetch(url, { headers: { Authorization: this.authHeader("company") } }, { integration: "focus-nfe:artifact", timeoutMs: 30000 });
        if (!resp.ok)
            return null;
        const buf = new Uint8Array(await resp.arrayBuffer());
        return {
            bytes: buf,
            contentType: resp.headers.get("content-type") ??
                (url.endsWith(".pdf") ? "application/pdf" : "application/xml"),
        };
    }
    // --------------------------------------------------------------- payload
    buildBody(payload) {
        const emitter = payload.emitter;
        const fiscal = payload.fiscal;
        const customer = payload.customer;
        const addr = customer.address;
        const doc = digits(customer.document);
        const destinatario = payload.model === "65" && !doc
            ? {}
            : {
                nome_destinatario: customer.name,
                indicador_inscricao_estadual_destinatario: 9,
            };
        if (doc.length > 11)
            destinatario.cnpj_destinatario = doc;
        else if (doc)
            destinatario.cpf_destinatario = doc;
        if (customer.email && doc)
            destinatario.email_destinatario = customer.email;
        if (addr && doc) {
            Object.assign(destinatario, {
                logradouro_destinatario: addr.street,
                numero_destinatario: addr.number || "S/N",
                bairro_destinatario: addr.district || "Centro",
                municipio_destinatario: addr.city,
                uf_destinatario: addr.state,
                cep_destinatario: digits(addr.zip),
            });
        }
        const emitente = emitter
            ? {
                cnpj_emitente: digits(emitter.cnpj),
                nome_emitente: emitter.legalName,
                nome_fantasia_emitente: emitter.tradeName ?? emitter.legalName,
                inscricao_estadual_emitente: digits(emitter.ie) || emitter.ie,
                logradouro_emitente: emitter.street,
                numero_emitente: emitter.number || "S/N",
                bairro_emitente: emitter.district || "Centro",
                municipio_emitente: emitter.city,
                uf_emitente: emitter.state,
                cep_emitente: digits(emitter.zip),
                // CRT obrigatório. CRT 4 (MEI) só é transmitido com a feature
                // flag ENABLE_CRT4_MEI ligada; caso contrário envia 1 (atual).
                regime_tributario_emitente: resolveProviderCrt(fiscal?.crt, isCrt4MeiEnabled()),
            }
            : {};
        // P0.6.3: desconto do cabeçalho rateado por item, para que
        // soma(vDesc itens) == vDesc do documento (rejeições 531/533).
        const itemDiscounts = allocateDiscount(payload.items.map((it) => Number(it.total ?? 0)), Number(payload.totals.discount ?? 0));
        const freight = round2(Number(payload.totals.freight ?? 0));
        const items = payload.items.map((item, index) => {
            // Rejeição 745/750: todo item precisa dos grupos ICMS + PIS + COFINS,
            // mesmo zerados. Resolvidos por CRT em `lib/item-taxes`.
            const taxes = resolveItemTaxes(fiscal?.crt, { cst: item.cst, amount: item.total, origem: fiscal?.origem }, fiscal?.csosn);
            return {
                numero_item: index + 1,
                codigo_produto: resolveCommercialCode(item.sku || "", item.productId || ""),
                descricao: item.description,
                codigo_ncm: (item.ncm ?? "").padStart(8, "0"),
                cfop: item.cfop ?? fiscal?.cfop ?? "5102",
                unidade_comercial: resolveCommercialUnit(item.unit),
                quantidade_comercial: item.quantity,
                valor_unitario_comercial: item.unitPrice,
                unidade_tributavel: resolveCommercialUnit(item.unit),
                quantidade_tributavel: item.quantity,
                valor_unitario_tributavel: item.unitPrice,
                valor_bruto: item.total,
                ...(itemDiscounts[index] ? { valor_desconto: itemDiscounts[index] } : {}),
                inclui_no_total: 1,
                ...toFocusTaxFields(taxes),
            };
        });
        const isNfce = payload.model === "65";
        const nfce = isNfce
            ? {
                // NFC-e: presencial, consumidor final, sem transporte.
                presenca_comprador: 1,
                consumidor_final: 1,
                modalidade_frete: 9,
                local_destino: 1,
                // QR-Code: credenciais CSC vindas do cofre fiscal.
                ...(payload.nfce?.cscId ? { id_token_csc: payload.nfce.cscId } : {}),
                ...(payload.nfce?.cscToken ? { csc: payload.nfce.cscToken } : {}),
                formas_pagamento: [
                    {
                        forma_pagamento: focusPaymentCode(payload.nfce?.paymentMethod),
                        valor_pagamento: round2(Number(payload.totals.total ?? 0)),
                    },
                ],
            }
            : {};
        return {
            modelo: isNfce ? 65 : 55,
            natureza_operacao: fiscal?.operationNature ?? "Venda de mercadoria adquirida ou recebida de terceiros",
            data_emissao: payload.issuedAt ?? new Date().toISOString(),
            tipo_documento: 1,
            finalidade_emissao: 1,
            presenca_comprador: 1,
            consumidor_final: 1,
            // 9 = sem ocorrência de transporte; 0 = por conta do emitente.
            modalidade_frete: freight > 0 ? 0 : 9,
            local_destino: 1,
            serie: fiscal?.series ?? 1,
            ...(fiscal?.number ? { numero: fiscal.number } : {}),
            ...emitente,
            ...destinatario,
            valor_produtos: payload.totals.products,
            valor_desconto: round2(Number(payload.totals.discount ?? 0)),
            valor_frete: freight,
            valor_total: payload.totals.total,
            items,
            ...nfce,
        };
    }
}
