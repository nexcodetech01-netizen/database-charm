import { useState, useMemo } from "react";
import { Plus, Trash2, Search, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

interface ComponentItem {
  id: string;
  component_id: string;
  name: string;
  sku: string;
  quantity: number;
  cost: number;
  stock: number;
}

interface Props {
  companyId: string;
  currentProductId?: string;
  composition: ComponentItem[];
  setComposition: (c: ComponentItem[]) => void;
}

export function KitCompositionModule({ companyId, currentProductId, composition, setComposition }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const { data: searchResults = [] } = useQuery({
    queryKey: ['product-search-kit', search, currentProductId],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, name, sku, cost, stock, created_at')
        .eq('company_id', companyId)
        .eq('product_type', 'simple')
        .order('created_at', { ascending: false })
        .limit(20);

      if (currentProductId) {
        query = query.neq('id', currentProductId);
      }

      if (search.trim()) {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
      }

      const { data, error } = await query;
      
      if (error) throw error;
      return data || [];
    },
    // We allow fetching even without search to show initial products
  });

  const addComponent = (product: any) => {
    if (composition.find(c => c.component_id === product.id)) {
      toast.error("Produto já está no kit");
      return;
    }
    setComposition([
      ...composition,
      {
        id: crypto.randomUUID(),
        component_id: product.id,
        name: product.name,
        sku: product.sku,
        quantity: 1,
        cost: product.cost || 0,
        stock: product.stock || 0
      }
    ]);
    setOpen(false);
    setSearch("");
  };

  const removeComponent = (id: string) => {
    setComposition(composition.filter(c => c.id !== id));
  };

  const updateQuantity = (id: string, qty: number) => {
    setComposition(composition.map(c => c.id === id ? { ...c, quantity: Math.max(1, qty) } : c));
  };

  const totalCost = useMemo(() => 
    composition.reduce((acc, item) => acc + (item.cost * item.quantity), 0)
  , [composition]);

  const kitStock = useMemo(() => {
    if (composition.length === 0) return 0;
    const stocks = composition.map(c => Math.floor(c.stock / c.quantity));
    return Math.min(...stocks);
  }, [composition]);

  return (
    <div className="space-y-6">
      <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Package className="h-5 w-5 text-blue-400" />
              Composição do Kit
            </h3>
            <p className="text-sm text-slate-400">Gerencie as peças que formam este produto composto.</p>
          </div>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="bg-slate-950 border-slate-800 hover:bg-slate-900">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Componente
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0 bg-slate-950 border-slate-800" align="end">
              <Command className="bg-slate-950">
                <CommandInput 
                  placeholder="Pesquisar por Nome, SKU ou EAN..." 
                  value={search}
                  onValueChange={setSearch}
                  className="border-none focus:ring-0"
                />
                <CommandList>
                  <CommandEmpty className="py-6 text-center text-sm text-slate-500">
                    {search.length > 0 ? "Nenhum produto encontrado." : "Comece a digitar para filtrar..."}
                  </CommandEmpty>
                  <CommandGroup>
                    {searchResults.map((p) => (
                      <CommandItem
                        key={p.id}
                        onSelect={() => addComponent(p)}
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-900 aria-selected:bg-slate-900"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-200">{p.name}</span>
                          <span className="text-xs text-slate-500">SKU: {p.sku} | Estoque: {p.stock}</span>
                        </div>
                        <span className="text-sm font-bold text-blue-400">{formatCurrency(p.cost || 0)}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950/50">
          <Table>
            <TableHeader className="bg-slate-900/50">
              <TableRow className="hover:bg-transparent border-slate-800">
                <TableHead className="text-slate-400">Item</TableHead>
                <TableHead className="text-slate-400 text-center">Qtd no Kit</TableHead>
                <TableHead className="text-slate-400">Custo Unit.</TableHead>
                <TableHead className="text-slate-400">Subtotal</TableHead>
                <TableHead className="text-slate-400 text-right w-[80px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {composition.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                    Nenhum componente adicionado.
                  </TableCell>
                </TableRow>
              ) : (
                composition.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-900/30 border-slate-800">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-200">{item.name}</span>
                        <span className="text-xs text-slate-500">SKU: {item.sku}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Input
                          type="number"
                          className="w-16 h-8 text-center bg-slate-950 border-slate-800"
                          value={item.quantity}
                          onChange={(e) => {
                            const parsed = parseInt(e.target.value, 10);
                            updateQuantity(item.id, Number.isFinite(parsed) ? parsed : 1);
                          }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-300">
                      {formatCurrency(item.cost)}
                    </TableCell>
                    <TableCell className="text-blue-400 font-bold">
                      {formatCurrency(item.cost * item.quantity)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeComponent(item.id)}
                        className="text-slate-500 hover:text-red-400 hover:bg-red-400/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
          <span className="text-sm text-slate-400 font-medium">Custo Total da Composição:</span>
          <span className="text-xl font-bold text-white">{formatCurrency(totalCost)}</span>
        </div>
        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
          <div>
            <span className="text-sm text-slate-400 font-medium">Estoque Disponível do Kit:</span>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Baseado no gargalo</p>
          </div>
          <span className="text-xl font-bold text-blue-400">{kitStock} un</span>
        </div>
      </div>
    </div>
  );
}
