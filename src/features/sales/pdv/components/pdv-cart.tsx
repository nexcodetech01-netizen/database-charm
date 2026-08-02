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
      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/40 data-[active]:bg-muted/50 data-[active]:ring-1 data-[active]:ring-inset data-[active]:ring-primary/30"
    >
      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border bg-muted/40">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.description}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <ImageIcon
            className="h-4 w-4 text-muted-foreground/60"
            aria-hidden="true"
          />
        )}
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight">
          {item.description}
        </p>
        <div className="flex items-center gap-x-1.5 truncate text-[11px] leading-tight text-muted-foreground">
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

      <div className="flex shrink-0 items-center gap-2">
        <div className="flex items-center rounded-lg border bg-background">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={readOnly}
            aria-label={`Diminuir quantidade de ${item.description}`}
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
            className="h-7 w-12 border-0 px-0 text-center text-sm font-semibold tabular-nums shadow-none focus-visible:ring-1"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            disabled={readOnly}
            aria-label={`Aumentar quantidade de ${item.description}`}
            onClick={() => onQuantityChange(uiKey, item.quantity + 1)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <p className="w-24 text-right text-sm font-semibold tabular-nums">
          {formatCurrency(computeItemTotal(item))}
        </p>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          disabled={readOnly}
          aria-label={`Remover ${item.description}`}
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
 * Sprint 3.1: hierarquia visual, respiro e empty state profissional.
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
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <ShoppingCart
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Carrinho
        </p>
        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="flex min-h-56 flex-col items-center justify-center gap-2 p-8 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-muted">
            <Package
              className="h-6 w-6 text-muted-foreground/70"
              aria-hidden="true"
            />
          </div>
          <p className="text-sm font-semibold">Carrinho vazio</p>
          <p className="max-w-xs text-xs text-muted-foreground">
            Passe o leitor de código de barras ou pesquise um produto.
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
