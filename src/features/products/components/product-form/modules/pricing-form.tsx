import { Label } from "@/components/ui/label";
import { BRLCurrencyInput } from "@/components/ui/brl-currency-input";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { Calculator, Info, AlertCircle, Plus, ShoppingBag, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RequiredLabel } from "@/components/ui/required-label";
import { computeOfficialPricing } from "@/features/pricing/official/official-pricing";

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

  // Novos campos para taxas de canal
  const channelFeePct = num(form.channel_fee_pct || 0);
  const channelFixedFee = num(form.channel_fixed_fee || 0);
  const taxPct = num(form.tax_pct || 0);

  // Integração com o Motor Comercial V2 para auditoria e status
  const pricing = computeOfficialPricing({
    companyId: "current", // Mockado pois o motor precisa de um ID, mas o cálculo é puro
    productId: "temp",
    costs: {
      acquisition: cost,
      freight,
      packaging,
      insurance,
      otherCosts: other,
    },
    margins: {
      minPct: 0,
      targetPct: desiredMargin,
    },
    fee: {
      pct: channelFeePct,
      fixed: channelFixedFee,
    },
    taxPct: taxPct,
    rounding: { kind: "none" }
  });

  const margin = pricing.marginPct;
  const grossProfit = pricing.profit;

  const getMarginStatus = () => {
    if (margin < 0) return { label: "Prejuízo", color: "bg-red-500 hover:bg-red-600 text-white border-none" };
    if (margin <= 20) return { label: "Margem Baixa", color: "bg-amber-500 hover:bg-amber-600 text-white border-none" };
    return { label: "Lucrativo", color: "bg-emerald-500 hover:bg-emerald-600 text-white border-none" };
  };

  const status = getMarginStatus();

  // Função para recalcular o preço final baseado na margem desejada e taxas
  const recalculatePrice = (newMargin: number, newFeePct: number, newFixedFee: number) => {
    const p = computeOfficialPricing({
      companyId: "current",
      productId: "temp",
      costs: {
        acquisition: cost,
        freight,
        packaging,
        insurance,
        otherCosts: other,
      },
      margins: {
        minPct: 0,
        targetPct: newMargin,
      },
      fee: {
        pct: newFeePct,
        fixed: newFixedFee,
      },
      taxPct: taxPct,
      rounding: { kind: "none" }
    });

    if (p.targetPrice > 0 && p.targetPrice !== Infinity) {
      setForm((s: any) => ({ 
        ...s, 
        price: p.targetPrice.toFixed(2),
        margin: newMargin,
        channel_fee_pct: newFeePct,
        channel_fixed_fee: newFixedFee
      }));
    } else {
      setForm((s: any) => ({ 
        ...s, 
        margin: newMargin,
        channel_fee_pct: newFeePct,
        channel_fixed_fee: newFixedFee
      }));
    }
  };

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
                onValueChange={(val: number) => {
                  setForm((s: any) => ({ ...s, cost: val }));
                  // Recalcula o preço automaticamente ao mudar o custo se houver margem
                  if (desiredMargin > 0) {
                    recalculatePrice(desiredMargin, channelFeePct, channelFixedFee);
                  }
                }}
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
                    // Recalcula a margem ao mudar o preço, usando o motor para maior precisão
                    const evaluation = computeOfficialPricing({
                      companyId: "current",
                      productId: "temp",
                      costs: {
                        acquisition: num(next.cost),
                        freight: num(next.freight),
                        packaging: num(next.packaging),
                        insurance: num(next.insurance),
                        otherCosts: num(next.other_costs),
                      },
                      margins: { minPct: 0, targetPct: 0 },
                      behavior: { kind: "standard" },
                      rounding: { kind: "none" },
                      fee: { pct: channelFeePct, fixed: channelFixedFee },
                      taxPct: taxPct
                    });
                    
                    // Nota: O motor não tem evaluateOfficialPrice aqui mas podemos deduzir a margem 
                    // do lucro líquido projetado para este preço. 
                    // Como estamos mudando o preço manualmente, a margem é o subproduto.
                    const practicedPrice = val;
                    const channelDeduction = (practicedPrice * channelFeePct) / 100 + channelFixedFee;
                    const taxDeduction = (practicedPrice * taxPct) / 100;
                    const netRevenue = practicedPrice - channelDeduction - taxDeduction;
                    const practicedMargin = practicedPrice > 0 ? ((netRevenue - totalCost) / practicedPrice) * 100 : 0;
                    
                    next.margin = practicedMargin.toFixed(2);
                    
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
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const m = num(e.target.value);
                    recalculatePrice(m, channelFeePct, channelFixedFee);
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

      {/* Card Financeiro Consolidado */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <div className="bg-muted/30 px-4 py-2 border-b flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider">Resumo de Lucratividade (Marketplace)</span>
        </div>
        <div className="p-4 grid gap-4 md:grid-cols-4 items-center">
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase font-medium">[=] Preço de Venda</span>
            <p className="text-lg font-bold">{formatCurrency(pricing.targetPrice)}</p>
          </div>
          
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase font-medium">[-] Taxas Canal</span>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-red-500">
                {formatCurrency((pricing.targetPrice * channelFeePct) / 100 + channelFixedFee)}
              </p>
              <Badge variant="outline" className="text-[9px] font-normal py-0 px-1">
                {channelFeePct}% + {formatCurrency(channelFixedFee)}
              </Badge>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase font-medium">[-] Custos Totais</span>
            <p className="text-sm font-semibold text-muted-foreground">{formatCurrency(totalCost)}</p>
          </div>

          <div className="space-y-1 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
            <span className="text-[10px] text-emerald-600 uppercase font-bold">[=] Lucro Líquido</span>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-black text-emerald-600 leading-none">{formatCurrency(pricing.profit)}</p>
              <span className="text-xs font-bold text-emerald-600/70">{pricing.marginPct.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Configurações do Canal (Mercado Livre)
          </h4>
          <div className="grid grid-cols-2 gap-4 p-4 rounded-lg border bg-muted/30">
            <div className="space-y-2">
              <Label htmlFor="channel_fee_pct" className="text-xs">Comissão ML (%)</Label>
              <div className="relative">
                <Input
                  id="channel_fee_pct"
                  type="number"
                  className="h-9 pr-8"
                  value={channelFeePct}
                  onChange={(e) => recalculatePrice(desiredMargin, num(e.target.value), channelFixedFee)}
                />
                <span className="absolute right-3 top-2.5 text-xs text-muted-foreground">%</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="channel_fixed_fee" className="text-xs">Taxa Fixa (R$)</Label>
              <BRLCurrencyInput
                id="channel_fixed_fee"
                className="h-9"
                value={channelFixedFee}
                onValueChange={(val) => recalculatePrice(desiredMargin, channelFeePct, val)}
              />
            </div>
          </div>
        </div>
        
        <div className="flex items-start gap-2 p-3 rounded-md bg-blue-500/5 border border-blue-500/10 text-[11px] text-blue-600 dark:text-blue-400 self-center">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <p>
            O motor de cálculo considera a comissão do canal e as taxas fixas para garantir que sua margem líquida seja preservada sobre o valor final da venda.
          </p>
        </div>
      </div>
    </div>
  );
}
