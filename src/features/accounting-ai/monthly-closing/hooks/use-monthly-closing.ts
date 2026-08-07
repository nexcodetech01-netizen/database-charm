import { useQuery } from "@tanstack/react-query";
import { MonthlyClosingAudit } from "../types";
import { useAccountingAiSummary } from "../../hooks/use-accounting-ai";
import { auditFinancialClosing } from "../queries/financial-audit";
import { auditFiscalClosing } from "../queries/fiscal-audit";
import { auditInventoryClosing } from "../queries/inventory-audit";
import { currentPeriod } from "../../lib/helpers";
import { useAuth } from "@/providers/auth-provider";
import { accountingAiServices } from "../../services/adapters";


export function useMonthlyClosingAudit(month: string) {
  const { user } = useAuth();
  const companyId = (user as any)?.company_id;
  
  const summaryQuery = useAccountingAiSummary(companyId, currentPeriod());


  return useQuery({
    queryKey: ["monthly-closing-audit", companyId, month],
    enabled: !!companyId && !!summaryQuery.data,
    queryFn: async (): Promise<MonthlyClosingAudit> => {
      if (!summaryQuery.data) {
        throw new Error("Summary data not available");
      }
      
      // Busca dados de auditoria fiscal e produtos via adaptadores existentes
      const [fiscalDocs, products] = await Promise.all([
        accountingAiServices.audit.fiscalDocuments(companyId, 100),
        accountingAiServices.audit.products(companyId, 500)
      ]);
      
      const financialAudit = auditFinancialClosing(summaryQuery.data, month);
      const fiscalAudit = auditFiscalClosing(summaryQuery.data, fiscalDocs, products, month);

      // Merge results
      return {
        month,
        healthScore: {
          score: Math.round((financialAudit.healthScore.score + fiscalAudit.healthScore.score) / 2),
          level: financialAudit.healthScore.score < 40 || fiscalAudit.healthScore.score < 40 ? "Crítica" : 
                 financialAudit.healthScore.score < 70 || fiscalAudit.healthScore.score < 70 ? "Atenção" : "Boa",
          label: `${financialAudit.healthScore.label} ${fiscalAudit.healthScore.label}`
        },
        checklist: [...financialAudit.checklist, ...fiscalAudit.checklist],
        summary: {
          monthSummary: `${financialAudit.summary.monthSummary} ${fiscalAudit.summary.monthSummary}`,
          achievements: [...financialAudit.summary.achievements, ...fiscalAudit.summary.achievements],
          problems: [...financialAudit.summary.problems, ...fiscalAudit.summary.problems],
          biggestRisk: financialAudit.summary.biggestRisk,
          biggestOpportunity: fiscalAudit.summary.biggestOpportunity,
          finalRecommendation: `${financialAudit.summary.finalRecommendation} ${fiscalAudit.summary.finalRecommendation}`
        },
        timeline: [...financialAudit.timeline, ...fiscalAudit.timeline].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )
      };
    }
  });
}

