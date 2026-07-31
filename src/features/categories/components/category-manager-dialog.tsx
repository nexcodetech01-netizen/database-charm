import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { categoriesService } from "../services/categories.service";
import {
  categoriesKeys,
  useCategoriesList,
  useCreateCategory,
  useUpdateCategory,
} from "../hooks/use-categories";
import type { CategoryWithMeta } from "../types";
import { CategoryIconGlyph } from "./icon-picker";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  /** Chamado quando uma nova categoria é criada por aqui. */
  onCreated?: (categoryId: string) => void;
}

const onlyDigits = (v: string) => v.replace(/\D/g, "").slice(0, 8);

/**
 * Central de gerenciamento de categorias: listar, renomear, definir NCM padrão,
 * criar e excluir categorias vazias — tudo sobre a tabela principal.
 */
export function CategoryManagerDialog({ open, onOpenChange, companyId, onCreated }: Props) {
  const qc = useQueryClient();
  const { data = [], isLoading } = useCategoriesList(companyId);
  const updateMut = useUpdateCategory();
  const createMut = useCreateCategory();

  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftNcm, setDraftNcm] = useState("");
  const [newName, setNewName] = useState("");
  const [newNcm, setNewNcm] = useState("");
  const [toDelete, setToDelete] = useState<CategoryWithMeta | null>(null);
  const [deleting, setDeleting] = useState(false);

  const childCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of data) {
      if (c.parent_id) m.set(c.parent_id, (m.get(c.parent_id) ?? 0) + 1);
    }
    return m;
  }, [data]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (c) =>
        c.name.toLowerCase().includes(q) || (c.default_ncm ?? "").includes(q),
    );
  }, [data, search]);

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: categoriesKeys.all });
    qc.invalidateQueries({ queryKey: ["product-categories"] });
  }

  function startEdit(c: CategoryWithMeta) {
    setEditingId(c.id);
    setDraftName(c.name);
    setDraftNcm(onlyDigits(c.default_ncm ?? ""));
  }

  async function saveEdit(c: CategoryWithMeta) {
    const name = draftName.trim();
    const ncm = onlyDigits(draftNcm);
    if (!name) {
      toast.error("Informe um nome para a categoria.");
      return;
    }
    if (ncm && ncm.length !== 8) {
      toast.error("NCM deve ter 8 dígitos.");
      return;
    }
    try {
      await updateMut.mutateAsync({
        id: c.id,
        input: { name, default_ncm: ncm || null },
      });
      invalidateAll();
      setEditingId(null);
      toast.success(`"${name}" atualizada`);
    } catch (e) {
      toast.error("Não foi possível salvar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function handleCreate() {
    const name = newName.trim();
    const ncm = onlyDigits(newNcm);
    if (!name) return;
    if (ncm && ncm.length !== 8) {
      toast.error("NCM deve ter 8 dígitos.");
      return;
    }
    try {
      const created = await createMut.mutateAsync({
        company_id: companyId,
        name,
        default_ncm: ncm || null,
      });
      invalidateAll();
      setNewName("");
      setNewNcm("");
      toast.success(`"${name}" criada`);
      if (created?.id) onCreated?.(created.id);
    } catch (e) {
      toast.error("Não foi possível criar a categoria", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await categoriesService.remove(toDelete.id);
      invalidateAll();
      toast.success(`"${toDelete.name}" excluída`);
      setToDelete(null);
    } catch (e) {
      toast.error("Não foi possível excluir", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Gerenciar categorias</DialogTitle>
            <DialogDescription>
              Renomeie, defina o NCM padrão ou exclua categorias sem produtos.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou NCM"
              className="pl-8"
            />
          </div>

          <ScrollArea className="h-[340px] rounded-lg border border-border">
            <div className="divide-y divide-border">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-3">
                    <Skeleton className="h-8 w-full" />
                  </div>
                ))
              ) : rows.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhuma categoria encontrada.
                </div>
              ) : (
                rows.map((c) => {
                  const kids = childCount.get(c.id) ?? 0;
                  const canDelete = c.product_count === 0 && kids === 0;
                  const isEditing = editingId === c.id;
                  return (
                    <div key={c.id} className="flex items-center gap-2 p-2.5">
                      <CategoryIconGlyph name={c.icon} color={c.color} />
                      {isEditing ? (
                        <>
                          <Input
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            className="h-8 flex-1"
                            placeholder="Nome"
                          />
                          <Input
                            value={draftNcm}
                            onChange={(e) => setDraftNcm(onlyDigits(e.target.value))}
                            className="h-8 w-28 tabular-nums"
                            placeholder="NCM"
                            inputMode="numeric"
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            disabled={updateMut.isPending}
                            onClick={() => saveEdit(c)}
                          >
                            {updateMut.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Check className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">{c.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {c.product_count} produto(s)
                              {kids > 0 ? ` · ${kids} subcategoria(s)` : ""}
                            </div>
                          </div>
                          {c.default_ncm ? (
                            <Badge variant="secondary" className="tabular-nums">
                              NCM {c.default_ncm}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              Sem NCM
                            </Badge>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => startEdit(c)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            disabled={!canDelete}
                            title={
                              canDelete
                                ? "Excluir categoria"
                                : "Só é possível excluir categorias vazias"
                            }
                            onClick={() => setToDelete(c)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <div className="flex items-end gap-2 rounded-lg border border-dashed border-border p-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Nova categoria</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome da categoria"
                className="mt-1 h-9"
              />
            </div>
            <div className="w-32">
              <label className="text-xs text-muted-foreground">NCM padrão</label>
              <Input
                value={newNcm}
                onChange={(e) => setNewNcm(onlyDigits(e.target.value))}
                placeholder="0000.00.00"
                inputMode="numeric"
                className="mt-1 h-9 tabular-nums"
              />
            </div>
            <Button
              className="h-9"
              onClick={handleCreate}
              disabled={!newName.trim() || createMut.isPending}
            >
              {createMut.isPending ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1.5 h-4 w-4" />
              )}
              Criar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria "{toDelete?.name}" será removida definitivamente. Essa ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleting}>
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
