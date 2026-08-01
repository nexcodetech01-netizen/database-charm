import { describe, expect, it } from "vitest";
import { accountingReports, getAccountingReport } from "../reports";
import { accountingAutomations, getAccountingAutomation } from "../automations";
import { accountingAiSkills, getAccountingSkill } from "../skills";

describe("accounting-ai · arquitetura", () => {
  it("expõe os 6 relatórios previstos", () => {
    expect(accountingReports.map((r) => r.id)).toEqual([
      "dre",
      "cash_flow",
      "monthly_result",
      "profitability",
      "payroll",
      "profit_distribution",
    ]);
    expect(getAccountingReport("dre")?.sections.length).toBeGreaterThan(0);
    expect(accountingReports.every((r) => r.status === "planned")).toBe(true);
  });

  it("expõe as 5 automações sem agendamento ativo", () => {
    expect(accountingAutomations).toHaveLength(5);
    expect(accountingAutomations.every((a) => a.enabled === false)).toBe(true);
    expect(getAccountingAutomation("monthly_closing")?.cadence).toBe("monthly");
  });

  it("expõe as 38 skills e todas são somente leitura", () => {
    expect(accountingAiSkills.map((s) => s.id)).toEqual([
      "consultar_lucro",
      "consultar_fluxo",
      "consultar_dre",
      "consultar_caixa",
      "consultar_impostos",
      "consultar_prolabore",
      "consultar_reserva",
      "consultar_produtos",
      "consultar_receita",
      "consultar_ticket",
      "consultar_clientes",
      "consultar_saude",
      "consultar_insights",
      "consultar_alertas",
      "consultar_recomendacoes",
      "consultar_retirada",
      "consultar_disponibilidade",
      "consultar_risco",
      "consultar_notificacoes",
      "consultar_das",
      "consultar_rbt12",
      "consultar_anexo",
      "consultar_aliquota",
      "consultar_faixa",
      "consultar_vencimento_das",
      "simular_tributos",
      "auditar_empresa",
      "consultar_inconsistencias",
      "consultar_saude_operacional",
      "explicar_lucro",
      "explicar_caixa",
      "explicar_receita",
      "explicar_despesas",
      "explicar_impostos",
      "explicar_ticket",
      "explicar_estoque",
      "explicar_resultado",
      "explicar_indicadores",
    ]);
    expect(accountingAiSkills.every((s) => s.readOnly)).toBe(true);
    expect(getAccountingSkill("consultar_caixa")?.name).toBe("Consultar caixa");
  });

  it("automações referenciam apenas skills existentes", () => {
    const ids = new Set(accountingAiSkills.map((s) => s.id as string));
    for (const automation of accountingAutomations) {
      for (const skill of automation.usesSkills) {
        expect(ids.has(skill)).toBe(true);
      }
    }
  });
});
