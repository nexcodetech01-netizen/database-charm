import { memo, useCallback } from "react";
import { Edit2, ImageIcon, Minus, Package, Plus, ShoppingCart, Trash2, Percent, PlusCircle, MessageSquare, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { PDV_LAYOUT } from "../lib/layout";
import { pdvQuantityInputId } from "../lib/focus";
import { computeItemTotal, type SaleItemDraft } from "../../types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
  onEditPrice,
  onEditDiscount,
  onEditAddition,
  onEditNotes,
}: RowProps) {
  const activate = useCallback(() => onActivate?.(uiKey), [onActivate, uiKey]);
  const stock = item.stock_available;
  const lowStock = stock != null && stock < item.quantity;
  
  const hasPriceChange = item.original_unit_price != null && item.unit_price !== item.original_unit_price;
  const hasDiscount = (item.discount || 0) > 0;
  const hasAddition = (item.addition || 0) > 0;
  const hasNotes = !!item.notes;

  return (
  return (
    <li
      data-active={active || undefined}
      onFocus={activate}
      onMouseDown={activate}
      onDoubleClick={() => onQuantityChange(uiKey, item.quantity)}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 px-3 py-2 transition-colors hover:bg-muted/40 data-[active]:bg-muted/50 data-[active]:ring-1 data-[active]:ring-inset data-[active]:ring-primary/30"
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

      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="line-clamp-2 text-sm font-semibold leading-tight cursor-help">
                    {item.description}
                  </p>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[300px]">
                  <p className="text-xs">{item.description}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            <div className="flex flex-wrap gap-1">
              {hasPriceChange && (
                <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase tracking-tighter bg-amber-500/10 text-amber-600 border-amber-500/20">
                  Preço
                </Badge>
              )}
              {hasDiscount && (
                <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase tracking-tighter bg-green-500/10 text-green-600 border-green-500/20">
                  Desc
                </Badge>
              )}
              {hasAddition && (
                <Badge variant="outline" className="h-4 px-1 text-[9px] uppercase tracking-tighter bg-blue-500/10 text-blue-600 border-blue-500/20">
                  Acrés
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] leading-tight text-muted-foreground">
            <span className="font-mono">{item.sku ?? "sem SKU"}</span>
            <span aria-hidden="true">·</span>
            <span className={cn(lowStock ? "font-medium text-destructive" : "")}>
              {stockLabel(stock)}
            </span>
            <span aria-hidden="true">·</span>
            <div className="flex items-center gap-1 tabular-nums">
              {hasPriceChange && (
                <span className="line-through text-muted-foreground/60">{formatCurrency(item.original_unit_price!)}</span>
              )}
              <span className={cn(hasPriceChange ? "font-bold text-amber-700" : "")}>
                {formatCurrency(item.unit_price)}
              </span>
            </div>
          </div>
        </div>

        {/* Linha de ações secundária */}
        <div className="flex items-center gap-1 mt-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1 text-muted-foreground hover:text-primary"
                disabled={readOnly}
              >
                <MoreHorizontal className="h-3 w-3" />
                Ações
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onEditPrice?.(item)} className="text-xs gap-2">
                <Edit2 className="h-3 w-3" /> Alterar Preço
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEditDiscount?.(item)} className="text-xs gap-2">
                <Percent className="h-3 w-3" /> Aplicar Desconto
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEditAddition?.(item)} className="text-xs gap-2">
                <PlusCircle className="h-3 w-3" /> Aplicar Acréscimo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEditNotes?.(item)} className="text-xs gap-2">
                <MessageSquare className="h-3 w-3" /> 
                {hasNotes ? "Editar Observações" : "Adicionar Observação"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {hasNotes && (
            <Badge variant="secondary" className="h-5 px-1.5 text-[10px] gap-1 bg-primary/5 text-primary border-primary/10">
              <MessageSquare className="h-2.5 w-2.5 fill-primary/10" />
              Obs
            </Badge>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 ml-2">
        <div className="flex items-center rounded-lg border bg-background overflow-hidden">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-none hover:bg-muted"
            disabled={readOnly}
            aria-label={`Diminuir quantidade de ${item.description}`}
            onClick={() => onQuantityChange(uiKey, item.quantity - 1)}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
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
            className="h-7 w-10 border-0 px-0 text-center text-sm font-semibold tabular-nums shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent"
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 rounded-none hover:bg-muted"
            disabled={readOnly}
            aria-label={`Aumentar quantidade de ${item.description}`}
            onClick={() => onQuantityChange(uiKey, item.quantity + 1)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="w-20 text-right">
          <p className="text-sm font-bold tabular-nums">
            {formatCurrency(computeItemTotal(item))}
          </p>
        </div>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          disabled={readOnly}
          aria-label={`Remover ${item.description}`}
          onClick={() => onRemove(uiKey)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
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
  );
}