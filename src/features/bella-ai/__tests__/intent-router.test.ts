import { describe, expect, it } from "vitest";
import { defaultIntentRouter } from "../ai/intents/router";

describe("IntentRouter (deterministic)", () => {
  it("classifica pergunta de dashboard", () => {
    const out = defaultIntentRouter.detect("Como está meu dashboard comercial hoje?");
    expect(out.intent).toBe("commercial.dashboard");
    expect(out.domain).toBe("commercial");
    expect(out.confidence).toBeGreaterThan(0.7);
    expect(out.source).toBe("deterministic");
  });

  it("classifica política da empresa", () => {
    const out = defaultIntentRouter.detect("Qual a política comercial da empresa?");
    expect(out.intent).toBe("commercial.company");
  });

  it("classifica política de categoria", () => {
    const out = defaultIntentRouter.detect("Mostre as políticas por categoria");
    expect(out.intent).toBe("commercial.category");
  });

  it("classifica explicação de preço com productId em UUID", () => {
    const out = defaultIntentRouter.detect(
      "Por que esse preço do produto 11111111-2222-3333-4444-555555555555?",
    );
    expect(out.intent).toBe("commercial.product.explain");
    expect(out.slots.productId).toBe(
      "11111111-2222-3333-4444-555555555555",
    );
  });

  it("classifica simulação de precificação", () => {
    const out = defaultIntentRouter.detect("Quero simular preço para um item novo");
    expect(out.intent).toBe("commercial.pricing.simulate");
  });

  it("retorna unknown com confiança 0 quando nada bate", () => {
    const out = defaultIntentRouter.detect("Qual o clima hoje em São Paulo?");
    expect(out.intent).toBe("unknown");
    expect(out.domain).toBe("unknown");
    expect(out.confidence).toBe(0);
  });

  it("retorna unknown para string vazia", () => {
    const out = defaultIntentRouter.detect("   ");
    expect(out.intent).toBe("unknown");
  });

  it("é resiliente a acentos e caixa", () => {
    const out = defaultIntentRouter.detect("POLÍTICA COMERCIAL DA EMPRESA");
    expect(out.intent).toBe("commercial.company");
  });
});
