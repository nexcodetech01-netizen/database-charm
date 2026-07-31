import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { usePdvProductSearch } from "../hooks/use-pdv-product-search";
import type { PDVProductOption } from "../types";

type Props = {
  companyId: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (product: PDVProductOption) => void;
};

/** Busca de produtos do PDV — reutiliza a busca única de produtos. */
export function PDVSearch({ companyId, value, onChange, onSelect }: Props) {
  const { options, isSearching } = usePdvProductSearch(companyId, value);

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="pdv-search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Buscar produto por nome, SKU ou marca"
          className="h-11 pl-9 text-base"
        />
      </div>

      {value.trim().length >= 2 && (
        <div className="mt-3 space-y-1">
          {isSearching && (
            <p className="text-sm text-muted-foreground">Buscando…</p>
          )}
          {!isSearching && options.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum produto encontrado
            </p>
          )}
          {options.map((product) => (
            <Button
              key={product.id}
              type="button"
              variant="ghost"
              className="h-auto w-full justify-between px-3 py-2 text-left"
              onClick={() => onSelect(product)}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {product.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {product.sku ?? "sem SKU"}
                  {product.stock != null ? ` · estoque ${product.stock}` : ""}
                </span>
              </span>
              <span className="text-sm font-medium">
                {formatCurrency(product.price ?? 0)}
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
