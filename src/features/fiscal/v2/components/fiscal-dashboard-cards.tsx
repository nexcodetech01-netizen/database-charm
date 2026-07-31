import { CheckCircle2, Clock, XCircle, Ban } from "lucide-react";
import { KpiCard, KpiSection } from "@/components/layout";
import type { FiscalDashboard } from "../functions/fiscal.functions";

/**
 * Dashboard fiscal simplificado — 4 KPIs de status agregado.
 * Detalhes de certificado, provedor, ambiente e série moram no
 * painel `FiscalModuleStatus`, não como KPIs duplicados.
 */
export function FiscalDashboardCards({
  data,
}: {
  data: FiscalDashboard | undefined;
}) {
  const totals = data?.totals;
  const processing = totals
    ? totals.draft +
      totals.validating +
      totals.signing +
      totals.sending
    : 0;

  return (
    <KpiSection columns={4}>
      <KpiCard
        icon={CheckCircle2}
        label="Autorizadas"
        value={String(totals?.authorized ?? 0)}
        hint="Total histórico"
      />
      <KpiCard
        icon={Clock}
        label="Em processamento"
        value={String(processing)}
        hint="Aguardando SEFAZ"
      />
      <KpiCard
        icon={XCircle}
        label="Rejeitadas"
        value={String(totals?.rejected ?? 0)}
        hint="Requer ação"
      />
      <KpiCard
        icon={Ban}
        label="Canceladas"
        value={String(totals?.cancelled ?? 0)}
        hint="Total histórico"
      />
    </KpiSection>
  );
}
