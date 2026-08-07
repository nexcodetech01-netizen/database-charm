import { useQuery } from "@tanstack/react-query";
import { MonthlyClosingAudit } from "../types";
import { useAccountingAiSummary } from "../../hooks/use-accounting-ai";
import { auditFinancialClosing } from "../queries/financial-audit";
import { currentPeriod } from "../../lib/helpers";
import { useAuth } from "@/providers/auth-provider";

export function useMonthlyClosingAudit(month: string) {
  const { user } = useAuth();
  const companyId = user?.company_id;
  
  const summaryQuery = useAccountingAiSummary(companyId, currentPeriod());

  return useQuery({
    queryKey: ["monthly-closing-audit", companyId, month],
    enabled: !!companyId && !!summaryQuery.data,
    queryFn: async (): Promise<MonthlyClosingAudit> => {
      if (!summaryQuery.data) {
        throw new Error("Summary data not available");
      }
      
      // Implementação real reutilizando os motores existentes
      return auditFinancialClosing(summaryQuery.data, month);
    }
  });
}

