/**
 * Sprint 7.1 — Bella Tributária.
 *
 * Garante que a Bella apenas LÊ o motor tributário oficial: nenhuma faixa,
 * alíquota ou DAS é recalculado dentro de `accounting-ai`.
 */
import { describe, expect, it } from "vitest";
import { computeSimples } from "@/features/tax";
import type { TaxApportionment } from "@/features/tax";
import { detectIntent, extractGrowthPct } from "../chat/intent-engine";
import { planIntent } from "../chat/planner";
import { askBella } from "../chat";
import {
  buildBellaTaxInsights,
  buildBellaTaxNotifications,
  dueDateFromProfile,
  taxHeadline,
  taxMetrics,
  taxRegimeProvider,
  taxSimulationProvider,
} from "../tax";
import { makeTestFiscalPort, makeTestServices, testPeriod } from "./fixtures";

const deps = (fiscal = makeTestFiscalPort()) => ({
  services: { ...makeTestServices(), fiscal },
  period: testPeriod,
});

const apportionment = (over: Partial<TaxApportionment> = {}): TaxApportionment => ({
  id: "a1",
  companyId: "c1",
  competence: "2026-01-01",
  taxRegime: "simples_nacional",
  simplesAnnex: "I",
  bracket: 4,
  revenue: 120_000,
  baseAmount: 120_000,
  rbt12: 1_200_000,
  nominalRate: 10.7,
  deduction: 22_500,
  effectiveRate: 8.825,
  taxAmount: 10_590,
  dueDate: "2026-02-20",
  status: "open",
  entryId: null,
  ...over,
});

describe("Bella Tributária · provider", () => {
  it("usa a apuração oficial quando ela existe", async () => {
    const res = await taxRegimeProvider(
      "c1",
      deps(makeTestFiscalPort({ apportionment: apportionment() })),
    );
    expect(res.available).toBe(true);
    expect(res.data?.dasSource).toBe("apuracao");
    expect(res.data?.dasAmount).toBe(10_590);
    expect(res.data?.effectiveRate).toBe(8.825);
    expect(res.data?.dueDate).toBe("2026-02-20");
  });

  it("prevê o DAS pelo motor do Simples quando não há apuração", async () => {
    const res = await taxRegimeProvider("c1", deps());
    const expected = computeSimples("I", 1_200_000, 11_000);
    expect(res.data?.dasSource).toBe("simulacao");
    expect(res.data?.dasAmount).toBe(expected.taxAmount);
    expect(res.data?.effectiveRate).toBe(expected.effectiveRate);
    expect(res.data?.bracket).toBe(expected.bracket);
  });

  it("expõe RBT12, uso do teto e distância da próxima faixa", async () => {
    const res = await taxRegimeProvider("c1", deps());
    expect(res.data?.rbt12).toBe(1_200_000);
    expect(res.data?.limitUsagePct).toBeCloseTo(25, 1);
    expect(res.data?.bracketCeiling).toBe(1_800_000);
    expect(res.data?.distanceToNextBracket).toBe(600_000);
  });

  it("deriva o vencimento a partir do dia oficial do perfil", () => {
    expect(dueDateFromProfile("2026-01-01", 20)).toBe("2026-02-20");
    expect(dueDateFromProfile("2026-12-01", 31)).toBe("2027-01-31");
    expect(dueDateFromProfile("2026-01-01", null)).toBeNull();
  });

  it("permanece indisponível sem quebrar quando a porta falha", async () => {
    const broken = makeTestFiscalPort();
    broken.profile = async () => {
      throw new Error("offline");
    };
    const res = await taxRegimeProvider("c1", deps(broken));
    expect(res.available).toBe(false);
    expect(res.data).toBeNull();
  });

  it("lida com empresa fora do Simples sem inventar números", async () => {
    const res = await taxRegimeProvider(
      "c1",
      deps(
        makeTestFiscalPort({
          profile: {
            id: "tp2",
            companyId: "c1",
            taxRegime: "lucro_presumido",
            simplesAnnex: null,
            rbt12: 0,
            effectiveRate: 0,
            nominalRate: 0,
            icmsRegime: "normal",
            pisRegime: "normal",
            cofinsRegime: "normal",
            issRegime: "nao_aplicavel",
            ipiRegime: "nao_aplicavel",
            dueDay: 20,
            startDate: "2024-01-01",
            active: true,
          },
        }),
      ),
    );
    expect(res.data?.annex).toBeNull();
    expect(res.data?.dasAmount).toBe(0);
    expect(taxHeadline(res.data)).toContain("Lucro Presumido");
  });
});

describe("Bella Tributária · simulações", () => {
  it("projeta cenários percentuais pelo motor oficial", async () => {
    const res = await taxSimulationProvider("c1", { growthPct: 20 }, deps());
    expect(res.available).toBe(true);
    expect(res.data?.scenarios.map((s) => s.growthPct)).toEqual([0, 20]);
    expect(res.data?.highlighted?.growthPct).toBe(20);
    expect(res.data?.taxDelta).toBeGreaterThan(0);
  });

  it("simula faturamento alvo mantendo o cálculo no motor", async () => {
    const res = await taxSimulationProvider("c1", { targetRevenue: 200_000 }, deps());
    const expected = computeSimples("I", 1_200_000 + (200_000 - 11_000), 200_000);
    expect(res.data?.highlighted?.revenue).toBe(200_000);
    expect(res.data?.highlighted?.taxAmount).toBe(expected.taxAmount);
  });

  it("usa cenários padrão sem parâmetros", async () => {
    const res = await taxSimulationProvider("c1", {}, deps());
    expect(res.data?.scenarios).toHaveLength(4);
    expect(res.data?.highlighted).toBeNull();
  });
});

describe("Bella Tributária · insights e notificações", () => {
  it("alerta quando o RBT12 está perto do teto", async () => {
    const res = await taxRegimeProvider(
      "c1",
      deps(makeTestFiscalPort({ rbt12: 4_100_000 })),
    );
    const ids = buildBellaTaxInsights(res.data).map((i) => i.id);
    expect(ids).toContain("tax_limite_proximo");
  });

  it("notifica DAS vencido como crítico e persistente", async () => {
    const res = await taxRegimeProvider(
      "c1",
      deps(makeTestFiscalPort({ apportionment: apportionment() })),
    );
    const notifications = buildBellaTaxNotifications(res.data, {
      today: new Date("2026-03-01T12:00:00Z"),
    });
    const vencido = notifications.find((n) => n.id === "tax_das_vencido");
    expect(vencido?.severity).toBe("critical");
    expect(vencido?.persistent).toBe(true);
  });

  it("não gera alerta de vencimento para DAS pago", async () => {
    const res = await taxRegimeProvider(
      "c1",
      deps(makeTestFiscalPort({ apportionment: apportionment({ status: "paid" }) })),
    );
    const ids = buildBellaTaxNotifications(res.data, {
      today: new Date("2026-03-01T12:00:00Z"),
    }).map((n) => n.id);
    expect(ids).not.toContain("tax_das_vencido");
  });

  it("monta as métricas do bloco do dashboard", async () => {
    const res = await taxRegimeProvider("c1", deps());
    const ids = taxMetrics(res.data).map((m) => m.id);
    expect(ids).toEqual(["das", "rbt12", "faixa", "aliquota", "proxima_faixa", "media"]);
  });
});

describe("Bella Tributária · chat", () => {
  it("reconhece as intenções tributárias", () => {
    const cases: Array<[string, string]> = [
      ["Quanto vou pagar de DAS?", "consultar_das"],
      ["Qual é o meu RBT12?", "consultar_rbt12"],
      ["Qual meu anexo?", "consultar_anexo"],
      ["Qual minha alíquota efetiva?", "consultar_aliquota"],
      ["Vou mudar de faixa?", "consultar_faixa"],
      ["Quando vence o DAS?", "consultar_vencimento_das"],
      ["Simular DAS", "simular_das"],
      ["E se eu faturar 200 mil?", "simular_faturamento"],
      ["Como está meu tributário?", "situacao_tributaria"],
    ];
    for (const [question, intent] of cases) {
      expect(detectIntent(question).intent).toBe(intent);
    }
  });

  it("não confunde perguntas comerciais com tributárias", () => {
    expect(detectIntent("Situação das vendas").intent).toBe("situacao_vendas");
    expect(detectIntent("As vendas estão caindo?").intent).toBe("situacao_vendas");
  });

  it("extrai crescimento percentual", () => {
    expect(extractGrowthPct("se eu crescer 15%")).toBe(15);
    expect(extractGrowthPct("crescimento de 7,5 por cento")).toBe(7.5);
    expect(extractGrowthPct("quanto pago de DAS?")).toBeNull();
  });

  it("planeja apenas skills registradas", () => {
    const plan = planIntent(detectIntent("Como está meu tributário?"));
    expect(plan.steps.map((s) => s.skillId)).toEqual([
      "consultar_das",
      "consultar_rbt12",
      "consultar_faixa",
      "consultar_aliquota",
      "consultar_vencimento_das",
    ]);
    expect(planIntent(detectIntent("Simular DAS")).steps.map((s) => s.skillId)).toEqual([
      "simular_tributos",
    ]);
  });

  it("responde o DAS com dados do motor oficial", async () => {
    const answer = await askBella("Quanto vou pagar de DAS?", "c1", {
      deps: deps(makeTestFiscalPort({ apportionment: apportionment() })),
    });
    expect(answer.intent).toBe("consultar_das");
    expect(answer.answered).toBe(true);
    expect(answer.text).toContain("10.590");
  });

  it("responde simulação de crescimento", async () => {
    const answer = await askBella("E se eu crescer 20%?", "c1", { deps: deps() });
    expect(answer.intent).toBe("simular_faturamento");
    expect(answer.skills).toEqual(["simular_tributos"]);
    expect(answer.text).toContain("Simulação");
  });

  it("degrada com mensagem clara quando o motor está indisponível", async () => {
    const broken = makeTestFiscalPort();
    broken.profile = async () => {
      throw new Error("offline");
    };
    const answer = await askBella("Qual meu anexo?", "c1", { deps: deps(broken) });
    expect(answer.answered).toBe(false);
  });
});
