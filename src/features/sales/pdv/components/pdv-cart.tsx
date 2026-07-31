import { memo, useCallback } from "react";
import { ImageIcon, Minus, Package, Plus, ShoppingCart, Trash2 } from "lucide-react";
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

function stockLabel(stock: number | null | undefined): string {
  if (stock == null) return "Estoque —";
  return `Estoque ${stock}`;
}

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
  const stock = item.stock_available;
  const lowStock = stock != null && stock < item.quantity;

  return (
    <li
      data-active={active || undefined}
      onFocus={activate}
      onMouseDown={activate}
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40 data-[active]:bg-muted/50 data-[active]:ring-1 data-[active]:ring-inset data-[active]:ring-primary/30"
    >
      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.description}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon className="h-5 w-5 text-muted-foreground/60" />
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-[15px] font-medium leading-tight">
          {item.description}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <span className="font-mono">{item.sku ?? "sem SKU"}</span>
          <span aria-hidden="true">·</span>
          <span className={lowStock ? "font-medium text-destructive" : ""}>
            {stockLabel(stock)}
          </span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">
            {formatCurrency(item.unit_price)}
          </span>
        </div>
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

        <div className="w-28 text-right">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Subtotal
          </p>
          <p className="text-base font-semibold tabular-nums">
            {formatCurrency(computeItemTotal(item))}
          </p>
        </div>

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
 * Sprint 2.9: linhas com imagem, SKU, estoque, preço e subtotal.
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
        <div className="flex min-h-80 flex-col items-center justify-center gap-2 p-10 text-center">
          <Package className="h-9 w-9 text-muted-foreground/50" />
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
