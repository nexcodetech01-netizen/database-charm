import { useQuery } from "@tanstack/react-query";
import { MonthlyClosingAudit } from "../types";
import { useAccountingAiSummary } from "../../hooks/use-accounting-ai";
import { auditFinancialClosing } from "../queries/financial-audit";
import { auditFiscalClosing } from "../queries/fiscal-audit";
import { auditInventoryClosing } from "../queries/inventory-audit";
import { auditPurchasesClosing } from "../queries/purchases-audit";
import { auditSalesClosing } from "../queries/sales-audit";
import { auditCashClosing } from "../queries/cash-audit";
import { currentPeriod } from "../../lib/helpers";
import { useAuth } from "@/providers/auth-provider";
import { consolidateMonthlyAudit } from "../queries/executive-consolidation";

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
      
      const [fiscalDocs, products, ledger, purchases, suppliers, sales, customers, cashSessions] = await Promise.all([
        accountingAiServices.audit.fiscalDocuments(companyId, 100),
        accountingAiServices.audit.products(companyId, 1000),
        accountingAiServices.inventory.ledgerAudit(companyId),
        accountingAiServices.audit.purchases(companyId, 100),
        accountingAiServices.audit.suppliers(companyId, 200),
        accountingAiServices.audit.sales(companyId, 200),
        accountingAiServices.audit.customers(companyId, 200),
        accountingAiServices.audit.cashSessions(companyId, 100)
      ]);
      
      const finance = auditFinancialClosing(summaryQuery.data, month);
      const fiscal = auditFiscalClosing(summaryQuery.data, fiscalDocs, products, month);
      const inventory = auditInventoryClosing(summaryQuery.data, products, ledger, month);
      const purchasesAudit = auditPurchasesClosing(summaryQuery.data, purchases, products, suppliers, month);
      const salesAudit = auditSalesClosing(summaryQuery.data, sales, products, customers, month);
      const cash = auditCashClosing(summaryQuery.data, cashSessions, month);

      return consolidateMonthlyAudit({
        finance,
        fiscal,
        inventory,
        purchases: purchasesAudit,
        sales: salesAudit,
        cash
      }, month);
    }
  });
}

