/**
 * Bella Contadora — Fiscal: hook de leitura do painel.
 *
 * Reutiliza integralmente hooks já existentes:
 *  - `useAccountingAiSummary` (Bella) → saúde, insights e notificações;
 *  - `useFiscalDocuments`, `useFiscalCertificates`, `useFiscalReadiness`
 *    (Fiscal v2) → documentos, artefatos, certificado e prontidão.
 *
 * Nenhuma consulta nova ao banco e nenhuma regra fiscal.
 */
import { useMemo } from "react";
import {
  useFiscalCertificates,
  useFiscalDocuments,
} from "@/features/fiscal/v2/hooks/use-fiscal";
import { useFiscalReadiness } from "@/features/fiscal/v2/hooks/use-fiscal-readiness";
import { useAccountingAiSummary } from "../hooks/use-accounting-ai";
import { buildBellaFiscalView } from "./selectors";
import type {
  BellaFiscalCertLike,
  BellaFiscalDocLike,
  BellaFiscalOptions,
  BellaFiscalView,
} from "./types";

export function useBellaFiscal(
  companyId: string | undefined,
  options: BellaFiscalOptions = {},
): { view: BellaFiscalView; isLoading: boolean } {
  const { data: summary, isLoading: summaryLoading } = useAccountingAiSummary(companyId);
  const documents = useFiscalDocuments({ limit: 200 });
  const certificates = useFiscalCertificates();
  const readiness = useFiscalReadiness();

  const { alertLimit, recommendationLimit, certificateWarningDays } = options;

  const readinessSnapshot = useMemo(
    () =>
      readiness.isLoading
        ? null
        : {
            percent: readiness.percent,
            blockers: readiness.blockers,
            warnings: readiness.warnings,
            ready: readiness.ready,
            environment: readiness.environment,
          },
    [
      readiness.isLoading,
      readiness.percent,
      readiness.blockers,
      readiness.warnings,
      readiness.ready,
      readiness.environment,
    ],
  );

  const view = useMemo(
    () =>
      buildBellaFiscalView(
        {
          summary: summary ?? null,
          documents: (documents.data ?? null) as readonly BellaFiscalDocLike[] | null,
          certificates: (certificates.data ?? null) as readonly BellaFiscalCertLike[] | null,
          readiness: readinessSnapshot,
        },
        { alertLimit, recommendationLimit, certificateWarningDays },
      ),
    [
      summary,
      documents.data,
      certificates.data,
      readinessSnapshot,
      alertLimit,
      recommendationLimit,
      certificateWarningDays,
    ],
  );

  return {
    view,
    isLoading: summaryLoading || documents.isLoading || readiness.isLoading,
  };
}
