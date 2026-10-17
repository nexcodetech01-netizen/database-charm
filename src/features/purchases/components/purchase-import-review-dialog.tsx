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
import { parseProductAttributes } from "@/features/products/lib/parse-product-attributes";
import {
    findProductsByNameKey,
  findSimilarProducts,
  type SimilarProductMatch,
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
  // Categoria para aplicar em vários itens de uma vez (ex.: 38 camisetas).
  const [bulkCategory, setBulkCategory] = useState("");
  // Preço de venda em lote: valor fixo ou margem % sobre o custo.
  const [priceMode, setPriceMode] = useState<"fixed" | "markup">("fixed");
  const [priceValue, setPriceValue] = useState("");
  const [priceTarget, setPriceTarget] = useState("all");
  const costOptions = [...new Set(items.filter((it) => !it.product_id).map((it) => roundCents(it.unit_price)))]
    .filter((c) => c > 0)
    .sort((a, b) => a - b);

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
    setSimilars({});
    setDismissedMatches({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialItems]);

  // Checagem em lote, uma vez por abertura do dialog — roda sobre a
  // descrição que a IA/XML extraiu, não a cada tecla digitada na revisão
  // (essa tela não adiciona/remove linhas, só edita as existentes).
  // Sem nome igual no cadastro: sugere os PARECIDOS (o fornecedor quase
  // nunca escreve igual — "Perfume Fem Atheeri PREMIUM 50ml" × "Perfume Atheeri").
  const [similars, setSimilars] = useState<Record<number, SimilarProductMatch[]>>({});

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

      const similarEntries = await Promise.all(
        initialItems.map(async (it, idx) => {
          if (it.product_id || next[idx] || !it.description?.trim()) return null;
          const found = await findSimilarProducts(companyId, it.description, 3);
          return found.length > 0 ? ([idx, found] as const) : null;
        }),
      );
      if (cancelled) return;
      const nextSimilar: Record<number, SimilarProductMatch[]> = {};
      similarEntries.forEach((e) => {
        if (e) nextSimilar[e[0]] = e[1];
      });
      setSimilars(nextSimilar);
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

    function linkMatch(index: number, m: ProductNameMatch | SimilarProductMatch) {
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
    setSimilars((prev) => {
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

        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="font-medium">Categoria para vários itens:</span>
          <Input
            list="purchase-import-category-options"
            value={bulkCategory}
            onChange={(e) => setBulkCategory(e.target.value)}
            placeholder="Ex.: Vestuário"
            className="h-8 w-48 text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!bulkCategory.trim()}
            onClick={() => {
              const v = bulkCategory.trim();
              setItems((prev) =>
                prev.map((it) => (it.product_id ? it : { ...it, category_name: v })),
              );
            }}
          >
            Aplicar a todos
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!bulkCategory.trim()}
            onClick={() => {
              const v = bulkCategory.trim();
              setItems((prev) =>
                prev.map((it) =>
                  it.product_id || (it.category_name ?? "").trim() ? it : { ...it, category_name: v },
                ),
              );
            }}
          >
            Só nos vazios
          </Button>
          <span className="text-xs text-muted-foreground">
            Itens já vinculados a um produto existente não mudam.
          </span>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <span className="font-medium">Preço de venda:</span>
          <select
            value={priceMode}
            onChange={(e) => setPriceMode(e.target.value as "fixed" | "markup")}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            aria-label="Tipo de preço"
          >
            <option value="fixed">Valor (R$)</option>
            <option value="markup">Margem sobre o custo (%)</option>
          </select>
          <Input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={priceValue}
            onChange={(e) => setPriceValue(e.target.value)}
            placeholder={priceMode === "fixed" ? "Ex.: 50,00" : "Ex.: 150"}
            className="h-8 w-28 text-right text-sm tabular-nums"
          />
          <select
            value={priceTarget}
            onChange={(e) => setPriceTarget(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            aria-label="Em quais itens"
          >
            <option value="all">em todos</option>
            <option value="empty">só nos sem preço</option>
            {costOptions.map((c) => (
              <option key={c} value={`cost:${c}`}>
                só custo {formatCurrency(c)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!(Number(priceValue) > 0)}
            onClick={() => {
              const v = Number(priceValue);
              setItems((prev) =>
                prev.map((it) => {
                  if (it.product_id) return it;
                  if (priceTarget === "empty" && it.sale_price) return it;
                  if (priceTarget.startsWith("cost:") && roundCents(it.unit_price) !== Number(priceTarget.slice(5)))
                    return it;
                  const price =
                    priceMode === "fixed" ? v : roundCents((Number(it.unit_price) || 0) * (1 + v / 100));
                  return { ...it, sale_price: price };
                }),
              );
            }}
          >
            Aplicar
          </Button>
          <span className="text-xs text-muted-foreground">
            Vale para os produtos novos. Sem preço, o produto entra com o preço igual ao custo.
          </span>
        </div>

        <div className="flex-1 overflow-auto my-4 border rounded-md">
          <Table>
            <TableHeader className="bg-muted/50 sticky top-0 z-10">
              <TableRow>
                <TableHead className="min-w-[280px]">Produto / Descrição</TableHead>
                <TableHead className="w-[140px]">Categoria</TableHead>
                <TableHead className="w-[90px] text-right">Qtd. Real</TableHead>
                <TableHead className="w-[120px] text-right">Custo Unit.</TableHead>
                <TableHead className="w-[120px] text-right">Venda</TableHead>
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
                    {!it.product_id
                      ? (() => {
                          // Prévia do que o cadastro vai preencher sozinho.
                          const a = parseProductAttributes(it.description ?? "");
                          const parts = [
                            a.brand && `Marca: ${a.brand}`,
                            a.model && `Estampa: ${a.model}`,
                            a.color && `Cor: ${a.color}`,
                            a.size && `Tam.: ${a.size}`,
                          ].filter(Boolean);
                          return parts.length > 0 ? (
                            <p className="mt-0.5 text-[11px] text-muted-foreground">{parts.join(" · ")}</p>
                          ) : null;
                        })()
                      : null}
                    {it.product_id ? (
                      <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                        Vinculado a produto existente — não cria duplicata.
                      </div>
                    ) : matches[idx]?.length > 0 &&
                    !dismissedMatches[idx] ? (
                      <div className="mt-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                        <div className="flex items-start gap-1.5">
                          <AlertTriangle className="mt-[1px] h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0 flex-1 break-words">
                            {matches[idx].length > 1
                              ? `Já existem ${matches[idx].length} produtos com esse nome. Vincule o certo ou ignore se for outra peça.`
                              : "Já existe um produto com esse nome. Vincule se for a mesma peça; ignore se for outra (cor, tamanho ou estampa diferente)."}
                          </span>
                          <button
                            type="button"
                            className="shrink-0 text-amber-700/70 hover:text-amber-900 dark:text-amber-300/70"
                            onClick={() => dismissMatch(idx)}
                          >
                            Ignorar
                          </button>
                        </div>
                        <ul className="mt-0.5 space-y-0.5 pl-5">
                          {matches[idx].map((m) => (
                            <li key={m.id} className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 break-words">
                                <strong className="font-semibold">{m.name}</strong>
                                {m.variant ? ` · ${m.variant}` : ""}
                                {m.sku ? ` (${m.sku})` : ""}
                              </span>
                              <button
                                type="button"
                                className="shrink-0 font-semibold underline underline-offset-2"
                                onClick={() => linkMatch(idx, m)}
                              >
                                Vincular
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : similars[idx]?.length > 0 && !dismissedMatches[idx] ? (
                      <div className="mt-1 rounded-md border border-sky-300 bg-sky-50 px-2 py-1 text-[11px] text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                        <p className="font-medium">Parecido com um produto do cadastro:</p>
                        <ul className="mt-0.5 space-y-0.5">
                          {similars[idx].map((m) => (
                            <li key={m.id} className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 break-words">
                                <strong className="font-semibold">{m.name}</strong>
                                {m.sku ? ` (${m.sku})` : ""} · {Math.round(m.score * 100)}% parecido
                              </span>
                              <button
                                type="button"
                                className="shrink-0 font-semibold underline underline-offset-2"
                                onClick={() => linkMatch(idx, m)}
                              >
                                Vincular
                              </button>
                            </li>
                          ))}
                        </ul>
                        <button
                          type="button"
                          className="mt-0.5 text-sky-700/70 hover:text-sky-900 dark:text-sky-300/70"
                          onClick={() => dismissMatch(idx)}
                        >
                          Nenhum destes — é produto novo
                        </button>
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
                  <TableCell className="text-right">
                    {it.product_id ? (
                      <span className="text-xs text-muted-foreground">mantém</span>
                    ) : (
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={it.sale_price ?? ""}
                        placeholder={String(it.unit_price ?? "")}
                        onChange={(e) =>
                          updateItem(idx, {
                            sale_price: e.target.value === "" ? null : Number(e.target.value) || 0,
                          })
                        }
                        className={
                          "h-8 text-right tabular-nums" +
                          (it.sale_price != null && it.sale_price > 0 && it.sale_price <= it.unit_price
                            ? " border-amber-500"
                            : "")
                        }
                        title="Preço de venda do produto novo"
                      />
                    )}
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

function roundCents(v: number | null | undefined): number {
  return Math.round((Number(v) || 0) * 100) / 100;
}
