import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/format";
import { Calculator, Info } from "lucide-react";

interface PricingFormProps {
  form: any;
  setForm: (val: any) => void;
  categoryName: string | null;
  onApplyCategoryMargin: () => void;
}

export function PricingForm({ form, setForm, categoryName, onApplyCategoryMargin }: PricingFormProps) {
  const num = (v: any) => {
    if (typeof v === "number") return v;
    return parseFloat(String(v).replace(/[^\d.-]/g, "")) || 0;
  };

  const cost = num(form.cost);
  const freight = num(form.freight);
  const packaging = num(form.packaging);
  const insurance = num(form.insurance);
  const other = num(form.other_costs);
  const totalCost = cost + freight + packaging + insurance + other;
  const price = num(form.price);
  const margin = price > 0 ? ((price - totalCost) / price) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            Composição de Custos
          </h4>
          <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
            <div className="space-y-2">
              <Label htmlFor="cost">Custo Unitário (Produto)</Label>
              <Input
                id="cost"
                value={form.cost}
                onChange={(e) => setForm((s: any) => ({ ...s, cost: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="freight">Frete</Label>
                <Input
                  id="freight"
                  value={form.freight}
                  onChange={(e) => setForm((s: any) => ({ ...s, freight: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="packaging">Embalagem</Label>
                <Input
                  id="packaging"
                  value={form.packaging}
                  onChange={(e) => setForm((s: any) => ({ ...s, packaging: e.target.value }))}
                />
              </div>
            </div>
            <div className="pt-2 border-t flex justify-between items-center">
              <span className="text-xs font-medium uppercase text-muted-foreground">Custo Total Efetivo</span>
              <span className="text-sm font-bold">{formatCurrency(totalCost)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Calculator className="h-4 w-4 text-muted-foreground" />
            Venda e Margem
          </h4>
          <div className="space-y-4 p-4 rounded-lg border bg-emerald-500/5 border-emerald-500/20">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="price">Preço de Venda Final</Label>
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase",
                  margin >= 20 ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                )}>
                  Margem: {margin.toFixed(2)}%
                </span>
              </div>
              <Input
                id="price"
                className="text-lg font-bold"
                value={form.price}
                onChange={(e) => setForm((s: any) => ({ ...s, price: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between space-x-2 pt-2">
              <div className="space-y-0.5">
                <Label className="text-xs">Usar margem da categoria</Label>
                <p className="text-[10px] text-muted-foreground">
                  {categoryName ? `Aplicar política de ${categoryName}` : "Selecione uma categoria"}
                </p>
              </div>
              <Switch
                checked={form.use_category_margin}
                onCheckedChange={(val) => {
                  setForm((s: any) => ({ ...s, use_category_margin: val }));
                  if (val) onApplyCategoryMargin();
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

const cn = (...classes: any[]) => classes.filter(Boolean).join(" ");
