import { Label } from "@/components/ui/label";
import { BRLCurrencyInput } from "@/components/ui/brl-currency-input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { Calculator, Info, AlertCircle, Plus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RequiredLabel } from "@/components/ui/required-label";

interface PricingFormProps {
  form: any;
  setForm: (val: any) => void;
  categoryName: string | null;
  onApplyCategoryMargin: () => void;
  errors?: Record<string, string>;
  onOpenQuickCategory?: () => void;
}

export function PricingForm({ 
  form, 
  setForm, 
  categoryName, 
  onApplyCategoryMargin,
  errors = {},
  onOpenQuickCategory
}: PricingFormProps) {
  const num = (v: any) => {
    if (typeof v === "number") return v;
    const normalized = String(v ?? "").replace(",", ".").replace(/[^\d.-]/g, "");
    const parsed = parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const cost = num(form.cost);
  const freight = num(form.freight);
  const packaging = num(form.packaging);
  const insurance = num(form.insurance);
  const other = num(form.other_costs);
  
  const totalCost = cost + freight + packaging + insurance + other;
  const price = num(form.price);
  const desiredMargin = num(form.margin);
  
  const margin = price > 0 ? ((price - totalCost) / price) * 100 : 0;
  const grossProfit = price - totalCost;

  const getMarginStatus = () => {
    if (margin < 0) return { label: "Prejuízo", color: "bg-red-500 hover:bg-red-600 text-white border-none" };
    if (margin <= 20) return { label: "Margem Baixa", color: "bg-amber-500 hover:bg-amber-600 text-white border-none" };
    return { label: "Lucrativo", color: "bg-emerald-500 hover:bg-emerald-600 text-white border-none" };
  };

  const status = getMarginStatus();

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Coluna de Custos */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            Composição de Custos
          </h4>
          <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
            <div className="space-y-2">
              <Label htmlFor="cost">Custo Unitário (Produto)</Label>
              <BRLCurrencyInput
                id="cost"
                value={cost}
                onValueChange={(val: number) => setForm((s: any) => ({ ...s, cost: val }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="freight">Frete</Label>
                <BRLCurrencyInput
                  id="freight"
                  value={freight}
                  onValueChange={(val: number) => setForm((s: any) => ({ ...s, freight: val }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="packaging">Embalagem</Label>
                <BRLCurrencyInput
                  id="packaging"
                  value={packaging}
                  onValueChange={(val: number) => setForm((s: any) => ({ ...s, packaging: val }))}
                />
              </div>
            </div>
            <div className="pt-2 border-t flex justify-between items-center">
              <span className="text-xs font-medium uppercase text-muted-foreground">Custo Total Efetivo</span>
              <span className="text-sm font-bold">{formatCurrency(totalCost)}</span>
            </div>
          </div>
        </div>

        {/* Coluna de Preço e Margem */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            Venda e Margem
          </h4>
          <div className={cn(
            "space-y-4 p-4 rounded-lg border transition-colors",
            margin < 0 ? "bg-red-500/5 border-red-500/20" : 
            margin <= 20 ? "bg-amber-500/5 border-amber-500/20" : 
            "bg-emerald-500/5 border-emerald-500/20"
          )}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <RequiredLabel htmlFor="price" required>Preço de Venda Final</RequiredLabel>
                <Badge className={cn("text-[10px] font-bold uppercase py-0 px-2", status.color)}>
                  {status.label}: {margin.toFixed(2)}%
                </Badge>
              </div>
              <BRLCurrencyInput
                id="price"
                className={cn("text-lg font-bold", errors.price ? "border-destructive ring-destructive" : "")}
                value={price}
                disabled={form.use_category_margin && !!categoryName}
                onValueChange={(val: number) => {
                  setForm((s: any) => {
                    const next = { ...s, price: val };
                    // Recalcula a margem ao mudar o preço
                    if (val > 0) {
                      next.margin = (((val - totalCost) / val) * 100).toFixed(2);
                    }
                    if (s.use_category_margin) {
                      next.use_category_margin = false;
                    }
                    return next;
                  });
                }}
              />
              {errors.price && <p className="text-xs text-destructive font-medium">{errors.price}</p>}
              <p className="text-[10px] text-muted-foreground font-medium">
                Lucro Bruto: <span className={grossProfit < 0 ? "text-red-500" : "text-emerald-600"}>
                  {formatCurrency(grossProfit)}
                </span> por unidade
              </p>
            </div>

            <div className="space-y-2 pt-2 border-t border-dashed">
              <Label htmlFor="margin" className="text-xs">Margem Desejada (%)</Label>
              <div className="flex gap-2">
                <Input
                  id="margin"
                  type="number"
                  step="0.01"
                  className="h-8 text-xs font-medium"
                  value={desiredMargin}
                  onChange={(e) => {
                    const m = num(e.target.value);
                    setForm((s: any) => {
                      const next = { ...s, margin: m };
                      // Se tem custo, calcula preço
                      if (totalCost > 0) {
                        // Preço = Custo / (1 - Margem/100)
                        const p = totalCost / (1 - m / 100);
                        if (p > 0 && p !== Infinity) {
                          next.price = p.toFixed(2);
                        }
                      }
                      return next;
                    });
                  }}
                />
                <div className="flex items-center justify-center bg-muted rounded px-2 h-8 text-[10px] font-bold text-muted-foreground">
                  %
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between space-x-2 pt-2 border-t border-dashed">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Label className="text-xs cursor-pointer" htmlFor="use-category-margin">Usar margem da categoria</Label>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-4 w-4 text-primary" 
                    type="button"
                    onClick={onOpenQuickCategory}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  {categoryName ? (
                    `Aplicar política de ${categoryName}`
                  ) : (
                    <span className="text-amber-600 flex items-center gap-1 font-medium">
                      <AlertCircle className="h-3 w-3" /> Selecione uma categoria na aba Geral
                    </span>
                  )}
                </p>
              </div>
              <Switch
                id="use-category-margin"
                checked={form.use_category_margin}
                onCheckedChange={(val: boolean) => {
                  if (val && !categoryName) {
                    toast.error("Selecione uma categoria na aba Geral para usar a margem automática.");
                    return;
                  }
                  setForm((s: any) => ({ ...s, use_category_margin: val }));
                  if (val && categoryName) onApplyCategoryMargin();
                }}
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="flex items-start gap-2 p-3 rounded-md bg-blue-500/5 border border-blue-500/10 text-[11px] text-blue-600 dark:text-blue-400">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <p>
          O preço de venda é sincronizado automaticamente com os canais de marketplace configurados. 
          Alterações manuais aqui sobrepõem as sugestões automáticas.
        </p>
      </div>
    </div>
  );
}
