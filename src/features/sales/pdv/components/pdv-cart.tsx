import { memo, useCallback } from "react";
import { ImageIcon, Minus, Package, Plus, ShoppingCart, XCircle, Tag, MessageSquare, MoreVertical, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
        "flex items-center gap-3 py-1.5 px-3 transition-all duration-200 rounded-md border border-transparent mb-1",
        "bg-muted/30 hover:bg-muted/50",
        "data-[active]:bg-card data-[active]:border-primary/30 data-[active]:shadow-sm data-[active]:ring-1 data-[active]:ring-primary/20"
      )}
    >
      {/* Imagem do Produto (Compacta) */}
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded border bg-background shadow-sm">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.description}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/20">
            <ImageIcon className="h-4 w-4 text-muted-foreground/30" />
          </div>
        )}
        {lowStock && (
          <div className="absolute inset-x-0 bottom-0 bg-destructive/90 py-0.5 text-center text-[7px] font-bold uppercase text-white leading-none">
            !
          </div>
        )}
      </div>

      {/* Nome, Quantidade e Preço (Linha 1 + Metadados Linha 2) */}
      <div className="flex flex-col flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-medium leading-tight truncate flex-1" title={item.description}>
            {baseName} {variation && <span className="text-muted-foreground font-normal">({variation})</span>}
          </h4>
          
          {/* Seletor de Quantidade Compacto */}
          <div className="flex items-center rounded border bg-background h-6 overflow-hidden shrink-0">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-full w-5 rounded-none hover:bg-muted"
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
              className="h-full w-7 border-0 px-0 text-center text-[10px] font-bold tabular-nums shadow-none focus-visible:ring-0 bg-transparent"
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-full w-5 rounded-none hover:bg-muted"
              disabled={readOnly}
              onClick={() => onQuantityChange(uiKey, item.quantity + 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          <button
            type="button"
            disabled={readOnly}
            onClick={() => onEditPrice?.(item)}
            className={cn(
              "text-sm font-bold tabular-nums shrink-0 rounded px-1 -mx-1",
              "text-gray-100 hover:bg-primary/10 hover:text-primary disabled:pointer-events-none",
              (hasDiscount || hasAddition) && "text-primary",
            )}
            title="Editar preço do item"
          >
            {formatCurrency(itemTotal)}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={readOnly}
                className="h-6 w-6 shrink-0 text-slate-500 hover:text-gray-100"
                title="Mais ações do item"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditPrice?.(item)}>
                <DollarSign className="h-3.5 w-3.5 mr-2" /> Editar preço
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEditDiscount?.(item)}>
                <Tag className="h-3.5 w-3.5 mr-2" /> Desconto do item
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEditAddition?.(item)}>
                <Plus className="h-3.5 w-3.5 mr-2" /> Acréscimo do item
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEditNotes?.(item)}>
                <MessageSquare className="h-3.5 w-3.5 mr-2" /> Observações
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5">
          <span className="truncate">{item.sku ?? "---"}</span>
          <span className="text-slate-500/30">•</span>
          <span>Un: {formatCurrency(item.unit_price)}</span>
          {stock != null && (
            <>
              <span className="text-slate-500/30">•</span>
              <span className={cn(lowStock ? "text-destructive font-bold" : "")}>
                Est: {stock}
              </span>
            </>
          )}
          {hasNotes && (
            <button
              type="button"
              onClick={() => onEditNotes?.(item)}
              className="ml-auto flex items-center hover:opacity-70"
              title="Ver observações"
            >
              <MessageSquare className="h-2.5 w-2.5 text-primary" />
            </button>
          )}
        </div>
      </div>

      {/* Ação de Remover (Apenas Ícone) */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
        disabled={readOnly}
        onClick={() => onRemove(uiKey)}
      >
        <XCircle className="h-4 w-4" />
      </Button>
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
    <div className="flex flex-col rounded-xl border border-slate-700/50 bg-slate-900 shadow-md overflow-hidden h-full">
      <div className="flex items-center justify-between border-b border-slate-700/50 bg-slate-800/30 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="relative">
            <ShoppingCart className="h-4 w-4 text-primary" />
            {totalItemsCount > 0 && (
              <span className="absolute -top-2 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground">
                {totalItemsCount}
              </span>
            )}
          </div>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-100">
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
              <p className="text-sm font-bold text-gray-100">Carrinho vazio</p>
              <p className="mt-1 text-xs text-slate-500 max-w-[200px] leading-relaxed">
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
