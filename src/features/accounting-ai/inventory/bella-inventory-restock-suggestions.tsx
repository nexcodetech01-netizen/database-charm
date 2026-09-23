import { ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BellaInventoryActions } from "./bella-inventory-actions";
import type { BellaInventoryRestockSuggestion } from "./types";

export interface BellaInventoryRestockSuggestionsProps {
  suggestions: readonly BellaInventoryRestockSuggestion[];
  loading?: boolean;
  className?: string;
}

function formatQty(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/**
 * Sugestão de reposição — quanto comprar de cada produto, olhando o giro
 * de venda dos últimos 60 dias (não só "abaixo do mínimo"). Só sugere:
 * nenhum botão aqui cria pedido de compra ou lançamento algum.
 */
export function BellaInventoryRestockSuggestions({
  suggestions,
  loading = false,
  className,
}: BellaInventoryRestockSuggestionsProps) {
  return (
    <div className={cn("space-y-2", className)} data-testid="bella-inventory-restock-suggestions">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-4 w-4 text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold">Sugestão de compra</p>
      </div>
      <p className="text-xs text-muted-foreground">
        Com base no que cada produto vendeu nos últimos 60 dias — não considera
        sazonalidade nem prazo de entrega do fornecedor. Só sugere: nada é
        criado automaticamente.
      </p>

      {loading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma sugestão de compra no momento — estoque cobre a venda recente.
        </p>
      ) : (
        <ul className="space-y-2">
          {suggestions.map((item) => (
            <li
              key={item.id}
              className="space-y-1.5 rounded-xl border border-border/60 p-3"
              data-testid={`bella-inventory-restock-${item.id}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold leading-tight">{item.name}</p>
                <Badge variant="secondary" className="rounded-lg font-normal">
                  comprar {formatQty(item.suggestedQty)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Vendeu {formatQty(item.qtySold60d)} un. nos últimos 60 dias (
                {item.avgDailyVelocity.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}{" "}
                un./dia) · estoque atual {formatQty(item.stock)}
                {item.minStock > 0 ? ` · mín. ${formatQty(item.minStock)}` : ""}
              </p>
              <BellaInventoryActions size="xs" links={[item.link]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}