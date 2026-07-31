import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryKind, FinancialCategory } from "../types";
import {
  useCreateFinancialCategory,
  useUpdateFinancialCategory,
} from "../hooks/use-finance";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  category?: FinancialCategory | null;
  categories: FinancialCategory[];
  defaultKind?: CategoryKind;
}

const COLORS = ["#2563EB", "#16A34A", "#F59E0B", "#DC2626", "#7C3AED", "#0EA5E9", "#64748B"];

const EMPTY = {
  name: "",
  kind: "expense" as CategoryKind,
  parent_id: "",
  color: COLORS[0],
  icon: "",
};

export function CategoryFormDialog({
  open,
  onOpenChange,
  companyId,
  category,
  categories,
  defaultKind,
}: Props) {
  const [form, setForm] = useState({ ...EMPTY });
  const isEdit = !!category;
  const createMut = useCreateFinancialCategory();
  const updateMut = useUpdateFinancialCategory();

  useEffect(() => {
    if (!open) return;
    if (category) {
      setForm({
        name: category.name,
        kind: category.kind as CategoryKind,
        parent_id: category.parent_id ?? "",
        color: category.color ?? COLORS[0],
        icon: category.icon ?? "",
      });
    } else {
      setForm({ ...EMPTY, kind: defaultKind ?? "expense" });
    }
  }, [open, category, defaultKind]);

  const parentOptions = categories.filter(
    (c) => c.kind === form.kind && c.id !== category?.id && !c.parent_id,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Informe o nome");
      return;
    }
    try {
      if (isEdit && category) {
        await updateMut.mutateAsync({
          id: category.id,
          input: {
            name: form.name.trim(),
            kind: form.kind,
            parent_id: form.parent_id || null,
            color: form.color,
            icon: form.icon || null,
          },
        });
        toast.success("Categoria atualizada");
      } else {
        await createMut.mutateAsync({
          company_id: companyId,
          name: form.name.trim(),
          kind: form.kind,
          parent_id: form.parent_id || null,
          color: form.color,
          icon: form.icon || null,
        });
        toast.success("Categoria criada");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error("Não foi possível salvar", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoria" : "Nova categoria"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.kind}
                onValueChange={(v) =>
                  setForm({ ...form, kind: v as CategoryKind, parent_id: "" })
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income" textValue="Receita">Receita</SelectItem>
                  <SelectItem value="expense" textValue="Despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Categoria pai</Label>
              <Select
                value={form.parent_id || "__none__"}
                onValueChange={(v) =>
                  setForm({ ...form, parent_id: v === "__none__" ? "" : v })
                }
              >
                <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" textValue="Nenhuma">Nenhuma</SelectItem>
                  {parentOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id} textValue={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Cor</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  className={`h-8 w-8 rounded-full border-2 transition ${
                    form.color === c ? "border-foreground" : "border-transparent"
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
