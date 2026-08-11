import { useState } from "react";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (category: { id: string; name: string }) => void;
  onCreate: (name: string) => Promise<any>;
  isPending: boolean;
}

export function CategoryQuickFormDialog({ open, onOpenChange, onCreated, onCreate, isPending }: Props) {
  const [name, setName] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      const result = await onCreate(name);
      if (result) {
        onCreated(result);
        onOpenChange(false);
        setName("");
      }
    } catch (err) {
      // Erro já tratado no hook/toast
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Categoria</DialogTitle>
          <DialogDescription>
            Crie uma nova categoria para organizar seus produtos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="category-name">Nome da Categoria</Label>
            <Input
              id="category-name"
              placeholder="Ex: Acessórios, Eletrônicos..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={isPending || !name.trim()}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Categoria
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
