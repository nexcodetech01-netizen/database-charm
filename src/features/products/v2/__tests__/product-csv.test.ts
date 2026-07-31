import { describe, it, expect } from "vitest";
import { parseProductsCsv } from "../csv/product-csv";

describe("parseProductsCsv", () => {
  it("parseia CSV mínimo (name, price)", () => {
    const csv = "name,price\nCaneta Azul,3.5\nCaderno,12.9";
    const { rows, issues } = parseProductsCsv(csv);
    expect(issues).toHaveLength(0);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Caneta Azul");
    expect(rows[0].price).toBe(3.5);
  });

  it("rejeita CSV sem cabeçalho obrigatório", () => {
    const { rows, issues } = parseProductsCsv("foo,bar\n1,2");
    expect(rows).toHaveLength(0);
    expect(issues[0].message).toMatch(/name.*price/);
  });

  it("detecta ';' como delimitador e vírgula decimal pt-BR", () => {
    const csv = "nome;preço\nCaneta;3,50";
    const { rows, issues } = parseProductsCsv(csv);
    expect(issues).toHaveLength(0);
    expect(rows[0].price).toBe(3.5);
  });

  it("respeita maxRows", () => {
    const body = Array.from({ length: 10 }, (_, i) => `P${i},1`).join("\n");
    const { rows } = parseProductsCsv(`name,price\n${body}`, { maxRows: 3 });
    expect(rows).toHaveLength(3);
  });

  it("marca linha inválida como issue e continua", () => {
    const csv = "name,price\nOk,1\n,2\nOutro,invalid";
    const { rows, issues } = parseProductsCsv(csv);
    expect(rows.map((r) => r.name)).toEqual(["Ok"]);
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});
