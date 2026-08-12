import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { Layers, Plus } from "lucide-react";
import { BreadcrumbNav } from "@/components/layout";
import { EntityHeader } from "@/components/design";
import { Button } from "@/components/ui/button";
import { CategoryTable } from "@/features/products/components/category-table";
import { CategoryManagementDialog } from "@/features/products/components/category-management-dialog";
import { useCategories, useDeleteCategory } from "@/features/products/hooks/use-products";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/categorias")({
  beforeLoad: requirePermission("products.view"),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { company } = Route.useRouteContext();
  const { data: categories = [], isLoading } = useCategories(company.id);
  const deleteMutation = useDeleteCategory(company.id);
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);

  const handleEdit = (cat: any) => {
    setSelectedCategory(cat);
    setDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedCategory(null);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Categoria excluída");
    } catch (err) {
      toast.error("Não foi possível excluir a categoria");
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <BreadcrumbNav />

      <EntityHeader
        icon={Layers}
        title="Categorias"
        description="Gerencie as categorias de produtos e defina margens e NCMs padrão."
        actions={
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Categoria
          </Button>
        }
      />

      <CategoryTable 
        categories={categories as any} 
        isLoading={isLoading} 
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <CategoryManagementDialog
        companyId={company.id}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        category={selectedCategory}
      />
    </div>
  );
}
