import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  Search,
  Package,
  Lock,
  ScanLine,
  PackageOpen,
  Upload,
} from "lucide-react";
import { ImportOrderDialog } from "./import-order-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { applyProductSearch } from "@/features/products/lib/product-search";

import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { computeItemTotal, type PurchaseItemDraft } from "../types";
import { executeWithUndo } from "@/lib/undo-manager";
import { isFractionalUnit, parseQuantity } from "@/lib/units";

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  cost: number | null;
  stock: number | null;
  unit: string | null;
  cover_image_path: string | null;
}

interface Props {
  companyId: string;
  items: PurchaseItemDraft[];
  onChange: (items: PurchaseItemDraft[]) => void;
  /** Se falso, bloqueia a adição/edição de produtos. */
  enabled?: boolean;
  /** Título e descrição mostrados quando enabled=false. */
  disabledReason?: { title: string; description: string };
}

function publicImageUrl(path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return data.publicUrl ?? null;
}

export function PurchaseItemsEditor({
  companyId,
  items,
  onChange,
  enabled = true,
  disabledReason,
}: Props) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<number, HTMLInputElement>>(new Map());


  useEffect(() => {
    if (!enabled || !query.trim()) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      let q = supabase
        .from("products")
        .select("id,name,sku,cost,stock,unit,cover_image_path")
        .eq("company_id", companyId)
        .eq("status", "active");
      q = applyProductSearch(q, query);
      const { data } = await q.limit(10);

      setOptions(
        (data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          cost: p.cost != null ? Number(p.cost) : null,
          stock: p.stock != null ? Number(p.stock) : null,
          unit: p.unit ?? null,
          cover_image_path: p.cover_image_path,
        })),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [query, companyId, enabled]);

  function addProduct(p: ProductOption) {
    const newItem = {
      product_id: p.id,
      description: p.name,
      quantity: 1,
      unit_price: p.cost ?? 0,
      discount: 0,
      sku: p.sku,
      image_url: publicImageUrl(p.cover_image_path),
      unit: p.unit,
      stock_available: p.stock,
      last_cost: p.cost,
    };
    onChange([...items, newItem]);
    setQuery("");
    setOptions([]);
    setShowResults(false);
    
    // Auto-focus na quantidade do novo item
    setTimeout(() => {
      const nextIdx = items.length;
      rowRefs.current.get(nextIdx)?.focus();
    }, 10);
  }

  function addManual() {
    onChange([
      ...items,
      {
        product_id: null,
        description: "",
        quantity: 1,
        unit_price: 0,
        discount: 0,
      },
    ]);
    
    // Auto-focus na descrição do novo item
    setTimeout(() => {
      const nextIdx = items.length;
      rowRefs.current.get(nextIdx)?.focus();
    }, 10);
  }

  function updateItem(index: number, patch: Partial<PurchaseItemDraft>) {
    const next = items.map((it, i) => (i === index ? { ...it, ...patch } : it));
    onChange(next);
  }

  function removeItem(index: number) {
    const prev = items;
    const removed = items[index];
    const next = items.filter((_, i) => i !== index);
    executeWithUndo({
      message: `✓ ${removed?.description || "Item"} removido da compra.`,
      apply: () => onChange(next),
      undo: () => onChange(prev),
    });
  }

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      searchInputRef.current?.focus();
    }
  };

  const totalUnits = items.reduce((acc, it) => acc + (Number(it.quantity) || 0), 0);

  if (!enabled) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-4 text-sm">
        <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div>
          <p className="font-medium">
            {disabledReason?.title ?? "Selecione o fornecedor primeiro"}
          </p>
          <p className="text-xs text-muted-foreground">
            {disabledReason?.description ??
              "A adição de produtos é liberada após a escolha do fornecedor."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex h-full flex-col">
      {/* Busca — protagonista */}
      <div className="relative border-b border-border bg-muted/20 p-3 sm:p-4">
        <div className="flex items-stretch gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              value={query}
              onFocus={() => setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 150)}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowResults(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !showResults) {
                  e.preventDefault();
                }
              }}
              placeholder="Buscar produto por nome, SKU ou código de barras..."
              className="h-14 pl-12 text-base font-medium shadow-sm"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-14 shrink-0 px-4"
            onClick={() => toast.info("Scanner em breve")}
          >
            <ScanLine className="mr-1.5 h-4 w-4" /> Scanner
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-14 shrink-0 px-4"
            onClick={addManual}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Linha manual
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-14 shrink-0 px-4"
            onClick={() => setImportOpen(true)}
            disabled={!enabled}
          >
            <Upload className="mr-1.5 h-4 w-4" /> Importar arquivo
          </Button>
        </div>

        {showResults && options.length > 0 ? (
          <div className="absolute inset-x-3 z-20 mt-1 rounded-md border border-border bg-popover shadow-lg sm:inset-x-4">
            <ul className="max-h-80 overflow-y-auto py-1">
              {options.map((p) => {
                const img = publicImageUrl(p.cover_image_path);
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addProduct(p)}
                      className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                    >
                      <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted">
                        {img ? (
                          <img
                            src={img}
                            alt={p.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{p.name}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                          {p.sku ? <span className="font-mono">{p.sku}</span> : null}
                          {p.stock != null ? (
                            <span>
                              Estoque: {p.stock}
                              {p.unit ? ` ${p.unit}` : ""}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-medium tabular-nums">
                        {p.cost != null ? formatCurrency(p.cost) : "—"}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}
      </div>

      {/* Faixa de contagem */}
      <div className="flex items-center justify-between border-b border-border bg-muted/40 px-3 py-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className="font-semibold">Itens da compra</span>
        <span>
          {items.length > 0
            ? `${items.length} ${items.length === 1 ? "item" : "itens"} · ${totalUnits} un.`
            : "nenhum item adicionado"}
        </span>
      </div>

      {/* Tabela dominante */}
      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-4 py-10 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <PackageOpen className="h-4 w-4" />
            Pesquise um produto acima ou utilize um leitor de código de barras para começar.
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-muted/60 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Produto</th>
                <th className="w-[110px] px-2 py-2 text-right">Qtd.</th>
                <th className="w-[130px] px-2 py-2 text-right">Unitário</th>
                <th className="w-[110px] px-2 py-2 text-right">Desconto</th>
                <th className="w-[140px] px-3 py-2 text-right">Subtotal</th>
                <th className="w-[44px] px-2 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {items.map((it, idx) => (
                <tr key={idx} className="hover:bg-muted/20">
                  <td className="px-3 py-1.5 align-middle">
                    <div className="flex items-start gap-2">
                      {it.image_url ? (
                        <img
                          src={it.image_url}
                          alt=""
                          className="mt-0.5 h-9 w-9 shrink-0 rounded border border-border object-cover"
                        />
                      ) : it.product_id ? (
                        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded border border-border bg-muted">
                          <Package className="h-4 w-4 text-muted-foreground" />
                        </div>
                      ) : null}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        {it.product_id ? (
                          <div
                            className="truncate text-sm font-semibold text-foreground"
                            title={it.description}
                          >
                            {it.description}
                          </div>
                        ) : (
                          <Input
                            ref={(el) => {
                              if (el) rowRefs.current.set(idx, el);
                              else rowRefs.current.delete(idx);
                            }}
                            value={it.description}
                            onChange={(e) =>
                              updateItem(idx, { description: e.target.value })
                            }
                            onKeyDown={(e) => handleKeyDown(e, idx)}
                            placeholder="Descrição do item"
                            className="h-8 text-sm font-medium"
                          />
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                          {it.sku ? (
                            <span className="font-mono opacity-60">{it.sku}</span>
                          ) : null}
                          {it.stock_available != null ? (
                            <span className="tabular-nums opacity-80">
                              Est. {it.stock_available}
                              {it.unit ? ` ${it.unit}` : ""}
                            </span>
                          ) : null}
                          {it.last_cost != null ? (
                            <span className="tabular-nums opacity-80">
                              Últ. {formatCurrency(it.last_cost)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    {(() => {
                      const fractional = isFractionalUnit(it.unit);
                      return (
                        <Input
                          ref={(el) => {
                            // Se for produto, a Qtd é o primeiro campo focável
                            if (it.product_id && el) rowRefs.current.set(idx, el);
                          }}
                          type="number"
                          inputMode={fractional ? "decimal" : "numeric"}
                          min={fractional ? 0 : 1}
                          step={fractional ? "0.001" : "1"}
                          value={it.quantity}
                          onChange={(e) =>
                            updateItem(idx, {
                              quantity: parseQuantity(e.target.value, fractional),
                            })
                          }
                          onKeyDown={(e) => handleKeyDown(e, idx)}
                          className="h-8 text-right tabular-nums"
                        />
                      );
                    })()}
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={it.unit_price}
                      onChange={(e) =>
                        updateItem(idx, { unit_price: Number(e.target.value) || 0 })
                      }
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                      className="h-8 text-right tabular-nums"
                    />
                  </td>
                  <td className="px-2 py-1.5 align-middle">
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      value={it.discount}
                      onChange={(e) =>
                        updateItem(idx, { discount: Number(e.target.value) || 0 })
                      }
                      onKeyDown={(e) => handleKeyDown(e, idx)}
                      className="h-8 text-right tabular-nums"
                      title="Desconto do item"
                    />
                  </td>
                  <td className="px-3 py-1.5 text-right align-middle text-sm font-semibold tabular-nums">
                    {formatCurrency(computeItemTotal(it))}
                  </td>
                  <td className="px-1 py-1.5 align-middle text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

        </div>
      )}
    </div>

      <ImportOrderDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        companyId={companyId}
        onImport={(drafts) => onChange([...items, ...drafts])}
      />
    </>
  );
}
