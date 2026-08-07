import { useQuery } from "@tanstack/react-query";
import { MonthlyClosingAudit } from "../types";
import { useAccountingAiSummary } from "../../hooks/use-accounting-ai";
import { auditFinancialClosing } from "../queries/financial-audit";
import { auditFiscalClosing } from "../queries/fiscal-audit";
import { auditInventoryClosing } from "../queries/inventory-audit";
import { auditPurchasesClosing } from "../queries/purchases-audit";
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
      const [fiscalDocs, products, ledger, purchases, suppliers] = await Promise.all([
        accountingAiServices.audit.fiscalDocuments(companyId, 100),
        accountingAiServices.audit.products(companyId, 1000),
        accountingAiServices.inventory.ledgerAudit(companyId),
        accountingAiServices.audit.purchases(companyId, 100),
        accountingAiServices.audit.suppliers(companyId, 200)
      ]);
      
      const financialAudit = auditFinancialClosing(summaryQuery.data, month);
      const fiscalAudit = auditFiscalClosing(summaryQuery.data, fiscalDocs, products, month);
      const inventoryAudit = auditInventoryClosing(summaryQuery.data, products, ledger, month);
      const purchasesAudit = auditPurchasesClosing(summaryQuery.data, purchases, products, suppliers, month);

      // Merge results
      const totalScore = financialAudit.healthScore.score + fiscalAudit.healthScore.score + inventoryAudit.healthScore.score + purchasesAudit.healthScore.score;
      const avgScore = Math.round(totalScore / 4);
      const minScore = Math.min(
        financialAudit.healthScore.score, 
        fiscalAudit.healthScore.score, 
        inventoryAudit.healthScore.score,
        purchasesAudit.healthScore.score
      );
      
      return {
        month,
        healthScore: {
          score: avgScore,
          level: minScore < 40 ? "Crítica" : minScore < 70 ? "Atenção" : "Boa",
          label: `${financialAudit.healthScore.label} ${fiscalAudit.healthScore.label} ${inventoryAudit.healthScore.label} ${purchasesAudit.healthScore.label}`
        },
        checklist: [
          ...financialAudit.checklist, 
          ...fiscalAudit.checklist, 
          ...inventoryAudit.checklist,
          ...purchasesAudit.checklist
        ],
        summary: {
          monthSummary: `${financialAudit.summary.monthSummary} ${fiscalAudit.summary.monthSummary} ${inventoryAudit.summary.monthSummary} ${purchasesAudit.summary.monthSummary}`,
          achievements: [
            ...financialAudit.summary.achievements, 
            ...fiscalAudit.summary.achievements, 
            ...inventoryAudit.summary.achievements,
            ...purchasesAudit.summary.achievements
          ],
          problems: [
            ...financialAudit.summary.problems, 
            ...fiscalAudit.summary.problems, 
            ...inventoryAudit.summary.problems,
            ...purchasesAudit.summary.problems
          ],
          biggestRisk: purchasesAudit.summary.biggestRisk,
          biggestOpportunity: purchasesAudit.summary.biggestOpportunity,
          finalRecommendation: `${financialAudit.summary.finalRecommendation} ${fiscalAudit.summary.finalRecommendation} ${inventoryAudit.summary.finalRecommendation} ${purchasesAudit.summary.finalRecommendation}`
        },
        timeline: [
          ...financialAudit.timeline, 
          ...fiscalAudit.timeline, 
          ...inventoryAudit.timeline,
          ...purchasesAudit.timeline
        ].sort((a, b) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        )
      };
    }
  });
}
