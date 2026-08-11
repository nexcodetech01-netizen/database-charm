import { Label } from "@/components/ui/label";
import { BRLCurrencyInput } from "@/components/ui/brl-currency-input";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { Calculator, Info, AlertCircle, Plus, ShoppingBag, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
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
    <div className="space-y-8">
      {/* SEÇÃO 1: Precificação Base */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Coluna de Custos */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Calculator className="h-4 w-4 text-slate-600" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Custos</h4>
          </div>
          <div className="space-y-3 p-5 rounded-xl border bg-slate-50/50 shadow-sm">
            <div className="space-y-2">
              <RequiredLabel htmlFor="cost" required className="text-xs font-bold text-slate-700">Custo Unitário do Produto</RequiredLabel>
              <BRLCurrencyInput
                id="cost"
                className="text-lg font-bold h-12 bg-white"
                value={cost}
                onValueChange={(val: number) => {
                  setForm((s: any) => ({ ...s, cost: val }));
                  if (desiredMargin > 0) {
                    recalculatePrice(desiredMargin, channelFeePct, channelFixedFee);
                  }
                }}
              />
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="operational-costs" className="border-none">
                <AccordionTrigger className="py-2 text-[10px] font-bold uppercase text-slate-500 hover:no-underline flex gap-2">
                  Ver detalhes dos custos operacionais
                </AccordionTrigger>
                <AccordionContent className="pt-2 space-y-3 pb-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="freight" className="text-[10px] uppercase font-bold text-slate-400">Frete</Label>
                      <BRLCurrencyInput
                        id="freight"
                        className="h-9 text-xs bg-white"
                        value={freight}
                        onValueChange={(val: number) => setForm((s: any) => ({ ...s, freight: val }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="packaging" className="text-[10px] uppercase font-bold text-slate-400">Embalagem</Label>
                      <BRLCurrencyInput
                        id="packaging"
                        className="h-9 text-xs bg-white"
                        value={packaging}
                        onValueChange={(val: number) => setForm((s: any) => ({ ...s, packaging: val }))}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pb-2">
                    <div className="space-y-2">
                      <Label htmlFor="insurance" className="text-[10px] uppercase font-bold text-slate-400">Seguro</Label>
                      <BRLCurrencyInput
                        id="insurance"
                        className="h-9 text-xs bg-white"
                        value={insurance}
                        onValueChange={(val: number) => setForm((s: any) => ({ ...s, insurance: val }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="other_costs" className="text-[10px] uppercase font-bold text-slate-400">Outros Custos</Label>
                      <BRLCurrencyInput
                        id="other_costs"
                        className="h-9 text-xs bg-white"
                        value={other}
                        onValueChange={(val: number) => setForm((s: any) => ({ ...s, other_costs: val }))}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="pt-3 border-t border-slate-200 flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase text-slate-500 tracking-tight">Custo Total Efetivo</span>
              <span className="text-base font-black text-slate-900">{formatCurrency(totalCost)}</span>
            </div>
          </div>
        </div>

        {/* Coluna de Preço da Loja/Base */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-blue-600" />
            </div>
            <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Preço da Loja / Base</h4>
          </div>
          <div className={cn(
            "space-y-4 p-5 rounded-xl border transition-all shadow-sm",
            margin < 0 ? "bg-red-50 border-red-200" : 
            margin <= 20 ? "bg-amber-50 border-amber-200" : 
            "bg-blue-50/50 border-blue-200"
          )}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <RequiredLabel htmlFor="price" required className="text-xs font-bold text-slate-700">Preço de Venda Final</RequiredLabel>
                <Badge className={cn("text-[9px] font-black uppercase py-0.5 px-2 tracking-tighter shadow-none border-none", status.color)}>
                  {status.label}: {margin.toFixed(2)}%
                </Badge>
              </div>
              <BRLCurrencyInput
                id="price"
                className={cn("text-lg font-black h-12 bg-white shadow-inner", errors.price ? "border-destructive ring-destructive" : "border-slate-200")}
                value={price}
                disabled={form.use_category_margin && !!categoryName}
                onValueChange={(val: number) => {
                  setForm((s: any) => {
                    const next = { ...s, price: val };
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="margin" className="text-[10px] font-bold uppercase text-slate-500">Margem Desejada (%)</Label>
                <div className="relative group">
                  <Input
                    id="margin"
                    type="number"
                    step="0.01"
                    className="h-10 text-sm font-bold bg-white pr-8"
                    value={desiredMargin}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const m = num(e.target.value);
                      recalculatePrice(m, channelFeePct, channelFixedFee);
                    }}
                  />
                  <div className="absolute right-3 top-2.5 text-[10px] font-black text-slate-400">%</div>
                </div>
              </div>

              <div className="space-y-2 flex flex-col justify-end">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-tight">Lucro Bruto</span>
                <div className={cn(
                  "h-10 rounded-md border flex items-center px-3 font-black text-sm shadow-sm",
                  grossProfit < 0 ? "bg-red-100 border-red-200 text-red-600" : "bg-emerald-100 border-emerald-200 text-emerald-600"
                )}>
                  {formatCurrency(grossProfit)}
                </div>
              </div>
            </div>

            {categoryName && (
              <div className="flex items-center justify-between pt-3 border-t border-slate-200/50">
                <div className="space-y-0.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-500 cursor-pointer" htmlFor="use-category-margin">Usar margem da categoria</Label>
                  <p className="text-[9px] text-slate-400 font-medium">Aplicar política de {categoryName}</p>
                </div>
                <Switch
                  id="use-category-margin"
                  checked={form.use_category_margin}
                  onCheckedChange={(val: boolean) => {
                    setForm((s: any) => ({ ...s, use_category_margin: val }));
                    if (val && categoryName) onApplyCategoryMargin();
                  }}
                />
              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
