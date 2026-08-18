import { useMemo, useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useProductsList } from "@/features/products";
import { ProductThumb } from "@/features/products";
import { productImagesService } from "@/features/products";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  excludeProductIds: Set<string>;
  onConfirm: (productIds: string[]) => Promise<void> | void;
}

export function ProductPickerDialog({
  open,
  onOpenChange,
  companyId,
  excludeProductIds,
  onConfirm,
}: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Reset search when dialog opens to ensure fresh list
  useEffect(() => {
    if (open) {
      setSearch("");
    }
  }, [open]);

  const { data } = useProductsList(companyId, {
    search,
    categoryId: "",
    supplierId: "",
    status: "active",
    stock: "in_stock", // This filters stock > 0 in productsService.list
    sortBy: "name",
    sortDir: "asc",
    page: 1,
    pageSize: 50,
  });

  const rows = useMemo(
    () => (data?.rows ?? []).filter((p) => !excludeProductIds.has(p.id)),
    [data, excludeProductIds],
  );

  const paths = useMemo(
    () =>
      rows
        .map((r) => (r as { cover_image_path?: string | null }).cover_image_path)
        .filter((p): p is string => !!p),
    [rows],
  );

  const { data: signed = [] } = useQuery({
    queryKey: ["signed-urls", ...paths],
    queryFn: () => productImagesService.signedUrls(paths),
    enabled: paths.length > 0,
    staleTime: 30 * 60 * 1000,
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleConfirm() {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await onConfirm(Array.from(selected));
      setSelected(new Set());
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Adicionar produtos</DialogTitle>
          <DialogDescription>
            Selecione produtos existentes para incluir na coleção.
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Buscar por nome, SKU, marca…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ScrollArea className="h-96 rounded-md border">
          <div className="divide-y">
            {rows.map((p) => {
              const path = (p as { cover_image_path?: string | null })
                .cover_image_path;
              const url = signed.find((s) => s.path === path)?.signedUrl ?? null;
              const isSel = selected.has(p.id);
              return (
                <label
                  key={p.id}
                  className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-muted/50"
                >
                  <Checkbox
                    checked={isSel}
                    onCheckedChange={() => toggle(p.id)}
                  />
                  <ProductThumb signedUrl={url} image_url={p.image_url} size="sm" alt={p.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{p.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {(p as { brand?: string | null }).brand ?? "—"} ·{" "}
                      {formatCurrency(Number(p.price))} · {" "}
                      <span className={(p as any).product_type === 'kit' ? "text-blue-500 font-bold" : ""}>
                        Estoque: {p.stock} {(p as any).product_type === 'kit' ? "(Kit)" : ""}
                      </span>
                    </div>
                  </div>
                </label>
              );
            })}
            {rows.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                Nenhum produto disponível.
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={saving || selected.size === 0}>
            {saving
              ? "Adicionando…"
              : `Adicionar (${selected.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
