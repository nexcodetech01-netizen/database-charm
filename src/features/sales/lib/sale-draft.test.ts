// Integration test — BUG-PDV-018
//
// Garante que, após "Descartar" a venda em andamento, o detector responsável
// por abrir o modal "Venda em andamento" nunca mais retorna um rascunho
// dentro da mesma sessão — mesmo em cenários com rascunho órfão vazio
// (race entre autosave e descarte) ou múltiplos cliques em "Nova venda".

import { beforeEach, describe, expect, it, vi } from "vitest";

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length(): number {
    return this.map.size;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
}

const storage = new MemoryStorage();
vi.stubGlobal("window", { localStorage: storage });

// Imports posteriores garantem que `draftStorage` capture o `window` stub.
import { draftStorage, DRAFT_KEYS } from "@/lib/draft-storage";
import {
  isSaleDraftEmpty,
  loadInProgressSaleDraft,
  resolveInProgressSaleDraft,
} from "./sale-draft";

const companyId = "co-integration";
const key = DRAFT_KEYS.sale(companyId);

function saveDraft(payload: unknown) {
  draftStorage.save(key, payload);
}

function simulateDiscard() {
  // Reproduz `discardDraft` do sale-form: remove a chave local do rascunho.
  draftStorage.remove(key);
}

beforeEach(() => {
  storage.clear();
});

describe("isSaleDraftEmpty", () => {
  it("trata null/undefined como vazio", () => {
    expect(isSaleDraftEmpty(null)).toBe(true);
    expect(isSaleDraftEmpty(undefined)).toBe(true);
  });

  it("trata rascunho zerado como vazio", () => {
    expect(
      isSaleDraftEmpty({
        form: {
          customer_id: "",
          notes: "   ",
          discount: "0",
          shipping: "0",
          payment_method: "",
        },
        items: [],
      }),
    ).toBe(true);
  });

  it("não considera vazio quando há item, cliente, método ou desconto", () => {
    expect(
      isSaleDraftEmpty({ form: {}, items: [{ product_id: "p1" }] }),
    ).toBe(false);
    expect(
      isSaleDraftEmpty({ form: { customer_id: "c1" }, items: [] }),
    ).toBe(false);
    expect(
      isSaleDraftEmpty({ form: { payment_method: "pix" }, items: [] }),
    ).toBe(false);
    expect(
      isSaleDraftEmpty({ form: { discount: "10" }, items: [] }),
    ).toBe(false);
  });
});

describe("loadInProgressSaleDraft — detecção de venda em andamento", () => {
  it("detecta um rascunho válido com itens", () => {
    saveDraft({
      form: { customer_id: "c1" },
      items: [{ product_id: "p1", quantity: 1 }],
    });
    const loaded = loadInProgressSaleDraft(companyId);
    expect(loaded).not.toBeNull();
    expect(loaded?.data.items).toHaveLength(1);
  });

  it("não retorna rascunho após Descartar (chave removida)", () => {
    saveDraft({
      form: { customer_id: "c1" },
      items: [{ product_id: "p1" }],
    });
    simulateDiscard();
    expect(loadInProgressSaleDraft(companyId)).toBeNull();
  });

  it("ignora rascunho órfão vazio e limpa a chave (autosave sobre form zerado)", () => {
    // Cenário BUG-PDV-016: o debounce do autosave grava um envelope logo
    // após o descarte, mas com o formulário já zerado.
    saveDraft({
      form: {
        customer_id: "",
        notes: "",
        discount: "0",
        shipping: "0",
        payment_method: "",
      },
      items: [],
    });
    expect(loadInProgressSaleDraft(companyId)).toBeNull();
    // efeito colateral esperado: chave órfã foi removida.
    expect(storage.getItem("nexos:draft:" + key)).toBeNull();
  });

  it("modal nunca reaparece na mesma sessão após Descartar → Nova venda", () => {
    // 1) Rascunho ativo (usuário no meio de uma venda).
    saveDraft({
      form: { customer_id: "c1" },
      items: [{ product_id: "p1" }],
    });
    expect(loadInProgressSaleDraft(companyId)).not.toBeNull();

    // 2) Usuário clica em "Descartar".
    simulateDiscard();

    // 3) Sequência de "Nova venda" na mesma sessão — o detector nunca deve
    //    retornar um rascunho, mesmo que o autosave grave envelopes vazios
    //    entre uma abertura e outra.
    for (let i = 0; i < 3; i++) {
      saveDraft({
        form: {
          customer_id: "",
          notes: "",
          discount: "0",
          shipping: "0",
          payment_method: "",
        },
        items: [],
      });
      expect(loadInProgressSaleDraft(companyId)).toBeNull();
    }
  });

  it("não retorna cópia local quando a venda já foi concluída no banco", async () => {
    saveDraft({
      form: { number: "VD-001", status: "draft" },
      items: [{ product_id: "p1" }],
    });

    const loaded = await resolveInProgressSaleDraft(companyId, async () => ({
      sale_id: "sale-paid",
      status: "paid",
      completed_at: "2026-07-18T18:00:00.000Z",
      payment_status: "paid",
      created_at: "2026-07-18T17:00:00.000Z",
      updated_at: "2026-07-18T18:00:00.000Z",
    }));

    expect(loaded).toBeNull();
    expect(storage.getItem("nexos:draft:" + key)).toBeNull();
  });

  it("não retorna cópia local quando o registro já existe no banco", async () => {
    saveDraft({
      form: { number: "VD-002", status: "draft" },
      items: [{ product_id: "p1" }],
    });

    const loaded = await resolveInProgressSaleDraft(companyId, async () => ({
      sale_id: "sale-pending",
      status: "pending",
      completed_at: null,
      payment_status: "pending",
      created_at: "2026-07-18T17:00:00.000Z",
      updated_at: "2026-07-18T17:01:00.000Z",
    }));

    expect(loaded).toBeNull();
    expect(storage.getItem("nexos:draft:" + key)).toBeNull();
  });

  it("retorna somente trabalho local incompleto sem registro no banco", async () => {
    saveDraft({
      form: { number: "VD-003", status: "draft" },
      items: [{ product_id: "p1" }],
    });

    const loaded = await resolveInProgressSaleDraft(companyId, async () => null);

    expect(loaded?.data.form?.number).toBe("VD-003");
  });
});
