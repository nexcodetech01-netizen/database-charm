import { useState, useEffect } from "react";
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
import { Loader2 } from "lucide-react";
import { useCreateCategory, useUpdateCategory } from "../hooks/use-products";
import { toast } from "sonner";

interface Props {
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: any; // Se presente, modo edição
}

export function CategoryManagementDialog({ companyId, open, onOpenChange, category }: Props) {
  const [name, setName] = useState("");
  const [targetMargin, setTargetMargin] = useState<string>("");
  const [defaultNcm, setDefaultNcm] = useState("");

  const createMutation = useCreateCategory(companyId);
  const updateMutation = useUpdateCategory(companyId);
  const isPending = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (category) {
      setName(category.name || "");
      setTargetMargin(category.target_margin_pct?.toString() || "");
      setDefaultNcm(category.default_ncm || "");
    } else {
      setName("");
      setTargetMargin("");
      setDefaultNcm("");
    }
  }, [category, open]);

  const handleSave = async () => {
    if (!name.trim()) return;

    try {
      if (category) {
        await updateMutation.mutateAsync({
          id: category.id,
          input: {
            name: name.trim(),
            target_margin_pct: targetMargin ? Number(targetMargin) : undefined,
            default_ncm: defaultNcm.trim() || undefined,
          },
        });
        toast.success("Categoria atualizada com sucesso");
      } else {
        await createMutation.mutateAsync({
          name: name.trim(),
          targetMarginPct: targetMargin ? Number(targetMargin) : undefined,
          defaultNcm: defaultNcm.trim() || undefined,
        });
        toast.success("Categoria criada com sucesso");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error("Erro ao salvar categoria");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          <DialogDescription>
            Defina as configurações padrão para produtos desta categoria.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="cat-name">Nome da Categoria</Label>
            <Input
              id="cat-name"
              placeholder="Ex: Acessórios"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cat-margin">Margem Alvo (%)</Label>
              <Input
                id="cat-margin"
                type="number"
                placeholder="Ex: 40"
                value={targetMargin}
                onChange={(e) => setTargetMargin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-ncm">NCM Padrão</Label>
              <Input
                id="cat-ncm"
                placeholder="8 dígitos"
                value={defaultNcm}
                onChange={(e) => setDefaultNcm(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending || !name.trim()}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {category ? "Salvar Alterações" : "Criar Categoria"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
