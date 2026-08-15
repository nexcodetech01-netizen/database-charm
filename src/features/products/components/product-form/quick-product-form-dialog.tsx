import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRLCurrencyInput } from "@/components/ui/brl-currency-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCategories, useCreateProduct } from "../../hooks/use-products";
import { generateNextSku } from "../../lib/sku-generator";

interface CreatedComponent {
  id: string;
  name: string;
  sku: string;
  cost: number;
  stock: number;
}

interface Props {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (product: CreatedComponent) => void;
}

/**
 * Cria um produto simples direto da tela de composição do kit, sem
 * precisar sair pra "Novo Produto" e voltar pra procurar. Só os campos
 * essenciais pra funcionar como componente de kit (nome, custo, estoque
 * inicial) — o resto (NCM, fotos, canais de venda etc.) pode ser
 * completado depois, editando o produto normalmente.
 */
export function QuickProductFormDialog({ companyId, open, onOpenChange, onCreated }: Props) {
  const { data: categories } = useCategories(companyId);
  const createProduct = useCreateProduct();

  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cost, setCost] = useState(0);
  const [stock, setStock] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setName("");
    setCategoryId("");
    setCost(0);
    setStock(0);
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error("Informe o nome do produto.");
      return;
    }
    setSubmitting(true);
    try {
      const category = categories?.find((c: any) => c.id === categoryId);
      const sku = (await generateNextSku(companyId, name.trim(), category?.name)) || undefined;

      const created = await createProduct.mutateAsync({
        company_id: companyId,
        name: name.trim(),
        category_id: categoryId || null,
        cost,
        stock,
        price: cost,
        status: "active",
        product_type: "simple",
        sku,
        unit: "UN",
      } as any);

      toast.success(`"${name.trim()}" criado.`);
      onCreated({
        id: (created as any).id,
        name: (created as any).name ?? name.trim(),
        sku: (created as any).sku ?? sku ?? "",
        cost,
        stock,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error("Não foi possível criar o produto.", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo produto</DialogTitle>
          <DialogDescription>
            Cadastro rápido — ele já entra neste kit como componente. Você pode
            completar o restante (NCM, fotos, canais de venda) editando o
            produto depois.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do produto</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Película Cerâmica A15" />
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {(categories ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Custo unitário</Label>
              <BRLCurrencyInput value={cost} onValueChange={setCost} />
            </div>
            <div className="space-y-2">
              <Label>Estoque inicial</Label>
              <Input
                type="number"
                min={0}
                value={stock}
                onChange={(e) => setStock(Math.max(0, parseInt(e.target.value, 10) || 0))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={submitting || !name.trim()}>
            {submitting ? "Criando..." : "Criar e adicionar ao kit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
