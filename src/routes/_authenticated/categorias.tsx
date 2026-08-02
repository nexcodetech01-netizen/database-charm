import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { Plus, Search, FolderTree } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PageLayout } from "@/components/layout";
import { toast } from "@/hooks/use-toast";
import {
  CategoryDuplicatesPanel,
  CategoryFormDialog,
  CategoryTable,
  useArchiveCategory,
  useCategoriesList,
  useRestoreCategory,
} from "@/features/categories";
import type { Category, CategoryWithMeta } from "@/features/categories";

export const Route = createFileRoute("/_authenticated/categorias")({
  beforeLoad: requirePermission("categories.view"),
  component: CategoriesPage,
});

type StatusTab = "active" | "archived" | "all";

function CategoriesPage() {
  const { company } = Route.useRouteContext();
  const { data = [], isLoading } = useCategoriesList(company.id);

  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<StatusTab>("active");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  const archiveMut = useArchiveCategory();
  const restoreMut = useRestoreCategory();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((c) => {
      if (tab !== "all" && c.status !== tab) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, search, tab]);

  const totalActive = data.filter((c) => c.status === "active").length;
  const totalArchived = data.filter((c) => c.status === "archived").length;
  const totalRoots = data.filter((c) => !c.parent_id && c.status === "active").length;

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }
  function openEdit(c: CategoryWithMeta) {
    setEditing(c);
    setDialogOpen(true);
  }
  async function handleArchive(c: CategoryWithMeta) {
    try {
      await archiveMut.mutateAsync(c.id);
      toast.success(`"${c.name}" arquivada`);
    } catch (e) {
      toast.error("Não foi possível arquivar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }
  async function handleRestore(c: CategoryWithMeta) {
    try {
      await restoreMut.mutateAsync(c.id);
      toast.success(`"${c.name}" restaurada`);
    } catch (e) {
      toast.error("Não foi possível restaurar", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <PageLayout
      icon={FolderTree}
      title="Categorias"
      description="Como está meu catálogo? Organize com categorias e subcategorias."
      actions={
        <Button size="sm" onClick={openNew}>
          <Plus className="mr-1.5 h-4 w-4" /> Nova categoria
        </Button>
      }
      kpis={
        <div className="grid gap-3 sm:grid-cols-3">
          <MetricCard label="Categorias ativas" value={totalActive} />
          <MetricCard label="Categorias raiz" value={totalRoots} icon={<FolderTree className="h-4 w-4" />} />
          <MetricCard label="Arquivadas" value={totalArchived} muted />
        </div>
      }
    >
      <CategoryDuplicatesPanel companyId={company.id} />

      <div className="flex flex-wrap items-center justify-between gap-3">

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou descrição"
            className="pl-8"
          />
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as StatusTab)}>
          <TabsList>
            <TabsTrigger value="active">Ativas</TabsTrigger>
            <TabsTrigger value="archived">Arquivadas</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <CategoryTable
        rows={filtered}
        isLoading={isLoading}
        onEdit={openEdit}
        onArchive={handleArchive}
        onRestore={handleRestore}
      />

      <CategoryFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        companyId={company.id}
        category={editing}
        categories={data}
      />
    </PageLayout>
  );
}

function MetricCard({
  label,
  value,
  icon,
  muted,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tabular-nums ${muted ? "text-muted-foreground" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
