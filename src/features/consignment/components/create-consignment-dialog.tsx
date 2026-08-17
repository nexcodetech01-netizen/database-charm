import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
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
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { ConsignmentService } from '@/features/consignment/services/consignment.service';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { ProductPickerDialog } from '@/features/catalog/components/product-picker-dialog';
import { Trash2, Plus, Package } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { supabase } from '@/integrations/supabase/client';
import { generateConsignmentPDF } from '../lib/pdf-generator';

const consignmentFormSchema = z.object({
  reseller_id: z.string().uuid('Selecione um revendedor'),
  sent_at: z.string().min(1, 'Selecione a data de envio'),
  notes: z.string().optional(),
});

type ConsignmentFormValues = z.infer<typeof consignmentFormSchema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
}

interface SelectedItem {
  product_id: string;
  name: string;
  sku: string | null;
  sent_quantity: number;
  cost_price: number;
  suggested_price: number;
}

export function CreateConsignmentDialog({ open, onOpenChange, companyId }: Props) {
  const { loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [isProductPickerOpen, setIsProductPickerOpen] = React.useState(false);
  const [selectedItems, setSelectedItems] = React.useState<SelectedItem[]>([]);

  const { data: resellers = [] } = useQuery({
    queryKey: ['resellers', companyId],
    queryFn: () => ConsignmentService.listResellers(companyId),
    enabled: open,
  });

  const form = useForm<ConsignmentFormValues>({
    resolver: zodResolver(consignmentFormSchema),
    defaultValues: {
      sent_at: new Date().toISOString().split('T')[0],
      notes: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: ConsignmentFormValues) => {
      if (selectedItems.length === 0) throw new Error('Selecione ao menos um produto');
      if (!companyId) throw new Error('Empresa não identificada. Tente recarregar a página.');
      
      return ConsignmentService.createConsignment(
        {
          company_id: companyId,
          reseller_id: values.reseller_id,
          sent_at: values.sent_at,
          notes: values.notes,
        },
        selectedItems.map(it => ({
          product_id: it.product_id,
          sent_quantity: it.sent_quantity,
          cost_price: it.cost_price,
          suggested_price: it.suggested_price
        }))
      );
    },
    onSuccess: async (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['consignments'] });
      toast.success('Consignação criada com sucesso!');
      
      try {
        const { consignment, items } = await ConsignmentService.getConsignment(data.id);
        const blob = await generateConsignmentPDF(consignment, items, "Empresa NexOS");
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `contrato-consignacao-${data.id.split('-')[0]}.pdf`;
        link.click();
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Erro ao gerar PDF automático:", err);
      }

      onOpenChange(false);
      form.reset();
      setSelectedItems([]);
    },
    onError: (error: any) => {
      toast.error('Erro ao criar consignação: ' + error.message);
    },
  });

  const handleAddProducts = async (ids: string[]) => {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, sku, cost, price')
      .in('id', ids);

    if (error) {
      toast.error('Erro ao buscar detalhes dos produtos');
      return;
    }

    const newItems: SelectedItem[] = (products || []).map(p => ({
      product_id: p.id,
      name: p.name,
      sku: p.sku,
      sent_quantity: 1,
      cost_price: Number(p.cost || 0),
      suggested_price: Number(p.price || 0)
    }));

    setSelectedItems(prev => {
      const existingIds = new Set(prev.map(i => i.product_id));
      const filteredNew = newItems.filter(i => !existingIds.has(i.product_id));
      return [...prev, ...filteredNew];
    });
  };

  const removeItem = (id: string) => {
    setSelectedItems(prev => prev.filter(i => i.product_id !== id));
  };

  const updateItemQty = (id: string, qty: number) => {
    setSelectedItems(prev => prev.map(i => 
      i.product_id === id ? { ...i, sent_quantity: Math.max(1, qty) } : i
    ));
  };

  const totalValue = selectedItems.reduce((acc, it) => acc + (it.sent_quantity * it.suggested_price), 0);

  if (authLoading || !open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Nova Consignação</DialogTitle>
            <DialogDescription className="text-slate-400">
              Preencha os dados e selecione os produtos para entrega.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(v => createMutation.mutate(v))} className="space-y-6 py-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="reseller_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300">Revendedor</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-slate-900 border-slate-800">
                            <SelectValue placeholder="Selecione um revendedor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-slate-900 border-slate-800">
                          {resellers.map(r => (
                            <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sent_at"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-slate-300">Data de Envio</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="bg-slate-900 border-slate-800" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Produtos Consignados</h3>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    className="border-slate-800 hover:bg-slate-800 text-slate-300"
                    onClick={() => setIsProductPickerOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Itens
                  </Button>
                </div>

                <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
                  {selectedItems.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 italic">
                      Nenhum produto selecionado.
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/50">
                          <th className="px-4 py-2 text-left font-medium text-slate-400">Produto</th>
                          <th className="px-4 py-2 text-center font-medium text-slate-400 w-24">Qtd</th>
                          <th className="px-4 py-2 text-right font-medium text-slate-400">Preço Sug.</th>
                          <th className="px-4 py-2 text-right font-medium text-slate-400">Total</th>
                          <th className="px-4 py-2 text-right font-medium text-slate-400 w-12"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedItems.map((it) => (
                          <tr key={it.product_id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <Package className="h-4 w-4 text-slate-500 shrink-0" />
                                <div>
                                  <div className="font-medium text-white">{it.name}</div>
                                  <div className="text-xs text-slate-500">{it.sku || 'Sem SKU'}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Input 
                                type="number" 
                                value={it.sent_quantity} 
                                onChange={(e) => updateItemQty(it.product_id, parseInt(e.target.value))}
                                className="h-8 w-20 mx-auto bg-slate-900 border-slate-800 text-center"
                              />
                            </td>
                            <td className="px-4 py-3 text-right text-slate-300">
                              {formatCurrency(it.suggested_price)}
                            </td>
                            <td className="px-4 py-3 text-right text-white font-medium">
                              {formatCurrency(it.sent_quantity * it.suggested_price)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <Button 
                                type="button" 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-500 hover:text-destructive"
                                onClick={() => removeItem(it.product_id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-900/50">
                          <td colSpan={3} className="px-4 py-3 text-right font-bold text-slate-400 uppercase tracking-wider text-xs">Valor Total Consignado</td>
                          <td className="px-4 py-3 text-right font-bold text-blue-400 text-lg">
                            {formatCurrency(totalValue)}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  )}
                </div>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">Observações</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Informações adicionais da consignação..." 
                        {...field} 
                        className="bg-slate-900 border-slate-800 min-h-[80px]"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400">
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || selectedItems.length === 0} className="bg-blue-600 hover:bg-blue-700">
                  {createMutation.isPending ? 'Criando...' : 'Criar Consignação'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ProductPickerDialog 
        open={isProductPickerOpen}
        onOpenChange={setIsProductPickerOpen}
        companyId={companyId}
        excludeProductIds={new Set(selectedItems.map(i => i.product_id))}
        onConfirm={handleAddProducts}
      />
    </>
  );
}
