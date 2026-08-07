import { MonthlyClosingAudit } from "../types";

export const selectDomainChecklist = (audit: MonthlyClosingAudit, domain: string) => 
  audit.checklist.filter(item => item.domain === domain);

export const selectBlockingIssues = (audit: MonthlyClosingAudit) =>
  audit.checklist.filter(item => item.status === "error");

export const selectCriticalIssues = (audit: MonthlyClosingAudit) =>
  audit.checklist.filter(item => item.status === "warning");
