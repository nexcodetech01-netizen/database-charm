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
      
      // Busca dados de auditoria fiscal, produtos e estoque via adaptadores existentes
      const [fiscalDocs, products, ledger] = await Promise.all([
        accountingAiServices.audit.fiscalDocuments(companyId, 100),
        accountingAiServices.audit.products(companyId, 1000),
        accountingAiServices.inventory.ledgerAudit(companyId)
      ]);
      
      const financialAudit = auditFinancialClosing(summaryQuery.data, month);
      const fiscalAudit = auditFiscalClosing(summaryQuery.data, fiscalDocs, products, month);
      const inventoryAudit = auditInventoryClosing(summaryQuery.data, products, ledger, month);

      // Merge results
      const avgScore = Math.round((financialAudit.healthScore.score + fiscalAudit.healthScore.score + inventoryAudit.healthScore.score) / 3);
      const minScore = Math.min(financialAudit.healthScore.score, fiscalAudit.healthScore.score, inventoryAudit.healthScore.score);
      
      return {
        month,
        healthScore: {
          score: avgScore,
          level: minScore < 40 ? "Crítica" : minScore < 70 ? "Atenção" : "Boa",
          label: `${financialAudit.healthScore.label} ${fiscalAudit.healthScore.label} ${inventoryAudit.healthScore.label}`
        },
        checklist: [...financialAudit.checklist, ...fiscalAudit.checklist, ...inventoryAudit.checklist],
        summary: {
          monthSummary: `${financialAudit.summary.monthSummary} ${fiscalAudit.summary.monthSummary} ${inventoryAudit.summary.monthSummary}`,
          achievements: [...financialAudit.summary.achievements, ...fiscalAudit.summary.achievements, ...inventoryAudit.summary.achievements],
          problems: [...financialAudit.summary.problems, ...fiscalAudit.summary.problems, ...inventoryAudit.summary.problems],
          biggestRisk: inventoryAudit.summary.biggestRisk,
          biggestOpportunity: inventoryAudit.summary.biggestOpportunity,
          finalRecommendation: `${financialAudit.summary.finalRecommendation} ${fiscalAudit.summary.finalRecommendation} ${inventoryAudit.summary.finalRecommendation}`
        },
        timeline: [...financialAudit.timeline, ...fiscalAudit.timeline, ...inventoryAudit.timeline].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )
      };
    }
  });
}
