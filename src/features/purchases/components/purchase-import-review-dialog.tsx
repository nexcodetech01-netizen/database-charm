import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import type { PurchaseItemDraft } from "../types";
import { useCategories } from "@/features/products/hooks/use-products";
import { inferCategoryName } from "@/features/products/lib/infer-category";
import {
  findProductsByNameKey,
  type ProductNameMatch,
} from "@/features/products/lib/product-matching";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PurchaseItemDraft[];
  onConfirm: (items: PurchaseItemDraft[]) => void;
  /** Necessário pra sugerir/listar categorias existentes da empresa. */
  companyId: string;
}

export function PurchaseImportReviewDialog({
  open,
  onOpenChange,
  items: initialItems,
  onConfirm,
  companyId,
}: Props) {
  const [items, setItems] = useState<PurchaseItemDraft[]>(initialItems);
  const { data: existingCategories = [] } = useCategories(companyId);
  // Sugestão de produto existente pra cada item importado (por nome
  // normalizado) — mesma checagem da linha manual do editor de itens (ver
  // purchase-items-editor.tsx), aqui rodada em lote na abertura do dialog.
  // Evita que importar a mesma nota do mesmo fornecedor duas vezes crie
  // produtos duplicados no catálogo.
  const [matches, setMatches] = useState<Record<number, ProductNameMatch[]>>({});
  const [dismissedMatches, setDismissedMatches] = useState<Record<number, boolean>>({});

  // Sincroniza estado interno quando initialItems mudar (abertura do dialog).
  //
  // CORRIGIDO (2026-09): também pré-preenche a categoria de cada item com
  // um palpite (mesma inferência por palavra-chave usada ao salvar a
  // compra), pra a pessoa só precisar corrigir os que não bateram — em vez
  // de digitar do zero. Continua editável livremente: o que for digitado
  // aqui tem prioridade sobre a inferência automática na hora de criar o
  // produto (ver ensureProductsForItems em purchases.service.ts).
  useEffect(() => {
    if (!open) return;
    setItems(
      initialItems.map((it) => ({
        ...it,
        category_name: it.category_name ?? inferCategoryName(it.description) ?? "",
      })),
    );
    setMatches({});
    setDismissedMatches({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialItems]);

  // Checagem em lote, uma vez por abertura do dialog — roda sobre a
  // descrição que a IA/XML extraiu, não a cada tecla digitada na revisão
  // (essa tela não adiciona/remove linhas, só edita as existentes).
  useEffect(() => {
    if (!open || initialItems.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        initialItems.map(async (it, idx) => {
          if (it.product_id || !it.description?.trim()) return null;
          const found = await findProductsByNameKey(companyId, it.description);
          return found.length > 0 ? ([idx, found] as const) : null;
        }),
      );
      if (cancelled) return;
      const next: Record<number, ProductNameMatch[]> = {};
      entries.forEach((e) => {
        if (e) next[e[0]] = e[1];
      });
      setMatches(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialItems, companyId]);

  function updateItem(index: number, patch: Partial<PurchaseItemDraft>) {
    setItems((prev) =>
      prev.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    );
  }

  function linkMatch(index: number, m: ProductNameMatch) {
    updateItem(index, {
      product_id: m.id,
      description: m.name,
      sku: m.sku,
      unit: m.unit,
      stock_available: m.stock,
      last_cost: m.cost,
    });
    setMatches((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }

  function dismissMatch(index: number) {
    setDismissedMatches((d) => ({ ...d, [index]: true }));
  }

  const grandTotal = items.reduce(
    (sum, it) => sum + (it.quantity * it.unit_price),
    0,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            <DialogTitle>Revisar Importação</DialogTitle>
          </div>
          <DialogDescription>
            Confira as quantidades e preços extraídos pela IA. Você pode editar
            a descrição e a categoria de cada item antes de confirmar.
          </DialogDescription>
        </DialogHeader>

        {/* Sugestões de autocompletar pro campo Categoria — reaproveita as
            categorias já existentes na empresa, mas o campo aceita
            qualquer texto (categoria nova é criada automaticamente). */}
        <datalist id="purchase-import-category-options">
          {existingCategories.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>

        <div className="flex-1 overflow-auto my-4 border rounded-md">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="min-w-[280px]">Produto / Descrição</TableHead>
                <TableHead className="w-[140px]">Categoria</TableHead>
                <TableHead className="w-[90px] text-right">Qtd. Real</TableHead>
                <TableHead className="w-[120px] text-right">Custo Unit.</TableHead>
                <TableHead className="w-[120px] text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, idx) => (
                <TableRow key={idx}>
                  <TableCell>
                    <Input
                      value={it.description}
                      onChange={(e) =>
                        updateItem(idx, { description: e.target.value })
                      }
                      className="h-8 text-sm"
                    />
                    {it.product_id ? (
                      <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        Vinculado a produto existente — não cria duplicata.
                      </div>
                    ) : matches[idx]?.length > 0 &&
                    !dismissedMatches[idx] ? (
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                        <span className="flex min-w-0 items-start gap-1.5">
                          <AlertTriangle className="mt-[1px] h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 break-words">
                            Já existe{" "}
                            <strong className="font-semibold">
                              {matches[idx][0].name}
                            </strong>
                            {matches[idx][0].sku ? ` (${matches[idx][0].sku})` : ""}{" "}
                            no catálogo.
                          </span>
                        </span>
                        <span className="ml-auto flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            className="font-semibold underline underline-offset-2"
                            onClick={() => linkMatch(idx, matches[idx][0])}
                          >
                            Vincular
                          </button>
                          <button
                            type="button"
                            className="text-amber-700/70 hover:text-amber-900 dark:text-amber-300/70"
                            onClick={() => dismissMatch(idx)}
                          >
                            Ignorar
                          </button>
                        </span>
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Input
                      list="purchase-import-category-options"
                      value={it.category_name ?? ""}
                      placeholder="Categoria"
                      onChange={(e) =>
                        updateItem(idx, { category_name: e.target.value })
                      }
                      className="h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      value={it.quantity}
                      onChange={(e) =>
                        updateItem(idx, { quantity: Number(e.target.value) || 0 })
                      }
                      className="h-8 text-right tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Input
                      type="number"
                      value={it.unit_price}
                      onChange={(e) =>
                        updateItem(idx, { unit_price: Number(e.target.value) || 0 })
                      }
                      className="h-8 text-right tabular-nums"
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(it.quantity * it.unit_price)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>
              Kits e pacotes foram fracionados automaticamente pela IA. Categoria
              em branco vira "Outros" — categoria nova digitada aqui é criada
              automaticamente ao confirmar.
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase font-semibold">Total Extraído</p>
            <p className="text-2xl font-bold text-primary">{formatCurrency(grandTotal)}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Descartar
          </Button>
          <Button onClick={() => onConfirm(items)}>
            Confirmar e Preencher Compra
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
