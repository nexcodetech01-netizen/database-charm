import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { formatCurrency } from "@/lib/format";
import type { SaleItemDraft } from "../../types";

type PriceDialogProps = {
  item: SaleItemDraft | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (uiKey: string, price: number, reason?: string) => void;
};

export function PDVItemPriceDialog({ item, open, onOpenChange, onConfirm }: PriceDialogProps) {
  const [price, setPrice] = useState<number>(0);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (item) {
      setPrice(item.unit_price);
      setReason("");
    }
  }, [item, open]);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Alterar preço por item</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label className="text-muted-foreground">Preço de tabela</Label>
            <div className="text-lg font-semibold tabular-nums">
              {formatCurrency(item.original_unit_price ?? item.unit_price)}
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="new-price">Novo preço</Label>
            <Input
              id="new-price"
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="price-reason">Motivo (opcional)</Label>
            <Input
              id="price-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: Cobrir oferta, cliente VIP..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => {
            if (item.ui_key) onConfirm(item.ui_key, price, reason);
            onOpenChange(false);
          }}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DiscountDialogProps = {
  item: SaleItemDraft | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (uiKey: string, discount: number) => void;
  type: "discount" | "addition";
};

export function PDVItemDiscountDialog({ item, open, onOpenChange, onConfirm, type }: DiscountDialogProps) {
  const [mode, setMode] = useState<"value" | "percent">("value");
  const [inputValue, setInputValue] = useState<number>(0);

  useEffect(() => {
    if (item) {
      const current = type === "discount" ? (item.discount || 0) : (item.addition || 0);
      setInputValue(current);
      setMode("value");
    }
  }, [item, open, type]);

  if (!item) return null;

  const originalPrice = item.unit_price;
  const quantity = item.quantity || 0;
  const grossTotal = originalPrice * quantity;
  
  let calculatedValue = 0;
  if (mode === "value") {
    calculatedValue = inputValue;
  } else {
    calculatedValue = (grossTotal * inputValue) / 100;
  }

  const finalTotal = type === "discount" 
    ? Math.max(0, grossTotal - calculatedValue)
    : grossTotal + calculatedValue;

  const isDiscount = type === "discount";
  const title = isDiscount ? "Desconto por item" : "Acréscimo por item";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-6 py-4">
          <RadioGroup value={mode} onValueChange={(v: any) => setMode(v)} className="flex gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="value" id="mode-value" />
              <Label htmlFor="mode-value" className="cursor-pointer">Valor (R$)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="percent" id="mode-percent" />
              <Label htmlFor="mode-percent" className="cursor-pointer">Percentual (%)</Label>
            </div>
          </RadioGroup>

          <div className="grid gap-2">
            <Label htmlFor="discount-input">Valor do {isDiscount ? "desconto" : "acréscimo"}</Label>
            <Input
              id="discount-input"
              type="number"
              step={mode === "value" ? "0.01" : "0.1"}
              value={inputValue}
              onChange={(e) => setInputValue(Number(e.target.value))}
              autoFocus
            />
          </div>

          <div className="rounded-lg bg-muted/50 p-4 space-y-2 text-sm">
            <p className="font-semibold text-xs uppercase tracking-wider text-muted-foreground mb-3">Prévia</p>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Preço original (Total)</span>
              <span className="tabular-nums">{formatCurrency(grossTotal)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span className="text-muted-foreground">{isDiscount ? "Desconto" : "Acréscimo"}</span>
              <span className={isDiscount ? "text-destructive tabular-nums" : "text-blue-600 tabular-nums"}>
                {isDiscount ? "-" : "+"} {formatCurrency(calculatedValue)}
              </span>
            </div>
            <div className="border-t pt-2 mt-2 flex justify-between font-bold text-base">
              <span>Preço final</span>
              <span className="tabular-nums text-primary">{formatCurrency(finalTotal)}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => {
            if (item.ui_key) onConfirm(item.ui_key, calculatedValue);
            onOpenChange(false);
          }}>
            Aplicar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}