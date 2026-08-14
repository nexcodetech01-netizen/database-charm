import { ShoppingCart, Minus, Plus, Trash2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { formatCurrency } from "@/lib/format";
import type { CatalogCartItem } from "../hooks/use-catalog-cart";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CatalogCartItem[];
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  totalValue: number;
  onSendWhatsApp: () => void;
  whatsappAvailable: boolean;
}

export function CatalogCartDrawer({
  open,
  onOpenChange,
  items,
  updateQuantity,
  removeItem,
  totalValue,
  onSendWhatsApp,
  whatsappAvailable,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" /> Seu pedido
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-3 py-4">
          {items.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">
              Nenhum produto adicionado ainda.
            </p>
          ) : (
            items.map((item) => (
              <div key={item.productId} className="flex items-center gap-3 rounded-lg border p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(item.price)} cada</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeItem(item.productId)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <SheetFooter className="flex-col gap-3 sm:flex-col">
            <div className="flex items-center justify-between text-sm font-semibold w-full">
              <span>Total</span>
              <span>{formatCurrency(totalValue)}</span>
            </div>
            <Button
              className="w-full gap-2"
              disabled={!whatsappAvailable}
              onClick={onSendWhatsApp}
            >
              <MessageCircle className="h-4 w-4" /> Finalizar pedido no WhatsApp
            </Button>
            {!whatsappAvailable && (
              <p className="text-xs text-center text-muted-foreground">
                WhatsApp não configurado para esta loja no momento.
              </p>
            )}
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
