import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useDeleteFinancialCategory,
  useFinancialCategories,
} from "../hooks/use-finance";
import { CategoryFormDialog } from "./category-form-dialog";
import type { CategoryKind, FinancialCategory } from "../types";

export function CategoriesPanel({ companyId }: { companyId: string }) {
  const { data, isLoading } = useFinancialCategories(companyId);
  const deleteMut = useDeleteFinancialCategory();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialCategory | null>(null);
  const [defaultKind, setDefaultKind] = useState<CategoryKind>("expense");

  const grouped = useMemo(() => {
    const list = data ?? [];
    const income = list.filter((c) => c.kind === "income");
    const expense = list.filter((c) => c.kind === "expense");
    return { income, expense };
  }, [data]);

  function handleNew(kind: CategoryKind) {
    setEditing(null);
    setDefaultKind(kind);
    setOpen(true);
  }
  function handleEdit(c: FinancialCategory) {
    setEditing(c);
    setOpen(true);
  }
  async function handleDelete(c: FinancialCategory) {
    if (!confirm(`Excluir "${c.name}"?`)) return;
    try {
      await deleteMut.mutateAsync(c.id);
      toast.success("Categoria excluída");
    } catch (err) {
      toast.error("Não foi possível excluir", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Group
          title="Receitas"
          categories={grouped.income}
          onNew={() => handleNew("income")}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
        <Group
          title="Despesas"
          categories={grouped.expense}
          onNew={() => handleNew("expense")}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <CategoryFormDialog
        open={open}
        onOpenChange={setOpen}
        companyId={companyId}
        category={editing}
        categories={data ?? []}
        defaultKind={defaultKind}
      />
    </>
  );
}

function Group({
  title,
  categories,
  onNew,
  onEdit,
  onDelete,
}: {
  title: string;
  categories: FinancialCategory[];
  onNew: () => void;
  onEdit: (c: FinancialCategory) => void;
  onDelete: (c: FinancialCategory) => void;
}) {
  const parents = categories.filter((c) => !c.parent_id);
  const children = (parentId: string) =>
    categories.filter((c) => c.parent_id === parentId);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <h3 className="font-semibold">{title}</h3>
        <Button size="sm" variant="outline" onClick={onNew}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Adicionar
        </Button>
      </div>
      {parents.length === 0 ? (
        <div className="px-5 py-12 text-center text-sm text-muted-foreground">
          <Tag className="mx-auto mb-2 h-6 w-6" />
          Nenhuma categoria cadastrada.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {parents.map((p) => (
            <li key={p.id}>
              <Row category={p} onEdit={onEdit} onDelete={onDelete} />
              {children(p.id).map((c) => (
                <div key={c.id} className="pl-8">
                  <Row category={c} onEdit={onEdit} onDelete={onDelete} nested />
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({
  category,
  onEdit,
  onDelete,
  nested,
}: {
  category: FinancialCategory;
  onEdit: (c: FinancialCategory) => void;
  onDelete: (c: FinancialCategory) => void;
  nested?: boolean;
}) {
  return (
    <div className="group flex items-center justify-between px-5 py-3 hover:bg-muted/40">
      <div className="flex items-center gap-3">
        <span
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: category.color ?? "#64748B" }}
        />
        <span className={nested ? "text-sm text-muted-foreground" : "text-sm font-medium"}>
          {nested ? "↳ " : ""}
          {category.name}
        </span>
      </div>
      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(category)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-destructive hover:text-destructive"
          onClick={() => onDelete(category)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
