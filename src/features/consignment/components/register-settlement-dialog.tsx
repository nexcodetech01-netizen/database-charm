import React from 'react';
import { useForm } from 'react-hook-form';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ConsignmentService } from '../services/consignment.service';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { Package, Info } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { ConsignmentItem } from '../types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consignmentId: string;
  items: ConsignmentItem[];
}

export function RegisterSettlementDialog({ open, onOpenChange, consignmentId, items }: Props) {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();

  // Inicializa o formulário com 0 para todos os itens
  const defaultValues = {
    items: items.reduce((acc, item) => {
      acc[item.id] = {
        sold: 0,
        returned: 0,
        extraviado: 0,
        notes: ''
      };
      return acc;
    }, {} as any)
  };

  const form = useForm({
    defaultValues
  });

  const watchValues = form.watch("items");

  const calculateTotals = () => {
    let grossAmount = 0;
    Object.keys(watchValues).forEach(itemId => {
      const item = items.find(i => i.id === itemId);
      if (item) {
        grossAmount += (watchValues[itemId].sold || 0) * item.cost_price;
      }
    });
    return { grossAmount };
  };

  const { grossAmount } = calculateTotals();

  const registerMutation = useMutation({
    mutationFn: async (values: any) => {
      if (!companyId) throw new Error('Empresa não identificada.');
      
      // Validação de saldo
      for (const item of items) {
        const val = values.items[item.id];
        const currentBalance = item.sent_quantity - (item.sold_quantity + item.returned_quantity + item.quantidade_extraviada);
        const totalMovement = (Number(val.sold) || 0) + (Number(val.returned) || 0) + (Number(val.extraviado) || 0);
        
        if (totalMovement > currentBalance) {
          throw new Error(`O produto ${item.product?.name} possui saldo de apenas ${currentBalance} unidades.`);
        }
      }

      const itemsSold: Record<string, number> = {};
      const itemsReturned: Record<string, number> = {};
      const itemsExtraviado: Record<string, number> = {};
      const extravioNotes: Record<string, string> = {};

      Object.keys(values.items).forEach(id => {
        itemsSold[id] = Number(values.items[id].sold) || 0;
        itemsReturned[id] = Number(values.items[id].returned) || 0;
        itemsExtraviado[id] = Number(values.items[id].extraviado) || 0;
        extravioNotes[id] = values.items[id].notes || '';
      });

      return ConsignmentService.registerSettlement(consignmentId, companyId, {
        items_sold: itemsSold,
        items_returned: itemsReturned,
        items_extraviado: itemsExtraviado,
        extravio_notes: extravioNotes,
        gross_amount: grossAmount,
        reseller_commission: 0,
        net_receivable: grossAmount
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['consignment', consignmentId] });
      queryClient.invalidateQueries({ queryKey: ['consignment-settlements', consignmentId] });
      toast.success('Fechamento registrado com sucesso!');
      onOpenChange(false);
      form.reset(defaultValues);
    },
    onError: (error: any) => {
      toast.error('Erro ao registrar fechamento: ' + error.message);
    },
  });

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] overflow-y-auto bg-slate-950 border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">Registrar Fechamento</DialogTitle>
          <DialogDescription className="text-slate-400">
            Informe as quantidades movimentadas desde o último acerto. O sistema calculará automaticamente o valor devido com base no preço de custo.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(v => registerMutation.mutate(v))} className="space-y-6 py-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/50">
                    <th className="px-4 py-3 text-left font-medium text-slate-400">Produto</th>
                    <th className="px-4 py-3 text-center font-medium text-slate-400 w-24">Saldo Atual</th>
                    <th className="px-4 py-3 text-center font-medium text-emerald-500 w-24">Vendido</th>
                    <th className="px-4 py-3 text-center font-medium text-blue-500 w-24">Devolvido</th>
                    <th className="px-4 py-3 text-center font-medium text-red-500 w-24">Extraviado</th>
                    <th className="px-4 py-3 text-right font-medium text-slate-400">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const balance = item.sent_quantity - (item.sold_quantity + item.returned_quantity + item.quantidade_extraviada);
                    const subtotal = (Number(watchValues[item.id]?.sold) || 0) * item.cost_price;
                    
                    return (
                      <tr key={item.id} className="border-b border-slate-800/50 hover:bg-slate-800/10">
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-slate-500 shrink-0" />
                            <div>
                              <div className="font-medium text-white">{item.product?.name}</div>
                              <div className="text-xs text-slate-500">{item.product?.sku || 'Sem SKU'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-center font-bold text-white">
                          {balance}
                        </td>
                        <td className="px-2 py-4">
                          <FormField
                            control={form.control}
                            name={`items.${item.id}.sold`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    {...field}
                                    className="h-9 text-center bg-slate-900 border-emerald-500/30 focus:border-emerald-500"
                                    min={0}
                                    max={balance}
                                    onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="px-2 py-4">
                          <FormField
                            control={form.control}
                            name={`items.${item.id}.returned`}
                            render={({ field }) => (
                              <FormItem>
                                <FormControl>
                                  <Input 
                                    type="number" 
                                    {...field}
                                    className="h-9 text-center bg-slate-900 border-blue-500/30 focus:border-blue-500"
                                    min={0}
                                    max={balance}
                                    onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                                  />
                                </FormControl>
                              </FormItem>
                            )}
                          />
                        </td>
                        <td className="px-2 py-4">
                          <div className="space-y-1">
                            <FormField
                              control={form.control}
                              name={`items.${item.id}.extraviado`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input 
                                      type="number" 
                                      {...field}
                                      className="h-9 text-center bg-slate-900 border-red-500/30 focus:border-red-500"
                                      min={0}
                                      max={balance}
                                      onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            {Number(watchValues[item.id]?.extraviado) > 0 && (
                               <FormField
                                 control={form.control}
                                 name={`items.${item.id}.notes`}
                                 render={({ field }) => (
                                   <FormItem>
                                     <FormControl>
                                       <Input 
                                         {...field}
                                         placeholder="Motivo..."
                                         className="h-7 text-[10px] bg-slate-900 border-slate-800"
                                       />
                                     </FormControl>
                                   </FormItem>
                                 )}
                               />
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-4 text-right text-white font-medium">
                          {formatCurrency(subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900/80">
                    <td colSpan={5} className="px-4 py-4 text-right font-bold text-slate-400 uppercase tracking-wider text-xs">Total a Receber neste Acerto</td>
                    <td className="px-4 py-4 text-right font-bold text-emerald-400 text-lg">
                      {formatCurrency(grossAmount)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-4 flex gap-3">
              <Info className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm text-blue-200/70">
                Ao confirmar, o sistema atualizará o saldo de cada produto e criará um registro financeiro pendente para o revendedor. O acerto é baseado no <strong>preço de custo combinado</strong>.
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400">
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={registerMutation.isPending || grossAmount <= 0 && !Object.values(watchValues).some((v: any) => (v.returned > 0 || v.extraviado > 0))} 
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                {registerMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Confirmar Fechamento
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
