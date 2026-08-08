import { memo, useCallback } from "react";
import { ImageIcon, Minus, Package, Plus, ShoppingCart, XCircle, Tag, MessageSquare, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { PDV_LAYOUT } from "../lib/layout";
import { pdvQuantityInputId } from "../lib/focus";
import { computeItemTotal, type SaleItemDraft } from "../../types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type Props = {
  items: SaleItemDraft[];
  onQuantityChange: (uiKey: string, quantity: number) => void;
  onRemove: (uiKey: string) => void;
  /** Item ativo — alvo dos atalhos F3 (quantidade) e DELETE (remover). */
  activeKey?: string | null;
  onActivate?: (uiKey: string) => void;
  /** Somente leitura após a venda ter sido gravada. */
  readOnly?: boolean;
  onEditPrice?: (item: SaleItemDraft) => void;
  onEditDiscount?: (item: SaleItemDraft) => void;
  onEditAddition?: (item: SaleItemDraft) => void;
  onEditNotes?: (item: SaleItemDraft) => void;
};

type RowProps = {
  item: SaleItemDraft;
  uiKey: string;
  active: boolean;
  readOnly?: boolean;
  onQuantityChange: (uiKey: string, quantity: number) => void;
  onRemove: (uiKey: string) => void;
  onActivate?: (uiKey: string) => void;
  onEditPrice?: (item: SaleItemDraft) => void;
  onEditDiscount?: (item: SaleItemDraft) => void;
  onEditAddition?: (item: SaleItemDraft) => void;
  onEditNotes?: (item: SaleItemDraft) => void;
};

/**
 * Linha do carrinho refatorada (Sprint 8.x).
 * Layout em card visual com imagem ampliada e destaque total do preço.
 */
const PDVCartRow = memo(function PDVCartRow({
  item,
  uiKey,
  active,
  readOnly,
  onQuantityChange,
  onRemove,
  onActivate,
  onEditPrice,
  onEditDiscount,
  onEditAddition,
  onEditNotes,
}: RowProps) {
  const activate = useCallback(() => onActivate?.(uiKey), [onActivate, uiKey]);
  
  const stock = item.stock_available;
  const lowStock = stock != null && stock < item.quantity;
  const itemTotal = computeItemTotal(item);
  
  const hasPriceChange = item.original_unit_price != null && item.unit_price !== item.original_unit_price;
  const hasDiscount = (item.discount || 0) > 0;
  const hasAddition = (item.addition || 0) > 0;
  const hasNotes = !!item.notes;

  // Extrair variação da descrição se seguir o padrão "Produto (Variação)"
  const variationMatch = item.description.match(/\(([^)]+)\)$/);
  const baseName = variationMatch ? item.description.replace(variationMatch[0], "").trim() : item.description;
  const variation = variationMatch ? variationMatch[1] : null;

  return (
    <li
      data-active={active || undefined}
      onFocus={activate}
      onMouseDown={activate}
      className={cn(
        "flex gap-4 p-4 transition-all duration-200 rounded-lg border border-transparent mb-2",
        "bg-muted/30 hover:bg-muted/50",
        "data-[active]:bg-card data-[active]:border-primary/30 data-[active]:shadow-sm data-[active]:ring-1 data-[active]:ring-primary/20"
      )}
    >
      {/* Imagem do Produto (Quadrado maior) */}
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border bg-background shadow-sm">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.description}
            loading="lazy"
            className="h-full w-full object-cover transition-transform hover:scale-110"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/20">
            <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}
        {lowStock && (
          <div className="absolute inset-x-0 bottom-0 bg-destructive/90 py-0.5 text-center text-[8px] font-bold uppercase text-white">
            Baixo Estoque
          </div>
        )}
      </div>

      {/* Descrição e Metadados */}
      <div className="flex flex-col flex-1 min-w-0 justify-between py-0.5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-sm font-semibold leading-tight truncate" title={item.description}>
                {baseName}
              </h4>
              {variation && (
                <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                  {variation}
                </p>
              )}
            </div>
            
            <div className="flex flex-wrap gap-1 shrink-0">
              {(hasPriceChange || hasDiscount || hasAddition) && (
                <Badge variant="outline" className="h-4 px-1 text-[8px] uppercase font-bold bg-primary/5 text-primary border-primary/20">
                  <Tag className="h-2 w-2 mr-0.5" />
                  Ajustado
                </Badge>
              )}
              {hasNotes && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button onClick={() => onEditNotes?.(item)} className="text-primary hover:text-primary/80">
                        <MessageSquare className="h-3.5 w-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">{item.notes}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[10px] text-muted-foreground font-medium">
            <span className="bg-muted/50 px-1.5 rounded uppercase tracking-wider">SKU: {item.sku ?? "---"}</span>
            <span className="text-muted-foreground/30">|</span>
            <span className={cn(lowStock ? "text-destructive font-bold" : "")}>
              Estoque: {stock ?? "---"}
            </span>
            <span className="text-muted-foreground/30">|</span>
            <span>Unit: {formatCurrency(item.unit_price)}</span>
          </div>
        </div>

        {/* Seletor de Quantidade (Alinhado à esquerda/centro do grupo de descrição) */}
        <div className="flex items-center gap-2 mt-3">
          <div className="flex items-center rounded-md border bg-background shadow-sm h-7 overflow-hidden">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-full w-7 rounded-none hover:bg-muted"
              disabled={readOnly}
              onClick={() => onQuantityChange(uiKey, Math.max(1, item.quantity - 1))}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Input
              id={pdvQuantityInputId(uiKey)}
              type="number"
              min={1}
              step="1"
              inputMode="numeric"
              disabled={readOnly}
              value={item.quantity}
              onChange={(e) => onQuantityChange(uiKey, Number(e.target.value))}
              className="h-full w-9 border-0 px-0 text-center text-xs font-bold tabular-nums shadow-none focus-visible:ring-0 bg-transparent"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-full w-7 rounded-none hover:bg-muted"
              disabled={readOnly}
              onClick={() => onQuantityChange(uiKey, item.quantity + 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          
          <div className="flex items-center gap-1">
             <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-primary"
                disabled={readOnly}
                onClick={() => onEditPrice?.(item)}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
          </div>
        </div>
      </div>

      {/* Preço Total e Ação de Remover */}
      <div className="flex flex-col items-end justify-between py-0.5 min-w-[100px]">
        <div className="text-right">
          <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground mb-0.5">Total</p>
          <p className="text-lg font-black tabular-nums text-primary leading-none">
            {formatCurrency(itemTotal)}
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5 px-2 -mr-2"
          disabled={readOnly}
          onClick={() => onRemove(uiKey)}
        >
          <XCircle className="h-4 w-4" />
          Remover
        </Button>
      </div>
    </li>
  );
});

export function PDVCart({
  items,
  onQuantityChange,
  onRemove,
  activeKey,
  onActivate,
  readOnly,
  onEditPrice,
  onEditDiscount,
  onEditAddition,
  onEditNotes,
}: Props) {
  const totalItemsCount = items.reduce((acc, it) => acc + (it.quantity || 0), 0);

  return (
    <div className="flex flex-col rounded-xl border bg-card shadow-md overflow-hidden h-full">
      <div className="flex items-center justify-between border-b bg-muted/20 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <ShoppingCart className="h-4 w-4 text-primary" />
            {totalItemsCount > 0 && (
              <span className="absolute -top-2 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {totalItemsCount}
              </span>
            )}
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-foreground">
            Carrinho
          </p>
        </div>
        
        <Badge variant="secondary" className="font-mono text-[10px] px-2 py-0">
          {items.length} {items.length === 1 ? 'ITEM' : 'ITENS'}
        </Badge>
      </div>

      <div className="flex-1 overflow-hidden">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50 border-2 border-dashed border-muted-foreground/20">
              <Package className="h-8 w-8 text-muted-foreground/30" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Carrinho vazio</p>
              <p className="mt-1 text-xs text-muted-foreground max-w-[200px] leading-relaxed">
                Passe o código de barras ou pesquise para iniciar a venda.
              </p>
            </div>
          </div>
        ) : (
          <ul className={`${PDV_LAYOUT.cartScroll} p-3`}>
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
                  onEditPrice={onEditPrice}
                  onEditDiscount={onEditDiscount}
                  onEditAddition={onEditAddition}
                  onEditNotes={onEditNotes}
                />
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
