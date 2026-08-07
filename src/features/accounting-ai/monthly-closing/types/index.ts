import { z } from "zod";

export const MonthlyClosingHealthScoreSchema = z.object({
  score: z.number().min(0).max(100),
  level: z.enum(["Excelente", "Boa", "Atenção", "Crítica"]),
  label: z.string()
});

export const MonthlyClosingChecklistItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.enum(["success", "warning", "error", "pending"]),
  message: z.string().optional(),
  domain: z.enum(["finance", "inventory", "purchases", "sales", "pos", "fiscal", "taxes"])
});

export const MonthlyClosingAuditSchema = z.object({
  month: z.string(), // YYYY-MM
  healthScore: MonthlyClosingHealthScoreSchema,
  checklist: z.array(MonthlyClosingChecklistItemSchema),
  summary: z.object({
    monthSummary: z.string(),
    achievements: z.array(z.string()),
    problems: z.array(z.string()),
    biggestRisk: z.string(),
    biggestOpportunity: z.string(),
    finalRecommendation: z.string()
  }),
  timeline: z.array(z.object({
    date: z.string(),
    domain: z.string(),
    event: z.string(),
    type: z.enum(["info", "success", "warning", "error"])
  }))
});

export type MonthlyClosingHealthScore = z.infer<typeof MonthlyClosingHealthScoreSchema>;
export type MonthlyClosingChecklistItem = z.infer<typeof MonthlyClosingChecklistItemSchema>;
export type MonthlyClosingAudit = z.infer<typeof MonthlyClosingAuditSchema>;
