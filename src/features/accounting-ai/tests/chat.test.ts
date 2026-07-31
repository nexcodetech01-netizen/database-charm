import { describe, expect, it } from "vitest";
import {
  appendMessage,
  askBella,
  buildAnswer,
  createMessage,
  detectIntent,
  emptyContext,
  extractAmount,
  FALLBACK_NO_DATA,
  FALLBACK_UNKNOWN,
  executePlan,
  planIntent,
  updateContext,
} from "../chat";
import type { ChatPlan } from "../chat/types";
import { makeServices } from "./fixtures";

const deps = () => ({ services: makeServices() });

describe("accounting-ai · chat · intent engine", () => {
  it("reconhece intenções pontuais", () => {
    expect(detectIntent("qual foi o lucro do mês?").intent).toBe("consultar_lucro");
    expect(detectIntent("quanto vendi hoje?").intent).toBe("consultar_receita");
    expect(detectIntent("como está o caixa?").intent).toBe("consultar_caixa");
    expect(detectIntent("quanto vou pagar de imposto?").intent).toBe("consultar_impostos");
    expect(detectIntent("qual o ticket médio?").intent).toBe("consultar_ticket");
  });

  it("reconhece intenções consultivas da Sprint 5.3", () => {
    expect(detectIntent("posso retirar dinheiro?").intent).toBe("consultar_retirada");
    expect(detectIntent("quanto devo reservar?").intent).toBe("consultar_reserva");
    expect(detectIntent("qual meu pró-labore?").intent).toBe("consultar_prolabore");
    expect(detectIntent("estou em risco?").intent).toBe("consultar_risco");
  });

  it("reconhece perguntas amplas", () => {
    expect(detectIntent("Como está minha empresa?").intent).toBe("situacao_geral");
    expect(detectIntent("O que precisa da minha atenção?").intent).toBe("pontos_atencao");
  });

  it("devolve desconhecida para perguntas fora do escopo", () => {
    const match = detectIntent("qual a previsão do tempo amanhã?");
    expect(match.intent).toBe("desconhecida");
    expect(match.confidence).toBe(0);
  });

  it("extrai valores citados", () => {
    expect(extractAmount("posso retirar R$ 5.000,00?")).toBe(5000);
    expect(extractAmount("posso tirar cinco mil?")).toBe(5000);
    expect(extractAmount("posso retirar?")).toBeNull();
  });

  it("usa o contexto em perguntas de seguimento", () => {
    const context = updateContext(emptyContext(), {
      intent: "consultar_retirada",
      text: "ok",
      skills: ["consultar_retirada"],
      outcomes: [],
      answered: true,
      amount: null,
    });
    const match = detectIntent("e agora?", { context });
    expect(match.intent).toBe("consultar_retirada");
    expect(match.fromContext).toBe(true);
  });
});

describe("accounting-ai · chat · planner", () => {
  it("planeja resposta pontual", () => {
    const plan = planIntent(detectIntent("qual foi o lucro?"));
    expect(plan.shape).toBe("single");
    expect(plan.steps.map((s) => s.skillId)).toEqual(["consultar_lucro"]);
  });

  it("planeja resposta composta para pergunta ampla", () => {
    const plan = planIntent(detectIntent("como está minha empresa?"));
    expect(plan.shape).toBe("composite");
    expect(plan.steps.length).toBeGreaterThan(2);
  });

  it("não planeja nada para intenção desconhecida", () => {
    const plan = planIntent(detectIntent("me conte uma piada"));
    expect(plan.shape).toBe("none");
    expect(plan.steps).toHaveLength(0);
  });

  it("ignora skills indisponíveis", () => {
    const plan = planIntent(detectIntent("qual foi o lucro?"), { availableSkills: [] });
    expect(plan.shape).toBe("none");
  });
});

describe("accounting-ai · chat · router e resposta", () => {
  it("executa apenas skills existentes", async () => {
    const plan = planIntent(detectIntent("como está o caixa?"));
    const outcomes = await executePlan(plan, "company-1", { deps: deps() });
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0]?.skillId).toBe("consultar_caixa");
  });

  it("reporta skill inexistente sem lançar", async () => {
    const plan: ChatPlan = {
      intent: "consultar_caixa",
      steps: [{ skillId: "consultar_inexistente" as never, reason: "teste" }],
      shape: "single",
      amount: null,
    };
    const outcomes = await executePlan(plan, "company-1", { deps: deps() });
    expect(outcomes[0]?.ok).toBe(false);
    expect(outcomes[0]?.error).toContain("não registrada");
  });

  it("gera fallback quando nenhuma skill respondeu", () => {
    const plan = planIntent(detectIntent("qual foi o lucro?"));
    const answer = buildAnswer(plan, [
      { skillId: "consultar_lucro", ok: false, text: "", data: null, error: "x" },
    ]);
    expect(answer.answered).toBe(false);
    expect(answer.text).toBe(FALLBACK_NO_DATA);
  });

  it("gera fallback de escopo para intenção desconhecida", () => {
    const answer = buildAnswer(planIntent(detectIntent("qual seu time de futebol?")), []);
    expect(answer.text).toBe(FALLBACK_UNKNOWN);
  });

  it("responde perguntas reais usando dados das skills", async () => {
    const answer = await askBella("quanto tenho em caixa?", "company-1", { deps: deps() });
    expect(answer.answered).toBe(true);
    expect(answer.skills).toEqual(["consultar_caixa"]);
    expect(answer.text.length).toBeGreaterThan(0);
  });

  it("responde pergunta ampla de forma consolidada", async () => {
    const answer = await askBella("como está minha empresa?", "company-1", { deps: deps() });
    expect(answer.intent).toBe("situacao_geral");
    expect(answer.text).toContain("panorama");
  });
});

describe("accounting-ai · chat · histórico", () => {
  it("acumula e limita mensagens", () => {
    let history = [createMessage("bella", "oi")];
    for (let i = 0; i < 5; i += 1) {
      history = appendMessage(history, createMessage("user", `p${i}`), 3);
    }
    expect(history).toHaveLength(3);
    expect(history[2]?.text).toBe("p4");
  });
});
