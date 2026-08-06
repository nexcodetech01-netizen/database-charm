import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, ShoppingBag } from "lucide-react";
import { getMercadoLivreSettings, updateMercadoLivreSettings } from "../lib/mercadolivre-settings.functions";
import { DEFAULT_ML_SETTINGS } from "../utils/ml-pricing";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MercadoLivrePricingSettingsDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const getSettingsFn = useServerFn(getMercadoLivreSettings);
  const updateSettingsFn = useServerFn(updateMercadoLivreSettings);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["mercadolivre-settings"],
    queryFn: () => getSettingsFn(),
    enabled: open,
  });

  const [form, setForm] = useState(DEFAULT_ML_SETTINGS);

  useEffect(() => {
    if (settings) {
      setForm(settings);
    }
  }, [settings]);

  const mutation = useMutation({
    mutationFn: (data: typeof form) => updateSettingsFn({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mercadolivre-settings"] });
      toast.success("Configurações de precificação salvas.");
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar configurações");
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            Precificação Mercado Livre
          </DialogTitle>
          <DialogDescription>
            Ajuste os parâmetros globais de taxas e frete para os cálculos do marketplace.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="threshold">Limite Frete Grátis (R$)</Label>
              <Input
                id="threshold"
                type="number"
                step="0.01"
                value={form.freeShippingThreshold}
                onChange={(e) => setForm({ ...form, freeShippingThreshold: Number(e.target.value) })}
              />
              <p className="text-[10px] text-muted-foreground">Valor a partir do qual o frete grátis é obrigatório.</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="shipping">Valor do Frete Grátis (R$)</Label>
              <Input
                id="shipping"
                type="number"
                step="0.01"
                value={form.freeShippingValue}
                onChange={(e) => setForm({ ...form, freeShippingValue: Number(e.target.value) })}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="fixedFee">Taxa Fixa (R$)</Label>
              <Input
                id="fixedFee"
                type="number"
                step="0.01"
                value={form.fixedFeeValue}
                onChange={(e) => setForm({ ...form, fixedFeeValue: Number(e.target.value) })}
              />
              <p className="text-[10px] text-muted-foreground">Aplicada apenas em anúncios Clássicos abaixo do limite.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="classicFee">Comissão Clássico (%)</Label>
                <Input
                  id="classicFee"
                  type="number"
                  step="0.1"
                  value={form.classicFeePercent * 100}
                  onChange={(e) => setForm({ ...form, classicFeePercent: Number(e.target.value) / 100 })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="premiumFee">Comissão Premium (%)</Label>
                <Input
                  id="premiumFee"
                  type="number"
                  step="0.1"
                  value={form.premiumFeePercent * 100}
                  onChange={(e) => setForm({ ...form, premiumFeePercent: Number(e.target.value) / 100 })}
                />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button 
            onClick={() => mutation.mutate(form)} 
            disabled={mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
