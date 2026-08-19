import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ConsignmentService } from '../services/consignment.service';
import { toast } from 'sonner';
import { Package, Trash2, Plus, AlertTriangle, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { ProductPickerDialog } from '@/features/catalog/components/product-picker-dialog';
import { supabase } from '@/integrations/supabase/client';
export function EditConsignmentItemsDialog({ open, onOpenChange, consignmentId, companyId, initialItems }) {
    const queryClient = useQueryClient();
    const [items, setItems] = React.useState([]);
    const [isProductPickerOpen, setIsProductPickerOpen] = React.useState(false);
    React.useEffect(() => {
        if (open) {
            setItems(initialItems.map(item => ({
                id: item.id,
                product_id: item.product_id,
                name: item.product?.name || 'Produto',
                sku: item.product?.sku || null,
                sent_quantity: item.sent_quantity,
                cost_price: item.cost_price,
                suggested_price: item.suggested_price || 0,
                hasMovement: (item.sold_quantity || 0) > 0 || (item.returned_quantity || 0) > 0 || (item.quantidade_extraviada || 0) > 0
            })));
        }
    }, [open, initialItems]);
    const updateMutation = useMutation({
        mutationFn: async () => {
            return ConsignmentService.updateConsignmentItems(consignmentId, companyId, items.map(it => ({
                id: it.id,
                product_id: it.product_id,
                sent_quantity: it.sent_quantity,
                cost_price: it.cost_price,
                suggested_price: it.suggested_price
            })));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['consignment', consignmentId] });
            toast.success('Itens da consignação atualizados!');
            onOpenChange(false);
        },
        onError: (err) => {
            toast.error('Erro ao atualizar itens: ' + err.message);
        }
    });
    const handleAddProducts = async (ids) => {
        const { data: products, error } = await supabase
            .from('products')
            .select('id, name, sku, cost, price')
            .in('id', ids);
        if (error) {
            toast.error('Erro ao buscar detalhes dos produtos');
            return;
        }
        const newItems = (products || []).map(p => ({
            product_id: p.id,
            name: p.name,
            sku: p.sku,
            sent_quantity: 1,
            cost_price: Number(p.cost || 0),
            suggested_price: Number(p.price || 0),
            hasMovement: false,
            isNew: true
        }));
        setItems(prev => {
            const existingIds = new Set(prev.map(i => i.product_id));
            const filteredNew = newItems.filter(i => !existingIds.has(i.product_id));
            return [...prev, ...filteredNew];
        });
    };
    const removeItem = (productId) => {
        const item = items.find(i => i.product_id === productId);
        if (item?.hasMovement) {
            toast.error("Não é possível remover um item que já teve vendas ou devoluções registradas.");
            return;
        }
        setItems(prev => prev.filter(i => i.product_id !== productId));
    };
    const updateQty = (productId, qty) => {
        const item = items.find(i => i.product_id === productId);
        if (item?.hasMovement) {
            toast.error("Não é possível alterar a quantidade de um item com movimentações.");
            return;
        }
        setItems(prev => prev.map(i => i.product_id === productId ? { ...i, sent_quantity: Math.max(1, qty) } : i));
    };
    const totalValue = items.reduce((acc, it) => acc + (it.sent_quantity * it.suggested_price), 0);
    return (<>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 border-slate-800">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white">Editar Itens da Consignação</DialogTitle>
            <DialogDescription className="text-slate-400">
              Adicione ou remova produtos. Itens com vendas ou devoluções não podem ser alterados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Produtos Consignados</h3>
              <Button type="button" variant="outline" size="sm" className="border-slate-800 hover:bg-slate-800 text-slate-300" onClick={() => setIsProductPickerOpen(true)}>
                <Plus className="h-4 w-4 mr-2"/>
                Adicionar Itens
              </Button>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden">
              <table className="w-full text-sm text-white">
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
                  {items.map((it) => (<tr key={it.product_id} className="border-b border-slate-800/50 hover:bg-slate-800/20">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-slate-500 shrink-0"/>
                          <div>
                            <div className="font-medium">{it.name}</div>
                            <div className="text-xs text-slate-500">{it.sku || 'Sem SKU'}</div>
                            {it.hasMovement && (<div className="text-[10px] text-amber-500 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3"/> Possui movimentação
                              </div>)}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Input type="number" value={it.sent_quantity} disabled={it.hasMovement} onChange={(e) => updateQty(it.product_id, parseInt(e.target.value))} className="h-8 w-20 mx-auto bg-slate-900 border-slate-800 text-center disabled:opacity-50"/>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-300">
                        {formatCurrency(it.suggested_price)}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(it.sent_quantity * it.suggested_price)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {!it.hasMovement && (<Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-destructive" onClick={() => removeItem(it.product_id)}>
                            <Trash2 className="h-4 w-4"/>
                          </Button>)}
                      </td>
                    </tr>))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-900/50">
                    <td colSpan={3} className="px-4 py-3 text-right font-bold text-slate-400 uppercase tracking-wider text-xs">Novo Valor Total</td>
                    <td className="px-4 py-3 text-right font-bold text-blue-400 text-lg">
                      {formatCurrency(totalValue)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/10 rounded-lg p-3 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5"/>
              <div className="text-sm text-amber-200/70">
                <p className="font-semibold text-amber-400 mb-1">Aviso sobre o Contrato PDF</p>
                <p>Ao editar os itens, o contrato PDF gerado anteriormente ficará desatualizado. Você poderá gerar um novo PDF atualizado após salvar.</p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-400">
              Cancelar
            </Button>
            <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending || items.length === 0} className="bg-blue-600 hover:bg-blue-700">
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : null}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductPickerDialog open={isProductPickerOpen} onOpenChange={setIsProductPickerOpen} companyId={companyId} excludeProductIds={new Set(items.map(i => i.product_id))} onConfirm={handleAddProducts}/>
    </>);
}
