import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Option {
  id: string;
  name: string;
}

interface Props {
  companyId: string;
  categoryId: string | null;
  supplierId: string | null;
  onCategoryChange: (id: string | null) => void;
  onSupplierChange: (id: string | null) => void;
}

const ALL = "__all__";

export function BiScopeFilters({
  companyId,
  categoryId,
  supplierId,
  onCategoryChange,
  onSupplierChange,
}: Props) {
  const [categories, setCategories] = useState<Option[]>([]);
  const [suppliers, setSuppliers] = useState<Option[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [c, s] = await Promise.all([
        supabase
          .from("product_categories")
          .select("id, name")
          .eq("company_id", companyId)
          .order("name"),
        supabase
          .from("product_suppliers")
          .select("id, name")
          .eq("company_id", companyId)
          .order("name"),
      ]);
      if (cancelled) return;
      setCategories((c.data ?? []) as Option[]);
      setSuppliers((s.data ?? []) as Option[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={categoryId ?? ALL}
        onValueChange={(v) => onCategoryChange(v === ALL ? null : v)}
      >
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todas categorias</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={supplierId ?? ALL}
        onValueChange={(v) => onSupplierChange(v === ALL ? null : v)}
      >
        <SelectTrigger className="h-8 w-[180px] text-xs">
          <SelectValue placeholder="Fornecedor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Todos fornecedores</SelectItem>
          {suppliers.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
