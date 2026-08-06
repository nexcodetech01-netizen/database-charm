import { useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (productId: string) => void;
  isLoading?: boolean;
  companyId: string;
  orderTitle?: string;
}

export function ProductMappingDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  companyId,
  orderTitle,
}: Props) {
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const { data: products, isFetching } = useQuery({
    queryKey: ["product-mapping-search", companyId, debouncedSearch],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, name, sku, stock")
        .eq("company_id", companyId)
        .eq("status", "active")
        .order("name")
        .limit(20);

      if (debouncedSearch) {
        query = query.or(`name.ilike.%${debouncedSearch}%,sku.ilike.%${debouncedSearch}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  const selectedProduct = products?.find((p) => p.id === selectedProductId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Vincular Produto ao Anúncio</DialogTitle>
          <div className="text-sm text-muted-foreground mt-2">
            Identifique qual produto do seu estoque corresponde ao item:
            <div className="font-medium text-foreground mt-1 truncate">{orderTitle || "Item do Mercado Livre"}</div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Buscar no Estoque</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between font-normal text-left h-auto py-2",
                    !selectedProductId && "text-muted-foreground"
                  )}
                >
                  {selectedProduct ? (
                    <div className="flex flex-col items-start truncate">
                      <span className="truncate w-full font-medium">{selectedProduct.name}</span>
                      <span className="text-xs opacity-70">
                        SKU: {selectedProduct.sku || "—"} • Estoque: {selectedProduct.stock}
                      </span>
                    </div>
                  ) : (
                    "Selecione um produto..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                  <CommandInput 
                    placeholder="Pesquisar por nome ou SKU..." 
                    value={search}
                    onValueChange={setSearch}
                  />
                  <CommandList>
                    <CommandEmpty>
                      {isFetching ? "Buscando..." : "Nenhum produto encontrado."}
                    </CommandEmpty>
                    {products?.map((product) => (
                      <CommandItem
                        key={product.id}
                        value={product.id}
                        onSelect={() => {
                          setSelectedProductId(product.id);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedProductId === product.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span>{product.name}</span>
                          <span className="text-xs text-muted-foreground">
                            SKU: {product.sku || "—"} • Estoque: {product.stock}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-xs text-blue-700 dark:text-blue-300 border border-blue-100 dark:border-blue-800">
            <strong>Dica:</strong> Uma vez vinculado, as próximas vendas deste anúncio no Mercado Livre darão baixa automática neste produto.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button 
            onClick={() => onConfirm(selectedProductId)} 
            disabled={!selectedProductId || isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar Vínculo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
