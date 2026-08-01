/**
 * Bella Contadora — Tributário: providers de leitura.
 *
 * Toda aritmética tributária (faixa, alíquota efetiva, DAS, projeções)
 * é executada pelo motor oficial via `FiscalPort`. Aqui só há composição
 * de entradas, transporte e agregação estatística de leitura.
 */
import { SIMPLES_LIMIT, buildTaxAlerts, findBracket, toCompetence } from "@/features/tax";
import type { SimplesAnnex, TaxApportionment } from "@/features/tax";
import { accountingAiServices } from "../services/adapters";
import { currentPeriod, readSafely } from "../lib/helpers";
import type { ProviderDeps } from "../providers";
import type { ProviderResult } from "../types";
import type {
  BellaTaxHistoryPoint,
  BellaTaxSimulation,
  BellaTaxSimulationInput,
  BellaTaxSimulationScenario,
  BellaTaxSnapshot,
} from "./types";

function resolve(deps?: ProviderDeps) {
  return {
    services: deps?.services ?? accountingAiServices,
    period: deps?.period ?? currentPeriod(),
  };
}

function historyPoint(a: TaxApportionment): BellaTaxHistoryPoint {
  return {
    competence: a.competence,
    taxAmount: a.taxAmount,
    revenue: a.revenue,
    effectiveRate: a.effectiveRate,
    bracket: a.bracket,
    status: a.status,
  };
}

/** Data de vencimento derivada do `due_day` do perfil oficial. */
export function dueDateFromProfile(
  competence: string,
  dueDay: number | null | undefined,
): string | null {
  if (!dueDay || dueDay < 1) return null;
  const [y, m] = competence.split("-").map(Number);
  if (!y || !m) return null;
  const year = m === 12 ? y + 1 : y;
  const month = m === 12 ? 1 : m + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const day = Math.min(dueDay, lastDay);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Retrato tributário da competência: regime, anexo, RBT12, faixa,
 * alíquota efetiva, DAS e alertas oficiais.
 */
export async function taxRegimeProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<BellaTaxSnapshot>> {
  const { services, period } = resolve(deps);
  const competence = toCompetence(period.start);

  return readSafely("fiscal", async () => {
    const [profile, apportionment, history] = await Promise.all([
      services.fiscal.profile(companyId),
      services.fiscal.apportionment(companyId, competence),
      services.fiscal.apportionments(companyId, 12),
    ]);

    const rbt12 = apportionment?.rbt12 ?? (await services.fiscal.rbt12(companyId, competence));
    const monthRevenue =
      apportionment?.revenue ?? (await services.fiscal.monthlyRevenue(companyId, competence));
    const annex: SimplesAnnex | null =
      apportionment?.simplesAnnex ?? profile?.simplesAnnex ?? null;

    let bracket = apportionment?.bracket ?? null;
    let nominalRate = apportionment?.nominalRate ?? 0;
    let deduction = apportionment?.deduction ?? 0;
    let effectiveRate = apportionment?.effectiveRate ?? 0;
    let dasAmount = apportionment?.taxAmount ?? 0;
    let limitUsagePct = (rbt12 / SIMPLES_LIMIT) * 100;
    const dasSource = apportionment ? "apuracao" : "simulacao";

    if (!apportionment && annex) {
      const computed = await services.fiscal.simulateSimples(annex, rbt12, monthRevenue);
      bracket = computed.bracket;
      nominalRate = computed.nominalRate;
      deduction = computed.deduction;
      effectiveRate = computed.effectiveRate;
      dasAmount = computed.taxAmount;
      limitUsagePct = computed.limitUsagePct;
    }

    const currentBracket = annex ? findBracket(annex, rbt12) : null;
    const bracketCeiling = currentBracket?.rbt12To ?? null;
    const distanceToNextBracket = bracketCeiling == null ? null : bracketCeiling - rbt12;

    const ordered = [...history].sort((a, b) => b.competence.localeCompare(a.competence));
    const previous =
      ordered.find((a) => a.competence.slice(0, 7) !== competence.slice(0, 7)) ?? null;

    const alerts = buildTaxAlerts({
      annex,
      rbt12,
      current: apportionment,
      previous,
    });

    const paidHistory = ordered.filter((a) => a.taxAmount > 0);
    const averageTax =
      paidHistory.length > 0
        ? paidHistory.reduce((sum, a) => sum + a.taxAmount, 0) / paidHistory.length
        : null;

    const snapshot: BellaTaxSnapshot = {
      competence,
      regime: profile?.taxRegime ?? apportionment?.taxRegime ?? null,
      annex,
      rbt12,
      monthRevenue,
      bracket,
      nominalRate,
      deduction,
      effectiveRate,
      dasAmount,
      dasSource,
      dasStatus: apportionment?.status ?? null,
      dueDate: apportionment?.dueDate ?? dueDateFromProfile(competence, profile?.dueDay),
      dueDay: profile?.dueDay ?? null,
      limitUsagePct,
      bracketCeiling,
      distanceToNextBracket,
      alerts,
      history: ordered.map(historyPoint),
      averageTax,
    };
    return snapshot;
  });
}

const DEFAULT_GROWTHS = [0, 10, 20, 30];

function scenarioLabel(growthPct: number): string {
  if (growthPct === 0) return "Cenário atual";
  const signal = growthPct > 0 ? "+" : "";
  return `Faturamento ${signal}${growthPct}%`;
}

/**
 * Simulação tributária. Cenários percentuais usam `project_tax_scenarios`;
 * faturamento alvo usa `simples_compute`. A Bella nunca calcula imposto.
 */
export async function taxSimulationProvider(
  companyId: string,
  input: BellaTaxSimulationInput,
  deps?: ProviderDeps,
): Promise<ProviderResult<BellaTaxSimulation>> {
  const { services, period } = resolve(deps);
  const competence = toCompetence(period.start);

  return readSafely("fiscal", async () => {
    const [profile, apportionment] = await Promise.all([
      services.fiscal.profile(companyId),
      services.fiscal.apportionment(companyId, competence),
    ]);
    const annex: SimplesAnnex | null =
      apportionment?.simplesAnnex ?? profile?.simplesAnnex ?? null;
    const rbt12 = apportionment?.rbt12 ?? (await services.fiscal.rbt12(companyId, competence));
    const baseRevenue =
      apportionment?.revenue ?? (await services.fiscal.monthlyRevenue(companyId, competence));

    const scenarios: BellaTaxSimulationScenario[] = [];
    let highlighted: BellaTaxSimulationScenario | null = null;

    const growthPct =
      input.growthPct != null && Number.isFinite(input.growthPct) ? input.growthPct : null;
    const targetRevenue =
      input.targetRevenue != null && Number.isFinite(input.targetRevenue)
        ? input.targetRevenue
        : null;

    if (targetRevenue != null && annex) {
      // Composição de entradas do motor: o RBT12 acompanha a variação da
      // receita da competência. O cálculo permanece 100% no `simples_compute`.
      const base = await services.fiscal.simulateSimples(annex, rbt12, baseRevenue);
      const projected = await services.fiscal.simulateSimples(
        annex,
        rbt12 + (targetRevenue - baseRevenue),
        targetRevenue,
      );
      scenarios.push(
        {
          label: "Cenário atual",
          growthPct: 0,
          revenue: base.revenue,
          taxAmount: base.taxAmount,
          effectiveRate: base.effectiveRate,
          bracket: base.bracket,
        },
        {
          label: "Faturamento simulado",
          growthPct: null,
          revenue: projected.revenue,
          taxAmount: projected.taxAmount,
          effectiveRate: projected.effectiveRate,
          bracket: projected.bracket,
        },
      );
      highlighted = scenarios[1] ?? null;
    } else {
      const growths =
        growthPct != null
          ? Array.from(new Set([0, growthPct])).sort((a, b) => a - b)
          : DEFAULT_GROWTHS;
      const projection = await services.fiscal.projectScenarios(
        companyId,
        competence,
        growths,
      );
      for (const s of projection.scenarios) {
        scenarios.push({
          label: scenarioLabel(s.growthPct),
          growthPct: s.growthPct,
          revenue: s.revenue,
          taxAmount: s.taxAmount,
          effectiveRate: s.effectiveRate,
          bracket: s.bracket,
        });
      }
      highlighted =
        growthPct != null
          ? (scenarios.find((s) => s.growthPct === growthPct) ?? null)
          : null;
    }

    const base = scenarios.find((s) => s.growthPct === 0) ?? scenarios[0] ?? null;
    const baseTaxAmount = base?.taxAmount ?? 0;

    const simulation: BellaTaxSimulation = {
      competence,
      annex,
      baseRevenue: base?.revenue ?? baseRevenue,
      baseTaxAmount,
      rbt12,
      scenarios,
      highlighted,
      taxDelta: highlighted ? highlighted.taxAmount - baseTaxAmount : null,
      changesBracket:
        highlighted != null &&
        base != null &&
        highlighted.bracket != null &&
        base.bracket != null &&
        highlighted.bracket !== base.bracket,
    };
    return simulation;
  });
}
