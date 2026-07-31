import { memo, useCallback } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { PDV_LAYOUT } from "../lib/layout";
import { pdvQuantityInputId } from "../lib/focus";
import { computeItemTotal, type SaleItemDraft } from "../../types";

type Props = {
  items: SaleItemDraft[];
  onQuantityChange: (uiKey: string, quantity: number) => void;
  onRemove: (uiKey: string) => void;
  /** Item ativo — alvo dos atalhos F3 (quantidade) e DELETE (remover). */
  activeKey?: string | null;
  onActivate?: (uiKey: string) => void;
  /** Somente leitura após a venda ter sido gravada. */
  readOnly?: boolean;
};

type RowProps = {
  item: SaleItemDraft;
  uiKey: string;
  active: boolean;
  readOnly?: boolean;
  onQuantityChange: (uiKey: string, quantity: number) => void;
  onRemove: (uiKey: string) => void;
  onActivate?: (uiKey: string) => void;
};

/**
 * Linha do carrinho. Memoizada porque o carrinho é re-renderizado a cada
 * leitura do scanner: sem memo, todas as linhas re-renderizam a cada bipe.
 */
const PDVCartRow = memo(function PDVCartRow({
  item,
  uiKey,
  active,
  readOnly,
  onQuantityChange,
  onRemove,
  onActivate,
}: RowProps) {
  const activate = useCallback(() => onActivate?.(uiKey), [onActivate, uiKey]);

  return (
    <li
      data-active={active || undefined}
      onFocus={activate}
      onMouseDown={activate}
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40 data-[active]:bg-muted/50"
    >
      <div className="min-w-0">
        <p className="truncate text-base font-medium leading-tight">
          {item.description}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {item.sku ?? "sem SKU"} · {formatCurrency(item.unit_price)}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9"
            disabled={readOnly}
            aria-label="Diminuir quantidade"
            onClick={() => onQuantityChange(uiKey, item.quantity - 1)}
          >
            <Minus className="h-4 w-4" />
          </Button>
          {/* Edição inline da quantidade (Sprint 2.8). */}
          <Input
            id={pdvQuantityInputId(uiKey)}
            type="number"
            min={1}
            step="1"
            inputMode="numeric"
            disabled={readOnly}
            aria-label={`Quantidade de ${item.description}`}
            value={item.quantity}
            onChange={(e) => onQuantityChange(uiKey, Number(e.target.value))}
            className="h-9 w-16 border-0 px-1 text-center text-lg font-semibold tabular-nums shadow-none focus-visible:ring-1"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-9 w-9"
            disabled={readOnly}
            aria-label="Aumentar quantidade"
            onClick={() => onQuantityChange(uiKey, item.quantity + 1)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <span className="w-28 text-right text-base font-semibold tabular-nums">
          {formatCurrency(computeItemTotal(item))}
        </span>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 text-destructive"
          disabled={readOnly}
          aria-label="Remover item"
          onClick={() => onRemove(uiKey)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
});

/**
 * Carrinho do PDV — manipula apenas o draft canônico da venda.
 * Sprint 2.9: linhas maiores, quantidade e subtotal destacados.
 * Sprint 2.8: quantidade editável inline e item ativo para atalhos.
 */
export function PDVCart({
  items,
  onQuantityChange,
  onRemove,
  activeKey,
  onActivate,
  readOnly,
}: Props) {
  return (
    <div className="flex flex-col rounded-xl border bg-card shadow-sm">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-5 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <ShoppingCart className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="truncate text-sm font-semibold">Carrinho</p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {items.length} linha(s)
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center gap-2 p-10 text-center">
          <ShoppingCart className="h-8 w-8 text-muted-foreground/60" />
          <p className="text-sm font-medium">Carrinho vazio</p>
          <p className="text-xs text-muted-foreground">
            Bipe um produto ou digite o código na pesquisa e pressione ENTER.
          </p>
        </div>
      ) : (
        <ul className={`${PDV_LAYOUT.cartScroll} divide-y`}>
          {items.map((item) => {
            const key = item.ui_key ?? item.product_id ?? item.description;
            return (
              <PDVCartRow
                key={key}
                uiKey={key}
                item={item}
                active={activeKey === key}
                readOnly={readOnly}
                onQuantityChange={onQuantityChange}
                onRemove={onRemove}
                onActivate={onActivate}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
