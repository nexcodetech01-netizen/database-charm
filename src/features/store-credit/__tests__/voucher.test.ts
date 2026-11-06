import { describe, expect, it } from "vitest";
import { buildVoucherHtml } from "../lib/voucher";

describe("vale-troca impresso", () => {
  it("mostra loja, cliente, valor da troca e saldo", () => {
    const html = buildVoucherHtml({
      companyName: "T&G Moda & Estilo",
      customerName: "Fernando <Silva>",
      credit: 35,
      balance: 54.9,
      origin: "Troca da venda VD-1",
      date: new Date("2026-11-05T15:00:00Z"),
    });
    expect(html).toContain("T&amp;G Moda &amp; Estilo");
    expect(html).toContain("Fernando &lt;Silva&gt;");
    expect(html).toMatch(/R\$\s?35,00/);
    expect(html).toMatch(/R\$\s?54,90/);
    expect(html).toContain("VALE-TROCA");
  });
  it("reimpressão sem valor de troca mostra só o saldo", () => {
    const html = buildVoucherHtml({ companyName: "L", customerName: "A", credit: 0, balance: 10 });
    expect(html).not.toContain("Valor desta troca");
  });
});
