import { describe, it, expect } from "vitest";
import { reconcileKitWithFreshData } from "../reconcile-kit";

describe("reconcileKitWithFreshData", () => {
  it("recalcula o gargalo de estoque usando dados frescos, não a foto antiga da composição", () => {
    // Cenário do bug real: capinha foi adicionada ao kit com stock=20
    // "fotografado" naquele momento, mas o estoque real já caiu pra 5
    // (ex.: uma venda em outra aba, durante a sessão de edição do kit).
    const composition = [
      { component_id: "capinha", quantity: 1, stock: 20, cost: 4 },
      { component_id: "pelicula", quantity: 1, stock: 15, cost: 2 },
      { component_id: "cabo", quantity: 1, stock: 10, cost: 3 },
    ];
    const fresh = [
      { id: "capinha", stock: 5, cost: 4 },
      { id: "pelicula", stock: 15, cost: 2 },
      { id: "cabo", stock: 10, cost: 3 },
    ];
    const result = reconcileKitWithFreshData(composition, fresh);
    // Sem a correção, o gargalo salvo seria 10 (min de 20,15,10 — a foto
    // antiga). Com dados frescos, o gargalo real é 5 (capinha).
    expect(result.stock).toBe(5);
  });

  it("recalcula o custo total usando o custo atual dos componentes, não o antigo", () => {
    const composition = [
      { component_id: "capinha", quantity: 2, stock: 20, cost: 4 }, // custo antigo: 4
      { component_id: "cabo", quantity: 1, stock: 10, cost: 3 },
    ];
    // Capinha teve o custo atualizado (ex.: nova compra com preço diferente)
    // durante a sessão de edição do kit.
    const fresh = [
      { id: "capinha", stock: 20, cost: 6 },
      { id: "cabo", stock: 10, cost: 3 },
    ];
    const result = reconcileKitWithFreshData(composition, fresh);
    // 2 * 6 (capinha atualizada) + 1 * 3 (cabo) = 15 — não 2*4+1*3=11 (antigo)
    expect(result.cost).toBe(15);
  });

  it("respeita a quantidade de cada componente no cálculo do gargalo", () => {
    const composition = [
      { component_id: "a", quantity: 2, stock: 20, cost: 1 }, // 20/2 = 10
      { component_id: "b", quantity: 1, stock: 8, cost: 1 }, // 8/1 = 8
    ];
    const fresh = [
      { id: "a", stock: 20, cost: 1 },
      { id: "b", stock: 8, cost: 1 },
    ];
    const result = reconcileKitWithFreshData(composition, fresh);
    expect(result.stock).toBe(8);
  });

  it("mantém os dados antigos de um componente se ele não vier na busca fresca (ex.: falha de rede parcial)", () => {
    const composition = [{ component_id: "capinha", quantity: 1, stock: 20, cost: 4 }];
    const result = reconcileKitWithFreshData(composition, []);
    expect(result.composition[0].stock).toBe(20);
    expect(result.stock).toBe(20);
  });

  it("retorna zero para um kit sem componentes", () => {
    const result = reconcileKitWithFreshData([], []);
    expect(result.stock).toBe(0);
    expect(result.cost).toBe(0);
  });

  describe("reserva de componente compartilhado entre kits", () => {
    // Cenário real do usuário: 5 capinhas A15, duas variações de kit que
    // as compartilham — "Kit Comum" reserva 3, "Kit Privacidade" reserva 2.
    it("respeita o teto de reserva mesmo com mais estoque físico disponível", () => {
      const composition = [
        { component_id: "capinha", quantity: 1, stock: 5, cost: 4, reserved_quantity: 3 },
        { component_id: "pelicula-comum", quantity: 1, stock: 50, cost: 2 }, // sem reserva, estoque de sobra
        { component_id: "cabo", quantity: 1, stock: 50, cost: 3 },
      ];
      const fresh = [
        { id: "capinha", stock: 5, cost: 4 },
        { id: "pelicula-comum", stock: 50, cost: 2 },
        { id: "cabo", stock: 50, cost: 3 },
      ];
      const result = reconcileKitWithFreshData(composition, fresh);
      // Sem a reserva, seria 5 (a capinha física). Com reserva de 3, o
      // Kit Comum mostra 3, deixando claro que só 3 dessas capinhas são
      // dele — as outras 2 ficam para o Kit Privacidade.
      expect(result.stock).toBe(3);
    });

    it("o outro kit da mesma família mostra a reserva dele, não a mesma física total", () => {
      const composition = [
        { component_id: "capinha", quantity: 1, stock: 5, cost: 4, reserved_quantity: 2 },
        { component_id: "pelicula-privacidade", quantity: 1, stock: 50, cost: 3 },
        { component_id: "cabo", quantity: 1, stock: 50, cost: 3 },
      ];
      const fresh = [
        { id: "capinha", stock: 5, cost: 4 },
        { id: "pelicula-privacidade", stock: 50, cost: 3 },
        { id: "cabo", stock: 50, cost: 3 },
      ];
      const result = reconcileKitWithFreshData(composition, fresh);
      expect(result.stock).toBe(2);
    });

    it("desconta da reserva as unidades já vendidas DESTE kit, sem precisar de ajuste manual", () => {
      const composition = [
        { component_id: "capinha", quantity: 1, stock: 5, cost: 4, reserved_quantity: 3 },
        { component_id: "pelicula-comum", quantity: 1, stock: 50, cost: 2 },
      ];
      const fresh = [
        { id: "capinha", stock: 4, cost: 4 }, // já vendeu 1 (física caiu de 5 pra 4)
        { id: "pelicula-comum", stock: 50, cost: 2 },
      ];
      // 1 unidade deste kit já foi vendida.
      const result = reconcileKitWithFreshData(composition, fresh, 1);
      // Reserva original 3, menos 1 já vendido = 2 restantes.
      expect(result.stock).toBe(2);
    });

    it("nunca deixa passar do estoque físico real, mesmo que a reserva permita mais", () => {
      const composition = [
        { component_id: "capinha", quantity: 1, stock: 1, cost: 4, reserved_quantity: 3 },
      ];
      const fresh = [{ id: "capinha", stock: 1, cost: 4 }]; // só sobrou 1 fisicamente
      const result = reconcileKitWithFreshData(composition, fresh);
      // Reserva diz "até 3", mas só existe 1 de verdade — o físico manda.
      expect(result.stock).toBe(1);
    });

    it("sem reserva definida (undefined/null), comportamento continua igual ao de antes", () => {
      const composition = [
        { component_id: "capinha", quantity: 1, stock: 5, cost: 4, reserved_quantity: null },
      ];
      const fresh = [{ id: "capinha", stock: 5, cost: 4 }];
      const result = reconcileKitWithFreshData(composition, fresh);
      expect(result.stock).toBe(5);
    });
  });
});
