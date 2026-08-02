/**
 * CategoryRecalcDialog — recálculo OPT-IN de preços por categoria
 * ================================================================
 * Nenhum preço é alterado automaticamente: o usuário abre a prévia,
 * escolhe o escopo, revisa produto a produto e confirma.
 * Todo preço exibido vem do Motor Comercial V2 (server function).
 */
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  applyCategoryRecalc,
  previewCategoryRecalc,
  type RecalcScope,
} from "@/features/pricing/lib/category-recalc.functions";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

interface Props {
  companyId: string;
  categoryId: string;
  categoryName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoryRecalcDialog({
  companyId,
  categoryId,
  categoryName,
  open,
  onOpenChange,
}: Props) {
  const qc = useQueryClient();
  const [scope, setScope] = useState<RecalcScope>("missing_price");
  const [excluded, setExcluded] = useState<Record<string, boolean>>({});

  const preview = useQuery({
    queryKey: ["pricing", "category-recalc", companyId, categoryId, scope],
    queryFn: () => previewCategoryRecalc({ data: { companyId, categoryId, scope } }),
    enabled: open && Boolean(companyId && categoryId),
  });

  const candidates = useMemo(() => preview.data?.candidates ?? [], [preview.data]);
  const selected = useMemo(
    () => candidates.filter((c) => !excluded[c.id]),
    [candidates, excluded],
  );

  const apply = useMutation({
    mutationFn: () =>
      applyCategoryRecalc({
        data: {
          companyId,
          items: selected.map((c) => ({ productId: c.id, price: c.suggestedPrice })),
        },
      }),
    onSuccess: async (res) => {
      toast.success(`${res.updated} produto(s) recalculado(s) pelo Motor Comercial V2`);
      await qc.invalidateQueries({ queryKey: ["products"] });
      await qc.invalidateQueries({ queryKey: ["pricing"] });
      onOpenChange(false);
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : "Falha ao aplicar recálculo"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-4 w-4" /> Recalcular preços — {categoryName}
          </DialogTitle>
          <DialogDescription>
            Produtos existentes só são alterados após a sua confirmação. Os preços abaixo são
            sugeridos pelo Motor Comercial V2 com a política desta categoria.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-3">
          <Select value={scope} onValueChange={(v) => setScope(v as RecalcScope)}>
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="missing_price">Apenas produtos sem preço de venda</SelectItem>
              <SelectItem value="all">Todos os produtos da categoria</SelectItem>
            </SelectContent>
          </Select>
          {preview.data ? (
            <Badge variant="secondary" className="text-[10px]">
              Margem {preview.data.targetMarginPct}% · origem {preview.data.marginSource}
            </Badge>
          ) : null}
        </div>

        <ScrollArea className="h-[320px] rounded-md border">
          {preview.isLoading ? (
            <p className="p-6 text-center text-sm text-muted-foreground">Calculando prévia...</p>
          ) : candidates.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nenhum produto elegível para recálculo neste escopo.
            </p>
          ) : (
            <ul className="divide-y">
              {candidates.map((c) => (
                <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <Checkbox
                    checked={!excluded[c.id]}
                    onCheckedChange={(v) =>
                      setExcluded((s) => ({ ...s, [c.id]: v !== true }))
                    }
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.sku ?? "sem SKU"} · custo {brl(c.cost)}
                    </p>
                  </div>
                  <div className="text-right tabular-nums">
                    <p className="text-xs text-muted-foreground line-through">
                      {c.currentPrice > 0 ? brl(c.currentPrice) : "sem preço"}
                    </p>
                    <p className="font-semibold text-foreground">{brl(c.suggestedPrice)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        {preview.data?.skippedWithoutCost ? (
          <p className="text-xs text-muted-foreground">
            {preview.data.skippedWithoutCost} produto(s) ignorado(s) por não terem custo informado.
          </p>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => apply.mutate()}
            disabled={apply.isPending || selected.length === 0}
          >
            {apply.isPending
              ? "Aplicando..."
              : `Aplicar em ${selected.length} produto(s)`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
