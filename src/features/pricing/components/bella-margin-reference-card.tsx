/**
 * BellaMarginReferenceCard — módulo CONSULTIVO
 * ============================================
 * A Bella NÃO define margens. Este card apenas exibe uma referência de
 * mercado (catálogo configurável `pricing_market_references`) para auxiliar
 * a configuração inicial da categoria. Aplicar é uma ação explícita do
 * usuário, que pode ignorar totalmente a sugestão.
 */
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listMarketReferences } from "@/features/pricing/lib/market-references.functions";
import { findMarketReference } from "@/features/pricing/official/market-reference";

interface Props {
  companyId: string;
  categoryName: string | null;
  onApply?: (values: { conservativePct: number; commonPct: number; premiumPct: number }) => void;
}

export function BellaMarginReferenceCard({ companyId, categoryName, onApply }: Props) {
  const refs = useQuery({
    queryKey: ["pricing", "market-references", companyId],
    queryFn: () => listMarketReferences({ data: { companyId } }),
    staleTime: 10 * 60_000,
    enabled: Boolean(companyId),
  });

  const reference = findMarketReference(refs.data ?? [], categoryName);
  if (!reference) return null;

  const items = [
    { label: "Conservadora", value: reference.conservativePct },
    { label: "Comum", value: reference.commonPct },
    { label: "Premium", value: reference.premiumPct },
  ];

  return (
    <div className="rounded-md border border-primary/25 bg-primary/5 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
        <Sparkles className="h-3.5 w-3.5" /> Bella — referência de mercado
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Faixa observada para {reference.label}. É apenas uma referência: a decisão da margem é
        sempre sua.
      </p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-center">
        {items.map((i) => (
          <div key={i.label} className="rounded-md border border-border/60 bg-background p-2">
            <p className="text-[10px] uppercase text-muted-foreground">{i.label}</p>
            <p className="text-sm font-semibold tabular-nums text-foreground">{i.value}%</p>
          </div>
        ))}
      </div>
      {onApply ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 w-full"
          onClick={() =>
            onApply({
              conservativePct: reference.conservativePct,
              commonPct: reference.commonPct,
              premiumPct: reference.premiumPct,
            })
          }
        >
          Usar como ponto de partida
        </Button>
      ) : null}
    </div>
  );
}
