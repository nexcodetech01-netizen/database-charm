import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { ScanLine, Search } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { usePdvProductSearch } from "../hooks/use-pdv-product-search";
import { pickSearchProduct } from "../lib/search-cache";
import { BARCODE_NOT_FOUND_MESSAGE } from "../lib/barcode";
import { PDV_FOCUS_IDS } from "../lib/focus";
import { cn } from "@/lib/utils";
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
 *
 * Sprint 3.1: área dominante da tela (altura, contraste e indicação visual
 * de "Scanner pronto" quando focada). Funcionamento inalterado.
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
  const [focused, setFocused] = useState(false);
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
    <div
      className={cn(
        "rounded-xl border-2 bg-background p-3 transition-colors",
        focused && !disabled ? "border-primary/60" : "border-border",
      )}
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden="true"
        />
        <Input
          id={PDV_FOCUS_IDS.search}
          value={value}
          autoComplete="off"
          disabled={disabled}
          aria-label="Pesquisar produto por código, SKU ou nome"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Pesquisar produto • Código • SKU • Nome"
          className="h-14 pl-12 pr-4 text-lg font-medium"
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 px-1">
        <span
          aria-live="polite"
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            focused && !disabled ? "text-emerald-600" : "text-muted-foreground",
          )}
        >
          <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
          {focused && !disabled ? "Scanner pronto" : "Clique ou pressione F1 para focar"}
        </span>
        <span className="text-xs text-muted-foreground">
          ENTER adiciona automaticamente
        </span>
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
              className="h-auto w-full justify-between px-3 py-2.5 text-left"
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
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(product.price ?? 0)}
              </span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
