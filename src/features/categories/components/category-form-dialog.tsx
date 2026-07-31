import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { handleTitleCaseBlur, toTitleCasePtBr } from "@/lib/text-format";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useCreateCategory, useUpdateCategory } from "../hooks/use-categories";
import type { Category, CategoryStatus, CategoryWithMeta } from "../types";
import { CATEGORY_STATUS_OPTIONS } from "../types";
import { IconPicker } from "./icon-picker";
import { ColorPicker } from "./color-picker";
import {
  isValidCest,
  isValidNcm,
  normalizeCest,
  normalizeNcm,
} from "@/features/products/lib/fiscal-suggestions";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  category?: Category | null;
  categories: CategoryWithMeta[];
}

const NO_PARENT = "__none__";

export function CategoryFormDialog({
  open,
  onOpenChange,
  companyId,
  category,
  categories,
}: Props) {
  const isEdit = !!category;
  const createMut = useCreateCategory();
  const updateMut = useUpdateCategory();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#2563EB");
  const [icon, setIcon] = useState("Tag");
  const [status, setStatus] = useState<CategoryStatus>("active");
  const [parentId, setParentId] = useState<string>(NO_PARENT);
  // Automação fiscal: NCM/CEST padrão sugeridos aos produtos desta categoria.
  const [defaultNcm, setDefaultNcm] = useState("");
  const [defaultCest, setDefaultCest] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(category?.name ?? "");
    setDescription(category?.description ?? "");
    setColor(category?.color ?? "#2563EB");
    setIcon(category?.icon ?? "Tag");
    setStatus((category?.status as CategoryStatus) ?? "active");
    setParentId(category?.parent_id ?? NO_PARENT);
    setDefaultNcm(normalizeNcm(category?.default_ncm));
    setDefaultCest(normalizeCest(category?.default_cest));
  }, [open, category]);

  const parentOptions = categories.filter(
    (c) => c.id !== category?.id && !c.parent_id,
  );

  const submitting = createMut.isPending || updateMut.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const payload = {
      name: toTitleCasePtBr(name),
      description: description.trim() || null,
      color,
      icon,
      status,
      parent_id: parentId === NO_PARENT ? null : parentId,
      default_ncm: isValidNcm(defaultNcm) ? defaultNcm : null,
      default_cest: isValidCest(defaultCest) ? defaultCest : null,
    };

    if (defaultNcm && !isValidNcm(defaultNcm)) {
      toast.error("NCM padrão inválido", { description: "Informe 8 dígitos ou deixe em branco." });
      return;
    }
    if (defaultCest && !isValidCest(defaultCest)) {
      toast.error("CEST padrão inválido", { description: "Informe 7 dígitos ou deixe em branco." });
      return;
    }

    try {
      if (isEdit && category) {
        await updateMut.mutateAsync({ id: category.id, input: payload });
        toast.success("Categoria atualizada");
      } else {
        await createMut.mutateAsync({ company_id: companyId, ...payload });
        toast.success("Categoria criada");
      }
      onOpenChange(false);
    } catch (err) {
      toast.error("Não foi possível salvar", {
        description: err instanceof Error ? err.message : "Tente novamente.",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoria" : "Nova categoria"}</DialogTitle>
          <DialogDescription>
            Organize seu catálogo com categorias e subcategorias.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">Nome</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleTitleCaseBlur(setName)}
              placeholder="Ex.: Bebidas"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-desc">Descrição</Label>
            <Textarea
              id="cat-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Uma breve descrição da categoria"
              rows={2}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Categoria pai</Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_PARENT}>Nenhuma (raiz)</SelectItem>
                  {parentOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as CategoryStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-ncm">NCM padrão</Label>
              <Input
                id="cat-ncm"
                value={defaultNcm}
                inputMode="numeric"
                maxLength={12}
                placeholder="0000.00.00 ou 00000000"
                onChange={(e) => setDefaultNcm(normalizeNcm(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">
                Sugerido automaticamente ao escolher esta categoria no produto.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-cest">CEST padrão</Label>
              <Input
                id="cat-cest"
                value={defaultCest}
                inputMode="numeric"
                maxLength={11}
                placeholder="00.000.00 ou 0000000"
                onChange={(e) => setDefaultCest(normalizeCest(e.target.value))}
              />
              <p className="text-[11px] text-muted-foreground">
                Opcional — 7 dígitos, usado em substituição tributária.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Cor</Label>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <div className="space-y-1.5">
            <Label>Ícone</Label>
            <IconPicker value={icon} onChange={setIcon} color={color} />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {isEdit ? "Salvar" : "Criar categoria"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
