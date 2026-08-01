import { Link } from "@tanstack/react-router";
import { HeartHandshake } from "lucide-react";
import { Section } from "@/components/design";
import { useInterestSummary } from "../hooks/use-interests";
import { buildInterestInsights } from "../lib/interest-insights";
import { InterestBellaHints } from "./interest-bella-hints";

const BRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Card da Lista de Interesse no Dashboard — potencial de vendas. */
export function InterestDashboardCard({ companyId }: { companyId: string }) {
  const { summary } = useInterestSummary(companyId);
  const insights = buildInterestInsights(summary);

  return (
    <Section
      title="Lista de interesse"
      description="Demanda registrada por produtos indisponíveis."
      actions={
        <Link to="/comercial/lista-interesse" className="text-sm text-primary hover:underline">
          Ver lista
        </Link>
      }
    >
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">Clientes aguardando</p>
          <p className="text-2xl font-semibold">{summary.waitingCustomers}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Produtos aguardados</p>
          <p className="text-2xl font-semibold">{summary.waitedProducts}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Potencial de vendas</p>
          <p className="text-2xl font-semibold">{BRL(summary.potential)}</p>
        </div>
      </div>

      {summary.openCount === 0 ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <HeartHandshake className="h-4 w-4" aria-hidden="true" />
          Nenhum interesse em aberto.
        </p>
      ) : (
        <div className="mt-4">
          <InterestBellaHints insights={insights} />
        </div>
      )}
    </Section>
  );
}
