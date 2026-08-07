import { MonthlyClosingAudit } from "../types";

export const getAuditSummary = (audit: MonthlyClosingAudit) => {
  return audit.summary;
};

export const getAuditHealth = (audit: MonthlyClosingAudit) => {
  return audit.healthScore;
};

export const getAuditTimeline = (audit: MonthlyClosingAudit) => {
  return audit.timeline;
};
