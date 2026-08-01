/**
 * Bella Contadora — ExplanationProvider (Sprint 7.3).
 *
 * Lê o período atual e o anterior EXCLUSIVAMENTE pela `ExplanationPort`
 * (que apenas delega para os motores oficiais) e reaproveita os retratos
 * já resolvidos (`summary`, `taxSnapshot`, `auditSnapshot`). Não grava,
 * não recalcula e não estima nada.
 */
import { accountingAiServices } from "../services/adapters";
import { currentPeriod, previousMonthPeriod, readSafely } from "../lib/helpers";
import type { ProviderDeps } from "../providers";
import type { ProviderResult } from "../types";
import { taxRegimeProvider } from "../tax/provider";
import { buildExplanationSnapshot } from "./builder";
import type {
  ExplanationDataset,
  ExplanationPeriodFacts,
  ExplanationSnapshot,
} from "./types";

function resolve(deps?: ProviderDeps) {
  return {
    services: deps?.services ?? accountingAiServices,
    period: deps?.period ?? currentPeriod(),
  };
}

/** Retrato completo das explicações — somente leitura. */
export async function explanationProvider(
  companyId: string,
  deps?: ProviderDeps,
): Promise<ProviderResult<ExplanationSnapshot>> {
  const { services, period } = resolve(deps);
  const previousPeriod = previousMonthPeriod(period);

  return readSafely("accounting", async () => {
    const [current, previous] = await Promise.all([
      services.explanation.periodFacts(companyId, period),
      services.explanation
        .periodFacts(companyId, previousPeriod)
        .catch(() => null) as Promise<ExplanationPeriodFacts | null>,
    ]);

    const summary = deps?.summary ?? null;
    const tax = deps?.taxSnapshot ?? (await taxRegimeProvider(companyId, deps));

    const dataset: ExplanationDataset = {
      period,
      previousPeriod: previous ? previousPeriod : null,
      current,
      previous,
      summary,
      tax: tax?.data ?? null,
      audit: deps?.auditSnapshot?.data ?? null,
    };

    return buildExplanationSnapshot(dataset);
  });
}
