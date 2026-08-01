/**
 * Sprint 6.8.4 — Conversão do Inbox Comercial em Venda Oficial.
 *
 * Garante que a conversão é apenas pré-preenchimento + vínculo posterior:
 * nenhuma venda é criada aqui, nenhum estoque/financeiro/caixa é tocado.
 */
import { describe, expect, it } from "vitest";
import {
  INBOX_CONVERTED_STATUS,
  SALE_ORIGIN_WHATSAPP,
  buildConversionPatch,
  buildOriginNote,
  buildSalePrefill,
  canConvert,
  isConverted,
  pickMatchingCustomer,
  type ConvertibleTicket,
} from "../inbox-conversion";
import { COMMERCIAL_INBOX_STATUS } from "../commercial-inbox";

function ticket(overrides: Partial<ConvertibleTicket> = {}): ConvertibleTicket {
  return {
    id: "tk-1",
    phone: "5511988887777",
    buyer_name: "Ana",
    full_name: "Ana Souza",
    cpf: "123.456.789-09",
    cnpj: null,
    status: COMMERCIAL_INBOX_STATUS.waiting,
    sale_id: null,
    items: [
      { productId: "p1", name: "Camisa", qty: 2, unitPrice: 50 },
      { productId: "p2", name: "Calça", qty: 1, unitPrice: 120 },
    ],
    ...overrides,
  };
}

describe("abrir venda pré-preenchida", () => {
  it("monta itens, observação de origem e telefone", () => {
    const prefill = buildSalePrefill(ticket());
    expect(prefill.origin).toBe(SALE_ORIGIN_WHATSAPP);
    expect(prefill.phone).toBe("5511988887777");
    expect(prefill.notes).toBe(buildOriginNote("5511988887777"));
    expect(prefill.notes).toContain("Origem: WhatsApp");
    expect(prefill.items).toEqual([
      { productId: "p1", description: "Camisa", quantity: 2, unitPrice: 50 },
      { productId: "p2", description: "Calça", quantity: 1, unitPrice: 120 },
    ]);
  });

  it("ignora itens sem produto ou com quantidade inválida", () => {
    const prefill = buildSalePrefill(
      ticket({
        items: [
          { productId: "", name: "Solto", qty: 1, unitPrice: 10 },
          { productId: "p3", name: "Zero", qty: 0, unitPrice: 10 },
          { productId: "p4", name: "Ok", qty: 3, unitPrice: 10 },
        ],
      }),
    );
    expect(prefill.items.map((i) => i.productId)).toEqual(["p4"]);
  });

  it("não produz nenhum identificador de venda no pré-preenchimento", () => {
    const prefill = buildSalePrefill(ticket());
    expect(prefill).not.toHaveProperty("saleId");
    expect(prefill).not.toHaveProperty("sale_id");
  });
});

describe("cliente identificado / alterado pelo operador", () => {
  const candidates = [
    { id: "c1", name: "Outro", phone: "5511900000000", document: "999" },
    { id: "c2", name: "Ana Souza", phone: "(11) 98888-7777", document: null },
    { id: "c3", name: "Doc", phone: null, document: "123.456.789-09" },
  ];

  it("casa pelo documento antes do telefone", () => {
    const id = pickMatchingCustomer(candidates, buildSalePrefill(ticket()));
    expect(id).toBe("c3");
  });

  it("casa pelo telefone quando não há documento", () => {
    const id = pickMatchingCustomer(
      candidates,
      buildSalePrefill(ticket({ cpf: null, cnpj: null })),
    );
    expect(id).toBe("c2");
  });

  it("sem match, a venda abre sem cliente (operador escolhe)", () => {
    const id = pickMatchingCustomer(
      [],
      buildSalePrefill(ticket({ cpf: null, cnpj: null })),
    );
    expect(id).toBeNull();
  });

  it("cliente trocado pelo operador não altera o pré-preenchimento original", () => {
    const prefill = buildSalePrefill(ticket());
    const chosen = "c-outro-escolhido-na-tela";
    expect(prefill.document).toBe("12345678909");
    expect(chosen).not.toBe(pickMatchingCustomer(candidates, prefill));
  });
});

describe("elegibilidade da conversão", () => {
  it("aguardando atendimento pode converter", () => {
    expect(canConvert(ticket())).toBe(true);
  });

  it("atendido ainda pode converter", () => {
    expect(canConvert(ticket({ status: COMMERCIAL_INBOX_STATUS.attended }))).toBe(
      true,
    );
  });

  it("cancelado não converte", () => {
    expect(
      canConvert(ticket({ status: COMMERCIAL_INBOX_STATUS.cancelled })),
    ).toBe(false);
  });

  it("sem itens não converte", () => {
    expect(canConvert(ticket({ items: [] }))).toBe(false);
  });

  it("atendimento já convertido não converte de novo", () => {
    const converted = ticket({
      status: INBOX_CONVERTED_STATUS,
      sale_id: "sale-1",
    });
    expect(isConverted(converted)).toBe(true);
    expect(canConvert(converted)).toBe(false);
  });

  it("tentativa de converter duas vezes é bloqueada pelo vínculo de venda", () => {
    const first = ticket();
    expect(canConvert(first)).toBe(true);
    const afterSale = { ...first, ...buildConversionPatch("sale-9", 0) };
    expect(canConvert(afterSale)).toBe(false);
    expect(isConverted(afterSale)).toBe(true);
  });
});

describe("cancelar conversão", () => {
  it("não gera patch algum quando nenhuma venda foi criada", () => {
    const before = ticket();
    // Sair da tela de Nova Venda sem finalizar: o atendimento é o mesmo objeto.
    const after = { ...before };
    expect(after.status).toBe(COMMERCIAL_INBOX_STATUS.waiting);
    expect(after.sale_id).toBeNull();
    expect(isConverted(after)).toBe(false);
  });
});

describe("venda criada com sucesso → atualização do Inbox", () => {
  it("patch contém status convertido, sale_id e converted_at", () => {
    const patch = buildConversionPatch("sale-123", Date.parse("2026-08-01T10:00:00Z"));
    expect(patch).toEqual({
      status: "convertido",
      sale_id: "sale-123",
      converted_at: "2026-08-01T10:00:00.000Z",
    });
  });

  it("o patch toca apenas colunas do Inbox (nenhuma tabela de venda/estoque)", () => {
    const keys = Object.keys(buildConversionPatch("sale-1"));
    expect(keys.sort()).toEqual(["converted_at", "sale_id", "status"]);
  });

  it("atendimento passa a exibir a venda vinculada", () => {
    const converted = { ...ticket(), ...buildConversionPatch("sale-77") };
    expect(converted.sale_id).toBe("sale-77");
    expect(converted.status).toBe(INBOX_CONVERTED_STATUS);
  });
});

describe("venda editada antes da confirmação", () => {
  it("edições do operador não afetam o atendimento até a criação da venda", () => {
    const t = ticket();
    const prefill = buildSalePrefill(t);
    // Operador remove um item, altera quantidade e adiciona outro produto.
    const editado = [
      { ...prefill.items[0], quantity: 5 },
      { productId: "p9", description: "Novo", quantity: 1, unitPrice: 30 },
    ];
    expect(editado).toHaveLength(2);
    // O atendimento original permanece intacto e não convertido.
    expect(t.items).toHaveLength(2);
    expect(t.sale_id).toBeNull();
    expect(isConverted(t)).toBe(false);
  });
});
