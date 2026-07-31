/**
 * Sprint 2.7 — NFC-e (modelo 65) no motor fiscal único.
 *
 * Cobre o contrato do provedor para o modelo 65 (rota, corpo, CSC,
 * consumidor sem CPF) e os cenários de autorização/falha. Nenhum motor
 * paralelo é exercitado: os testes usam exatamente o provider real com o
 * transporte HTTP mockado.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NfePayload } from "../types";

const fetchMock = vi.fn();

vi.mock("@/lib/http-client.server", () => ({
  integrationFetch: (...args: unknown[]) => fetchMock(...args),
}));
vi.mock("../lib/feature-flags.server", () => ({ isCrt4MeiEnabled: () => false }));

const { FiscalProviderFocusNfe } = await import("../provider/fiscal-provider-focus.server");
const { focusPaymentCode } = await import("../provider/fiscal-provider-focus.server");

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status < 400,
    status,
    text: async () => JSON.stringify(body),
    json: async () => body,
  } as unknown as Response;
}

function makePayload(over: Partial<NfePayload> = {}): NfePayload {
  return {
    saleId: "sale-1",
    reference: "ref-1",
    model: "65",
    environment: "production",
    nfce: { cscId: "000001", cscToken: "SECRET-CSC", paymentMethod: "cash" },
    customer: { id: "", name: "", document: "" },
    items: [
      {
        productId: "p1",
        sku: "SKU1",
        unit: "UN",
        description: "Produto 1",
        ncm: "12345678",
        cfop: "5102",
        cst: "102",
        quantity: 2,
        unitPrice: 10,
        total: 20,
      },
    ],
    totals: { products: 20, discount: 0, total: 20 },
    emitter: {
      cnpj: "12345678000199",
      legalName: "Empresa X",
      ie: "1234567",
      street: "Rua A",
      number: "10",
      district: "Centro",
      city: "São Paulo",
      state: "SP",
      zip: "01000000",
    },
    fiscal: {
      operationNature: "Venda",
      cfop: "5102",
      csosn: "102",
      crt: 1,
      origem: 0,
      series: 1,
      number: 7,
    },
    ...over,
  };
}

function provider() {
  return new FiscalProviderFocusNfe({
    token: "company-token",
    environment: "production",
    pollAttempts: 1,
    pollIntervalMs: 0,
  });
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("NFC-e modelo 65 — provedor", () => {
  it("usa a rota /v2/nfce e envia modelo 65 + CSC + forma de pagamento", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { status: "processando_autorizacao" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          status: "autorizado",
          chave_nfe: "9".repeat(44),
          numero: "7",
          serie: "1",
          protocolo: "135240000",
          caminho_danfe: "/danfe.pdf",
          caminho_xml_nota_fiscal: "/nota.xml",
        }),
      );

    const result = await provider().issueNfe(makePayload());

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v2/nfce?ref=ref-1");
    const body = JSON.parse(String(init.body));
    expect(body.modelo).toBe(65);
    expect(body.id_token_csc).toBe("000001");
    expect(body.csc).toBe("SECRET-CSC");
    expect(body.presenca_comprador).toBe(1);
    expect(body.consumidor_final).toBe(1);
    expect(body.formas_pagamento).toEqual([
      { forma_pagamento: "01", valor_pagamento: 20 },
    ]);
    // Consumidor não identificado: sem bloco de destinatário.
    expect(body.cpf_destinatario).toBeUndefined();
    expect(body.nome_destinatario).toBeUndefined();

    expect(result.ok).toBe(true);
    expect(result.status).toBe("authorized");
    expect(result.accessKey).toBe("9".repeat(44));
    expect(result.protocol).toBe("135240000");

    // A consulta também usa a rota do modelo 65.
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/v2/nfce/ref-1");
  });

  it("identifica o consumidor quando o CPF é informado", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(422, { mensagem: "erro" }));
    await provider().issueNfe(
      makePayload({
        customer: { id: "c1", name: "Maria", document: "11144477735" },
      }),
    );
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.cpf_destinatario).toBe("11144477735");
    expect(body.nome_destinatario).toBe("Maria");
  });

  it("rejeição imediata (422) não vira autorização", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, { codigo: "erro_validacao", mensagem: "NCM inválido" }),
    );
    const result = await provider().issueNfe(makePayload());
    expect(result.ok).toBe(false);
    expect(result.status).toBe("rejected");
    expect(result.rejectionReason).toContain("NCM inválido");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejeição da SEFAZ após processamento assíncrono", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { status: "processando_autorizacao" }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          status: "erro_autorizacao",
          status_sefaz: "539",
          mensagem_sefaz: "Duplicidade de NFC-e",
        }),
      );
    const result = await provider().issueNfe(makePayload());
    expect(result.ok).toBe(false);
    expect(result.status).toBe("rejected");
    expect(result.rejectionCode).toBe("539");
  });

  it("SEFAZ ainda processando permanece em estado não-final (sem chave)", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(200, { status: "processando_autorizacao" }))
      .mockResolvedValueOnce(jsonResponse(200, { status: "processando_autorizacao" }));
    const result = await provider().issueNfe(makePayload());
    expect(result.status).toBe("sending");
    expect(result.accessKey).toBeUndefined();
  });

  it("cancelamento usa a rota /v2/nfce", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        status: "cancelado",
        protocolo_cancelamento: "999",
        data_cancelamento: "2026-01-01T10:00:00-03:00",
      }),
    );
    const result = await provider().cancelNfe(
      { accessKey: "9".repeat(44), providerRef: "ref-1", model: "65" },
      "Cancelamento por erro de digitação no PDV",
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/v2/nfce/ref-1");
    expect(result.status).toBe("cancelled");
    expect(result.protocol).toBe("999");
  });

  it("NF-e modelo 55 continua na rota /v2/nfe e sem campos de NFC-e", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(422, { mensagem: "x" }));
    await provider().issueNfe(
      makePayload({
        model: "55",
        nfce: undefined,
        customer: { id: "c1", name: "Maria", document: "11144477735" },
      }),
    );
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/v2/nfe?ref=");
    const body = JSON.parse(String(init.body));
    expect(body.modelo).toBe(55);
    expect(body.csc).toBeUndefined();
    expect(body.formas_pagamento).toBeUndefined();
  });

  it("mapeia formas de pagamento do motor de vendas para a tabela tPag", () => {
    expect(focusPaymentCode("cash")).toBe("01");
    expect(focusPaymentCode("credit")).toBe("03");
    expect(focusPaymentCode("debit")).toBe("04");
    expect(focusPaymentCode("pix")).toBe("17");
    expect(focusPaymentCode(null)).toBe("99");
  });
});
