import { useCallback, useRef, useState, useEffect } from "react";
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
  const [activeIndex, setActiveIndex] = useState(-1);
  const addingRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Reset active index when options change
  useEffect(() => {
    setActiveIndex(-1);
  }, [options]);

  // Handle scroll into view
  useEffect(() => {
    if (activeIndex >= 0 && itemRefs.current[activeIndex]) {
      itemRefs.current[activeIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [activeIndex]);

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
        // If an item is active in the list, select it
        if (activeIndex >= 0 && options[activeIndex]) {
          onSelect(options[activeIndex]);
          onChange("");
          setActiveIndex(-1);
          return;
        }
        // Otherwise, attempt a direct code lookup (barcode/sku)
        void commit(event.currentTarget.value);
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => (prev < options.length - 1 ? prev + 1 : prev));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : prev));
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        onChange("");
        onClear?.();
        setActiveIndex(-1);
      }
    },
    [commit, onChange, onClear, activeIndex, options, onSelect],
  );

  return (
    <div
      className={cn(
        "relative rounded-lg border bg-background transition-colors",
        focused && !disabled ? "border-primary/60 ring-1 ring-primary/30" : "border-border",
      )}
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
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
          className="h-11 border-0 pl-9 pr-32 text-base font-medium shadow-none focus-visible:ring-0"
        />
        <span
          aria-live="polite"
          className={cn(
            "pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-1.5 text-[11px] font-medium sm:flex",
            focused && !disabled ? "text-status-success" : "text-muted-foreground",
          )}
        >
          <ScanLine className="h-3.5 w-3.5" aria-hidden="true" />
          {focused && !disabled ? "Scanner pronto" : "ENTER adiciona"}
        </span>
      </div>


      {value.trim().length >= 2 && (
        <div 
          ref={listRef}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 space-y-0.5 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg"
        >
          {(isSearching || isAdding) && (
            <p className="p-2 text-sm text-muted-foreground animate-pulse">Buscando…</p>
          )}
          {!isSearching && !isAdding && options.length === 0 && (
            <p className="p-2 text-sm text-muted-foreground">
              Nenhum produto encontrado
            </p>
          )}
          {options.map((product, index) => (
            <Button
              key={product.id}
              ref={(el) => (itemRefs.current[index] = el)}
              type="button"
              variant="ghost"
              className={cn(
                "h-auto w-full justify-between px-2 py-1.5 text-left transition-colors duration-150",
                index === activeIndex ? "bg-primary text-primary-foreground hover:bg-primary/90" : "hover:bg-accent hover:text-accent-foreground"
              )}
              onClick={() => {
                onSelect(product);
                onChange("");
                setActiveIndex(-1);
              }}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {product.name}
                </span>
                <span className={cn(
                  "block text-xs",
                  index === activeIndex ? "text-primary-foreground/70" : "text-muted-foreground"
                )}>
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
