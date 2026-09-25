import { useState } from "react";
import { Plus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import type { PdvSearchOption } from "../lib/search-cache";

type Props = {
  suggestions: PdvSearchOption[];
  onAdd: (product: PdvSearchOption) => void;
};

/**
 * Sugestão de venda casada — aparece quando o último produto adicionado ao
 * carrinho tem complementares no catálogo. O componente pai deve montar
 * este componente com `key={forProductId}` (retornado por `usePdvUpsell`)
 * para que a sugestão reapareça sozinha a cada novo produto adicionado.
 */
export function PDVUpsellStrip({ suggestions, onAdd }: Props) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || suggestions.length === 0) return null;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-primary">
        Combina com:
      </span>
      <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
        {suggestions.map((p) => (
          <Button
            key={p.id}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onAdd(p)}
            title={`Adicionar ${p.name} ao carrinho`}
            className="h-auto shrink-0 gap-1.5 rounded-full px-2 py-1 text-[11px] hover:border-primary/50 hover:bg-primary/10"
          >
            <Plus className="h-3 w-3 text-primary" />
            <span className="max-w-[120px] truncate">{p.name}</span>
            <span className="font-semibold text-muted-foreground">
              {formatCurrency(p.price ?? 0)}
            </span>
          </Button>
        ))}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-5 w-5 shrink-0 text-muted-foreground"
        onClick={() => setDismissed(true)}
        title="Fechar sugestão"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}