/**
 * Executive Dashboard Engine — service.
 *
 * Ponto único de acesso ao resumo executivo. Consome EXCLUSIVAMENTE a RPC
 * `generate_executive_summary`, que por sua vez reaproveita os motores
 * contábil (`generate_dre`, `generate_balance_sheet`, `financial_kpis`),
 * financeiro, tributário (`company_rbt12`, `simples_compute`) e de estoque.
 * Nenhum cálculo é duplicado no cliente.
 */

import { supabase } from "@/integrations/supabase/client";
import { toExecutiveSnapshot } from "../lib/normalize";
import { computeExecutiveKpis } from "../lib/kpis";
import { detectExecutiveInsights } from "../lib/insights";
import { buildExecutiveForecast } from "../lib/forecast";
import { assessExecutiveRisk } from "../lib/risk";
import { buildExecutiveRecommendations } from "../lib/recommendations";
import { buildExecutiveAlerts } from "../lib/alerts";
import { rankCustomers, rankProducts, rankSuppliers } from "../lib/rankings";
import type { ExecutiveReport, ExecutiveSnapshot } from "../types";

/* eslint-disable @typescript-eslint/no-explicit-any */
const rpc = (name: string, args: Record<string, unknown>) =>
  (supabase as any).rpc(name, args) as Promise<{
    data: unknown;
    error: { message: string } | null;
  }>;
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Cache por empresa+período (mesma sessão) para evitar chamadas repetidas. */
const cache = new Map<string, { at: number; report: ExecutiveReport }>();
const TTL_MS = 60_000;

export function buildExecutiveReport(snapshot: ExecutiveSnapshot): ExecutiveReport {
  const kpis = computeExecutiveKpis(snapshot);
  const insights = detectExecutiveInsights(snapshot);
  const risk = assessExecutiveRisk(snapshot);
  const alerts = buildExecutiveAlerts(snapshot, insights, risk);
  const forecast = buildExecutiveForecast(snapshot);
  const recommendations = buildExecutiveRecommendations(snapshot, risk);
  return { snapshot, kpis, insights, alerts, forecast, risk, recommendations };
}

export const executiveService = {
  async snapshot(
    companyId: string,
    start?: string,
    end?: string,
  ): Promise<ExecutiveSnapshot> {
    const { data, error } = await rpc("generate_executive_summary", {
      _company_id: companyId,
      _start: start ?? null,
      _end: end ?? null,
    });
    if (error) throw error;
    return toExecutiveSnapshot(data);
  },

  async report(companyId: string, start?: string, end?: string): Promise<ExecutiveReport> {
    const key = `${companyId}:${start ?? ""}:${end ?? ""}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.report;
    const snapshot = await this.snapshot(companyId, start, end);
    const report = buildExecutiveReport(snapshot);
    cache.set(key, { at: Date.now(), report });
    return report;
  },

  invalidate(companyId?: string): void {
    if (!companyId) {
      cache.clear();
      return;
    }
    for (const key of [...cache.keys()]) {
      if (key.startsWith(`${companyId}:`)) cache.delete(key);
    }
  },

  rankings(report: ExecutiveReport) {
    const marginRatio =
      report.snapshot.dre.grossRevenue > 0
        ? report.snapshot.dre.netProfit / report.snapshot.dre.grossRevenue
        : 0;
    return {
      products: rankProducts(report.snapshot.rankings.products),
      customers: rankCustomers(report.snapshot.rankings.customers, marginRatio),
      suppliers: rankSuppliers(report.snapshot.rankings.suppliers),
    };
  },
};

export type ExecutiveService = typeof executiveService;
