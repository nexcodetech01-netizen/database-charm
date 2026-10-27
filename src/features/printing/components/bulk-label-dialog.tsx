import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Minus, Plus, Printer, Search, Tags, X } from "lucide-react";
import { toast } from "sonner";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { describeVariant } from "@/features/products/lib/product-identity";
import {
  LABEL_LAYOUT_LIST,
  buildLabelsDocument,
  resolveLabelLayout,
  type LabelItem,
} from "../lib/labels";
import { printHtmlDocument } from "../lib/printer";
import { usePrintPreferences } from "../hooks/use-print-preferences";

/** Máximo de etiquetas numa impressão (evita travar o navegador). */
export const BULK_LABEL_MAX = 500;

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  price: number | null;
  model: string | null;
  color: string | null;
  size: string | null;
  stock: number | null;
}

interface Line {
  product: ProductRow;
  quantity: number;
}

const COLS = "id, name, sku, barcode, price, model, color, size, stock";

export function toLabelItem(p: ProductRow): LabelItem {
  return {
    name: p.name,
    sku: p.sku,
    barcode: p.barcode,
    price: p.price != null ? Number(p.price) : null,
    variant: describeVariant({ model: p.model, color: p.color }) || null,
    size: p.size ?? null,
  };
}

/** Repete cada produto pela quantidade escolhida, até o limite. */
export function expandBulkLabels(lines: { item: LabelItem; quantity: number }[]): LabelItem[] {
  const out: LabelItem[] = [];
  for (const { item, quantity } of lines) {
    const n = Math.max(0, Math.round(Number(quantity) || 0));
    for (let i = 0; i < n && out.length < BULK_LABEL_MAX; i++) out.push(item);
  }
  return out;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  /** Produtos já na lista ao abrir (ex.: itens de uma compra). */
  initial?: { productId: string; quantity: number }[];
  title?: string;
}

/**
 * Etiquetas em lote: vários produtos, cada um com a sua quantidade, numa
 * impressão só.
 */
export function BulkLabelDialog({ open, onOpenChange, companyId, initial, title }: Props) {
  const { prefs, save } = usePrintPreferences(companyId);
  const [layoutId, setLayoutId] = useState<string | null>(null);
  const layout = resolveLabelLayout(layoutId ?? prefs.labelLayout);
  const [lines, setLines] = useState<Line[]>([]);
  const [search, setSearch] = useState("");
  const [printing, setPrinting] = useState(false);

  // Itens iniciais (compra): carrega os produtos ao abrir.
  const initialKey = (initial ?? []).map((i) => `${i.productId}:${i.quantity}`).join(",");
  useEffect(() => {
    if (!open) return;
    if (!initial?.length) {
      setLines([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      const ids = [...new Set(initial.map((i) => i.productId))];
      const { data } = await supabase.from("products").select(COLS).in("id", ids);
      if (cancelled) return;
      const byId = new Map((data ?? []).map((p) => [p.id, p as unknown as ProductRow]));
      const qty = new Map<string, number>();
      for (const i of initial)
        qty.set(i.productId, (qty.get(i.productId) ?? 0) + Number(i.quantity || 0));
      setLines(
        ids
          .filter((id) => byId.has(id))
          .map((id) => ({
            product: byId.get(id)!,
            quantity: Math.max(1, Math.round(qty.get(id) ?? 1)),
          })),
      );
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialKey]);

  const term = search.trim();
  const results = useQuery({
    queryKey: ["bulk-labels-search", companyId, term],
    enabled: open && term.length >= 2,
    staleTime: 30_000,
    queryFn: async (): Promise<ProductRow[]> => {
      const { data, error } = await supabase.rpc("search_products_unaccent", {
        search_term: term,
        company_id_param: companyId,
        limit_param: 8,
      });
      if (error) throw error;
      return (data ?? []) as unknown as ProductRow[];
    },
  });

  function add(p: ProductRow) {
    setLines((prev) => {
      const found = prev.find((l) => l.product.id === p.id);
      if (found) {
        return prev.map((l) => (l.product.id === p.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product: p, quantity: Math.max(1, Math.round(Number(p.stock) || 1)) }];
    });
    setSearch("");
  }

  const setQty = (id: string, q: number) =>
    setLines((prev) =>
      prev.map((l) => (l.product.id === id ? { ...l, quantity: Math.max(0, q) } : l)),
    );

  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.quantity) || 0), 0), [lines]);

  async function handlePrint() {
    const items = expandBulkLabels(
      lines.map((l) => ({ item: toLabelItem(l.product), quantity: l.quantity })),
    );
    if (items.length === 0) return;
    setPrinting(true);
    try {
      await printHtmlDocument(buildLabelsDocument(items, layout, { title: title ?? "Etiquetas" }));
      if (layout.id !== prefs.labelLayout) save({ ...prefs, labelLayout: layout.id });
      toast.success(`${items.length} etiqueta(s) enviada(s) para impressão.`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível imprimir.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-4 w-4" /> {title ?? "Etiquetas em lote"}
          </DialogTitle>
          <DialogDescription>
            Junte os produtos e a quantidade de etiquetas de cada um. Sai tudo numa impressão só.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar produto para adicionar"
              className="pl-9"
            />
            {term.length >= 2 ? (
              <div className="absolute inset-x-0 top-full z-10 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover shadow-md">
                {results.isLoading ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">Buscando…</p>
                ) : (results.data ?? []).length === 0 ? (
                  <p className="px-3 py-2 text-sm text-muted-foreground">
                    Nenhum produto encontrado.
                  </p>
                ) : (
                  (results.data ?? []).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => add(p)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className="min-w-0 truncate">{p.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        estoque {Number(p.stock ?? 0)}
                      </span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <div className="max-h-[45vh] overflow-y-auto rounded-md border">
            {lines.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                Busque e adicione os produtos. A quantidade já vem igual ao estoque.
              </p>
            ) : (
              lines.map((l) => (
                <div
                  key={l.product.id}
                  className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{l.product.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.product.barcode || l.product.sku || "sem código"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Menos uma"
                    onClick={() => setQty(l.product.id, l.quantity - 1)}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <Input
                    className="h-8 w-14 text-center"
                    inputMode="numeric"
                    value={String(l.quantity)}
                    aria-label={`Etiquetas de ${l.product.name}`}
                    onChange={(e) =>
                      setQty(l.product.id, Number(e.target.value.replace(/\D/g, "")) || 0)
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label="Mais uma"
                    onClick={() => setQty(l.product.id, l.quantity + 1)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    aria-label={`Tirar ${l.product.name}`}
                    onClick={() =>
                      setLines((prev) => prev.filter((x) => x.product.id !== l.product.id))
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="w-40 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tamanho da etiqueta</Label>
              <Select value={layout.id} onValueChange={setLayoutId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LABEL_LAYOUT_LIST.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm">
              <span className="font-semibold tabular-nums">{Math.min(total, BULK_LABEL_MAX)}</span>{" "}
              etiqueta(s)
              {total > BULK_LABEL_MAX ? (
                <span className="block text-xs text-muted-foreground">
                  máximo de {BULK_LABEL_MAX} por vez
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handlePrint} disabled={printing || total <= 0}>
            {printing ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Printer className="mr-1.5 h-4 w-4" />
            )}
            Imprimir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
