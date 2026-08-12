import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, Layers } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Category {
  id: string;
  name: string;
  product_count: number;
  target_margin_pct?: number;
  default_ncm?: string;
}

interface Props {
  categories: Category[];
  isLoading: boolean;
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
}

export function CategoryTable({ categories, isLoading, onEdit, onDelete }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center border rounded-lg bg-muted/10">
        <Layers className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="font-semibold text-lg">Nenhuma categoria encontrada</h3>
        <p className="text-muted-foreground max-w-xs">
          Cadastre categorias para organizar seus produtos e definir margens padrão.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome da Categoria</TableHead>
            <TableHead className="text-center">Qtd. Produtos</TableHead>
            <TableHead className="text-center">Margem Alvo (%)</TableHead>
            <TableHead className="text-center">NCM Padrão</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((cat) => (
            <TableRow key={cat.id}>
              <TableCell className="font-medium">{cat.name}</TableCell>
              <TableCell className="text-center">{cat.product_count}</TableCell>
              <TableCell className="text-center">
                {cat.target_margin_pct ? `${cat.target_margin_pct}%` : "-"}
              </TableCell>
              <TableCell className="text-center">{cat.default_ncm || "-"}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(cat)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (window.confirm(`Excluir a categoria "${cat.name}"? Isso não afetará os produtos, mas removerá o vínculo.`)) {
                        onDelete(cat.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
