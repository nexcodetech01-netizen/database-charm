import { useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { BRLCurrencyInput } from "@/components/ui/brl-currency-input";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { Calculator, Info, AlertCircle, Plus, ShoppingBag, TrendingUp, ChevronDown, ChevronUp, History } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { RequiredLabel } from "@/components/ui/required-label";
import { computeOfficialPricing } from "@/features/pricing/official/official-pricing";
import { SuggestedPricesByChannelCard } from "@/features/pricing/components/suggested-prices-by-channel-card";

interface PricingFormProps {
  form: any;
  setForm: (val: any) => void;
  categoryName: string | null;
  categoryMargin: number | null;
  onApplyCategoryMargin: () => void;
  errors?: Record<string, string>;
  onOpenQuickCategory?: () => void;
  onFetchLastPurchase?: () => void;
}

export function PricingForm({ 
  form, 
  setForm, 
  categoryName, 
  categoryMargin,
  onApplyCategoryMargin,
  errors = {},
  onOpenQuickCategory,
  onFetchLastPurchase
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
  
  // LÓGICA RÍGIDA: Custo Total Efetivo é a soma de todos os componentes
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
  const recalculatePrice = useCallback((newMargin: number, newFeePct: number, newFixedFee: number) => {
    // LÓGICA RÍGIDA: O preço final DEVE ser calculado usando o total_cost real
    // Fórmula de Margem sobre Venda: Preço Final = Custo Total Efetivo / (1 - (Margem / 100))
    const m = newMargin / 100;
    
    // Evitar divisão por zero ou margens 100%+
    if (m >= 1) {
      setForm((s: any) => ({ ...s, margin: String(newMargin) }));
      return;
    }

    const calculatedPrice = totalCost / (1 - m);
    
    if (calculatedPrice > 0 && calculatedPrice !== Infinity) {
      setForm((s: any) => ({ 
        ...s, 
        price: calculatedPrice.toFixed(2),
        margin: String(newMargin),
        channel_fee_pct: String(newFeePct),
        channel_fixed_fee: String(newFixedFee)
      }));
    } else {
      setForm((s: any) => ({ 
        ...s, 
        margin: String(newMargin),
        channel_fee_pct: String(newFeePct),
        channel_fixed_fee: String(newFixedFee)
      }));
    }
  }, [totalCost, setForm]);

  // Efeito para garantir que a margem da categoria seja aplicada se o switch estiver ativo
  useEffect(() => {
    if (form.use_category_margin && categoryMargin !== null) {
      recalculatePrice(categoryMargin, channelFeePct, channelFixedFee);
    }
  }, [form.use_category_margin, categoryMargin, totalCost, channelFeePct, channelFixedFee, recalculatePrice]);

  return (
    <div className="space-y-8">
      {/* SEÇÃO 1: Precificação Base */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Coluna de Custos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-slate-800 flex items-center justify-center border border-slate-700">
                <Calculator className="h-4 w-4 text-slate-300" />
              </div>
              <h4 className="text-sm font-bold text-slate-300 uppercase tracking-tight">Custos</h4>
            </div>
            {form.supplier_id && onFetchLastPurchase && (
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="h-7 px-2 text-[10px] font-bold uppercase text-slate-400 hover:text-white gap-1.5"
                onClick={onFetchLastPurchase}
              >
                <History className="h-3 w-3" />
                Sincronizar última compra
              </Button>
            )}
          </div>
          <div className="space-y-3 p-5 rounded-xl border border-slate-800 bg-slate-900/50 shadow-sm">
            <div className="space-y-2">
              <RequiredLabel htmlFor="cost" required className="text-xs font-bold text-slate-300">Custo Unitário do Produto</RequiredLabel>
              <BRLCurrencyInput
                id="cost"
                className="text-lg font-bold h-12 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                value={cost}
                onValueChange={(val: number) => {
                  if (form.product_type === 'kit') return;
                  setForm((s: any) => ({ ...s, cost: val }));
                  if (desiredMargin > 0) {
                    recalculatePrice(desiredMargin, channelFeePct, channelFixedFee);
                  }
                }}
                disabled={form.product_type === 'kit'}
              />
              {form.product_type === 'kit' && (
                <p className="text-[10px] text-blue-400 font-bold mt-1">
                  Custo automático pela composição do kit.
                </p>
              )}
            </div>

            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="operational-costs" className="border-none">
                <AccordionTrigger className="py-2 text-[10px] font-bold uppercase text-slate-400 hover:text-slate-200 hover:no-underline flex gap-2">
                  Ver detalhes dos custos operacionais
                </AccordionTrigger>
                <AccordionContent className="pt-2 space-y-3 pb-0">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="freight" className="text-[10px] uppercase font-bold text-slate-400">Frete</Label>
                      <BRLCurrencyInput
                        id="freight"
                        className="h-9 text-xs bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                        value={freight}
                        onValueChange={(val: number) => {
                          setForm((s: any) => ({ ...s, freight: val }));
                          if (desiredMargin > 0) recalculatePrice(desiredMargin, channelFeePct, channelFixedFee);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="packaging" className="text-[10px] uppercase font-bold text-slate-400">Embalagem</Label>
                      <BRLCurrencyInput
                        id="packaging"
                        className="h-9 text-xs bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                        value={packaging}
                        onValueChange={(val: number) => {
                          setForm((s: any) => ({ ...s, packaging: val }));
                          if (desiredMargin > 0) recalculatePrice(desiredMargin, channelFeePct, channelFixedFee);
                        }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pb-2">
                    <div className="space-y-2">
                      <Label htmlFor="insurance" className="text-[10px] uppercase font-bold text-slate-400">Seguro</Label>
                      <BRLCurrencyInput
                        id="insurance"
                        className="h-9 text-xs bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                        value={insurance}
                        onValueChange={(val: number) => {
                          setForm((s: any) => ({ ...s, insurance: val }));
                          if (desiredMargin > 0) recalculatePrice(desiredMargin, channelFeePct, channelFixedFee);
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="other_costs" className="text-[10px] uppercase font-bold text-slate-400">Outros Custos</Label>
                      <BRLCurrencyInput
                        id="other_costs"
                        className="h-9 text-xs bg-slate-950 border-slate-700 text-white placeholder:text-slate-500"
                        value={other}
                        onValueChange={(val: number) => {
                          setForm((s: any) => ({ ...s, other_costs: val }));
                          if (desiredMargin > 0) recalculatePrice(desiredMargin, channelFeePct, channelFixedFee);
                        }}
                      />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
              <span className="text-[10px] font-bold uppercase text-slate-400 tracking-tight">Custo Total Efetivo</span>
              <span className="text-base font-black text-white">{formatCurrency(totalCost)}</span>
            </div>
          </div>
        </div>

        {/* Coluna de Preço da Loja/Base */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-blue-900/40 flex items-center justify-center border border-blue-800/50">
              <TrendingUp className="h-4 w-4 text-blue-400" />
            </div>
            <h4 className="text-sm font-bold text-slate-300 uppercase tracking-tight">Preço da Loja / Base</h4>
          </div>
          <div className={cn(
            "space-y-4 p-5 rounded-xl border border-slate-800 transition-all shadow-sm bg-slate-900/50"
          )}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <RequiredLabel htmlFor="price" required className="text-xs font-bold text-slate-300">Preço de Venda Final</RequiredLabel>
                <Badge className={cn("text-[9px] font-black uppercase py-0.5 px-2 tracking-tighter shadow-none border-none", status.color)}>
                  {status.label}: {margin.toFixed(2)}%
                </Badge>
              </div>
              <BRLCurrencyInput
                id="price"
                className={cn("text-lg font-black h-12 bg-slate-950 text-white placeholder:text-slate-500", errors.price ? "border-destructive ring-destructive" : "border-slate-700")}
                value={price}
                disabled={form.use_category_margin && !!categoryName}
                onValueChange={(val: number) => {
                  setForm((s: any) => {
                    const practicedPrice = val;
                    // LÓGICA RÍGIDA: Margem sobre venda calculada sobre o Custo Total Efetivo
                    // Margem = ((Preço - Custo Total) / Preço) * 100
                    const practicedMargin = practicedPrice > 0 ? ((practicedPrice - totalCost) / practicedPrice) * 100 : 0;
                    
                    return { 
                      ...s, 
                      price: val,
                      margin: practicedMargin.toFixed(2),
                      use_category_margin: s.use_category_margin ? false : s.use_category_margin
                    };
                  });
                }}
              />
              {errors.price && <p className="text-xs text-destructive font-medium">{errors.price}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="margin" className="text-[10px] font-bold uppercase text-slate-400">Margem Desejada (%)</Label>
                <div className="relative group">
                  <Input
                    id="margin"
                    type="number"
                    step="0.01"
                    className="h-10 text-sm font-bold bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 pr-8 disabled:opacity-70 disabled:cursor-not-allowed"
                    value={desiredMargin}
                    disabled={form.use_category_margin && categoryMargin !== null}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const m = num(e.target.value);
                      recalculatePrice(m, channelFeePct, channelFixedFee);
                    }}
                  />
                  <div className="absolute right-3 top-2.5 text-[10px] font-black text-slate-400">%</div>
                </div>
              </div>

              <div className="space-y-2 flex flex-col justify-end">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">Lucro Bruto</span>
                <div className={cn(
                  "h-10 rounded-md border flex items-center px-3 font-black text-sm shadow-sm",
                  grossProfit < 0 ? "bg-red-950/40 border-red-800 text-red-400" : "bg-emerald-950/40 border-emerald-800/50 text-emerald-400"
                )}>
                  {formatCurrency(grossProfit)}
                </div>
              </div>
            </div>

            {categoryName && (
              <div className="flex items-center justify-between pt-3 border-t border-slate-800">
                <div className="space-y-0.5">
                  <Label className="text-[10px] font-bold uppercase text-slate-400 cursor-pointer" htmlFor="use-category-margin">Usar margem da categoria</Label>
                  <p className="text-[9px] text-slate-500 font-medium">Aplicar política de {categoryName} ({categoryMargin ?? 0}%)</p>
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
            )}
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: Canais de Venda / Sugestões */}
      <div className="pt-4 border-t border-slate-800">
        <SuggestedPricesByChannelCard
          mode="local"
          costTotalCents={Math.round(totalCost * 100)}
          targetMarginPct={desiredMargin}
          currentStorePriceCents={Math.round(price * 100)}
          onApplySuggested={(recommendedPrice: number) => {
            setForm((s: any) => ({
              ...s,
              price: recommendedPrice.toFixed(2),
              // Ao aplicar o sugerido, recalculamos a margem baseada no preço aplicado
              margin: (((recommendedPrice - totalCost) / recommendedPrice) * 100).toFixed(2),
              use_category_margin: false
            }));
            toast.success(`Preço de ${formatCurrency(recommendedPrice)} aplicado com sucesso!`);
          }}
        />
      </div>
    </div>
  );
}
