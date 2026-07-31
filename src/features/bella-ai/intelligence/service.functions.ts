/**
 * Server functions do módulo Executive Intelligence.
 * Todas autenticadas — RLS aplica por company_id automaticamente.
 *
 * NÃO altera Services, Providers, Skills ou Action Engine existentes.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveCompanyId } from "@/lib/company-resolver.server";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

import { runExecutiveEngine } from "./ExecutiveEngine";
import type {
  ComparisonResult,
  ExecutiveMetrics,
  ExecutiveRecommendation,
  ExecutiveScore,
  ExecutiveSummary,
  PeriodKey,
} from "./types";

type SB = SupabaseClient<Database>;

// Ferramenta interna: descobre companyId a partir do userId autenticado.


const periodValidator = (input?: { period?: PeriodKey }): { period: PeriodKey } => ({
  period: input?.period ?? "month",
});

// ---- Summary (retorna tudo em uma chamada) ---------------------------------

export const getExecutiveSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(periodValidator)
  .handler(async ({ data, context }): Promise<ExecutiveSummary> => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    return runExecutiveEngine(context.supabase, {
      companyId,
      period: data.period,
    });
  });

// ---- Score isolado ---------------------------------------------------------

export const getExecutiveScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(periodValidator)
  .handler(async ({ data, context }): Promise<ExecutiveScore> => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const summary = await runExecutiveEngine(context.supabase, {
      companyId,
      period: data.period,
    });
    return summary.score;
  });

// ---- Métricas isoladas -----------------------------------------------------

export const getExecutiveMetrics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(periodValidator)
  .handler(async ({ data, context }): Promise<ExecutiveMetrics> => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const summary = await runExecutiveEngine(context.supabase, {
      companyId,
      period: data.period,
    });
    return summary.metrics;
  });

// ---- Comparações -----------------------------------------------------------

export const getExecutiveComparisons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(periodValidator)
  .handler(async ({ data, context }): Promise<ComparisonResult[]> => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const summary = await runExecutiveEngine(context.supabase, {
      companyId,
      period: data.period,
    });
    return summary.comparisons;
  });

// ---- Recomendações ---------------------------------------------------------

export const getExecutiveRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(periodValidator)
  .handler(async ({ data, context }): Promise<ExecutiveRecommendation[]> => {
    const companyId = await resolveCompanyId(context.supabase, context.userId);
    const summary = await runExecutiveEngine(context.supabase, {
      companyId,
      period: data.period,
    });
    return summary.recommendations;
  });
