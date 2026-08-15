import { describe, it, expect } from "vitest";
import { shouldStripStockFromPayload } from "../stock-payload";

describe("shouldStripStockFromPayload", () => {
  it("remove o estoque ao editar um produto simples (regressão protegida: comportamento original preservado)", () => {
    expect(shouldStripStockFromPayload(true, "simple")).toBe(true);
  });

  it("NUNCA remove o estoque de um kit, mesmo editando (regressão do bug real)", () => {
    // Bug real: a reserva de estoque do kit (ex.: "reservar até 2
    // capinhas") mudava a pré-visualização na tela, mas nunca era salva
    // de verdade — porque o campo era apagado do payload antes de
    // chegar no banco, para QUALQUER edição, sem exceção pra kit.
    expect(shouldStripStockFromPayload(true, "kit")).toBe(false);
  });

  it("não remove o estoque ao criar um produto novo (simples ou kit)", () => {
    expect(shouldStripStockFromPayload(false, "simple")).toBe(false);
    expect(shouldStripStockFromPayload(false, "kit")).toBe(false);
  });
});
