import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { usePdvProductSearch } from "../hooks/use-pdv-product-search";
import { pickSearchProduct } from "../lib/search-cache";
import { BARCODE_NOT_FOUND_MESSAGE } from "../lib/barcode";
import { PDV_FOCUS_IDS } from "../lib/focus";
import type { PDVProductOption } from "../types";

type Props = {
  companyId: string;
  value: string;
  onChange: (value: string) => void;
  onSelect: (product: PDVProductOption) => void;
  /** Limpa a pesquisa (ESC) — mesma ação usada pelos atalhos. */
  onClear?: () => void;
  disabled?: boolean;
};

/**
 * Busca de produtos do PDV — reutiliza a busca única de produtos.
 *
 * Sprint 2.8: este campo também é o alvo do leitor USB (keyboard wedge).
 * O leitor digita o código e envia ENTER; o produto é adicionado sozinho,
 * o campo é limpo e o cursor permanece aqui.
 */
export function PDVSearch({
  companyId,
  value,
  onChange,
  onSelect,
  onClear,
  disabled,
}: Props) {
  const { options, isSearching, lookup } = usePdvProductSearch(companyId, value);
  const [isAdding, setAdding] = useState(false);
  const addingRef = useRef(false);

  const commit = useCallback(
    async (raw: string) => {
      const code = raw.trim();
      if (!code || addingRef.current) return;
      addingRef.current = true;
      setAdding(true);
      try {
        const found = pickSearchProduct(code, await lookup(code));
        if (!found) {
          toast.error(BARCODE_NOT_FOUND_MESSAGE);
          return;
        }
        onSelect(found);
        onChange("");
      } finally {
        addingRef.current = false;
        setAdding(false);
      }
    },
    [lookup, onChange, onSelect],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") {
        event.preventDefault();
        void commit(event.currentTarget.value);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onChange("");
        onClear?.();
      }
    },
    [commit, onChange, onClear],
  );

  return (
    <div className="rounded-lg border bg-background p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={PDV_FOCUS_IDS.search}
          value={value}
          autoComplete="off"
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Bipe o código ou busque por código de barras, SKU, referência ou nome"
          className="h-11 pl-9 text-base"
        />
      </div>

      {value.trim().length >= 2 && (
        <div className="mt-3 space-y-1">
          {(isSearching || isAdding) && (
            <p className="text-sm text-muted-foreground">Buscando…</p>
          )}
          {!isSearching && !isAdding && options.length === 0 && (
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
              onClick={() => {
                onSelect(product);
                onChange("");
              }}
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
