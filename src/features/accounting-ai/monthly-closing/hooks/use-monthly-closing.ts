import { useQuery } from "@tanstack/react-query";
import { MonthlyClosingAudit } from "../types";

// Mock data for initial structure
const mockAudit: MonthlyClosingAudit = {
  month: "2026-07",
  healthScore: {
    score: 85,
    level: "Boa",
    label: "Sua empresa está em um bom caminho, mas há pontos de atenção antes do fechamento."
  },
  checklist: [],
  summary: {
    monthSummary: "Mês de crescimento estável com foco em vendas diretas.",
    achievements: ["Batemos a meta de vendas", "Redução de 5% no custo fixo"],
    problems: ["Atraso em 2 fornecedores críticos"],
    biggestRisk: "Fluxo de caixa apertado na última semana",
    biggestOpportunity: "Expansão para novos canais de marketplace",
    finalRecommendation: "Regularize as pendências fiscais antes de fechar o mês."
  },
  timeline: []
};

export function useMonthlyClosingAudit(month: string) {
  return useQuery({
    queryKey: ["monthly-closing-audit", month],
    queryFn: async (): Promise<MonthlyClosingAudit> => {
      // Logic will be implemented in the next sprint
      return mockAudit;
    }
  });
}
