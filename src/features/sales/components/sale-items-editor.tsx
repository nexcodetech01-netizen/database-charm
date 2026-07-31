import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, Search, Package, AlertTriangle, Lock, ScanBarcode, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { applyProductSearch } from "@/features/products/lib/product-search";
import { productImagesService } from "@/features/products/services/product-images.service";

import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import { isFractionalUnit, parseQuantity } from "@/lib/units";
import { computeItemTotal, computeItemMargin, type SaleItemDraft } from "../types";
import { executeWithUndo } from "@/lib/undo-manager";

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  price: number | null;
  cost: number | null;
  stock: number | null;
  unit: string | null;
  cover_image_path: string | null;
  min_margin_pct: number | null;
  target_margin_pct: number | null;
  default_discount_pct: number | null;
}

interface Props {
  companyId: string;
  items: SaleItemDraft[];
  onChange: (items: SaleItemDraft[]) => void;
  /** Se falso, bloqueia adição de produtos até o cliente ser escolhido */
  enabled?: boolean;
}

/**
 * Bucket `product-images` é PRIVADO — usar sempre URL assinada.
 * Cache local por `path` evita re-assinar entre renders e mantém a
 * dropdown performática.
 */
const signedUrlCache = new Map<string, string>();


export function SaleItemsEditor({ companyId, items, onChange, enabled = true }: Props) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [showResults, setShowResults] = useState(false);
  // Mapa path → URL assinada. Alimentado em lote após cada busca; usa
  // `signedUrlCache` (module-level) para evitar re-assinar entre buscas.
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [brokenImages, setBrokenImages] = useState<Record<string, true>>({});
  const activeSignRef = useRef(0);

  useEffect(() => {
    if (!enabled || !query.trim()) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      let q = supabase
        .from("products")
        .select("id,name,sku,price,cost,stock,unit,cover_image_path,category:product_categories(min_margin_pct,target_margin_pct,default_discount_pct)")
        .eq("company_id", companyId)
        .eq("status", "active");
      q = applyProductSearch(q, query);
      const { data } = await q.limit(10);

      const mapped: ProductOption[] = (data ?? []).map((p) => {
        const cat = (p as {
          category?: {
            min_margin_pct?: number | null;
            target_margin_pct?: number | null;
            default_discount_pct?: number | null;
          } | null;
        }).category ?? null;
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          price: p.price != null ? Number(p.price) : null,
          cost: p.cost != null ? Number(p.cost) : null,
          stock: p.stock != null ? Number(p.stock) : null,
          unit: p.unit ?? null,
          cover_image_path: p.cover_image_path,
          min_margin_pct: cat?.min_margin_pct != null ? Number(cat.min_margin_pct) : null,
          target_margin_pct: cat?.target_margin_pct != null ? Number(cat.target_margin_pct) : null,
          default_discount_pct: cat?.default_discount_pct != null ? Number(cat.default_discount_pct) : null,
        };
      });
      setOptions(mapped);

      // Assina apenas os paths que ainda não estão no cache do módulo.
      const paths = mapped
        .map((p) => p.cover_image_path)
        .filter((v): v is string => !!v && !signedUrlCache.has(v));
      // Já projeta o que estiver em cache no state (mantém stateless render).
      const cached: Record<string, string> = {};
      for (const p of mapped) {
        if (p.cover_image_path && signedUrlCache.has(p.cover_image_path)) {
          cached[p.cover_image_path] = signedUrlCache.get(p.cover_image_path)!;
        }
      }
      if (Object.keys(cached).length > 0) {
        setSignedUrls((prev) => ({ ...prev, ...cached }));
      }
      if (paths.length === 0) return;

      const token = ++activeSignRef.current;
      try {
        const signed = await productImagesService.signedUrls(paths);
        if (token !== activeSignRef.current) return; // busca mais nova venceu
        const next: Record<string, string> = {};
        for (const s of signed) {
          if (s.path && s.signedUrl) {
            signedUrlCache.set(s.path, s.signedUrl);
            next[s.path] = s.signedUrl;
          }
        }
        setSignedUrls((prev) => ({ ...prev, ...next }));
      } catch {
        /* placeholder cobre a falha */
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, companyId, enabled]);

  function resolveImageUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    return signedUrls[path] ?? signedUrlCache.get(path) ?? null;
  }

  function createItemUiKey(): string {
    return globalThis.crypto?.randomUUID?.() ?? `item-${Date.now()}-${Math.random()}`;
  }

  function addProduct(p: ProductOption) {
    const unitPrice = p.price ?? 0;
    const discountPct = p.default_discount_pct ?? 0;
    // Desconto padrão da Política Comercial da categoria — vendedor pode alterar.
    const discount =
      discountPct > 0 ? Math.max(0, (unitPrice * discountPct) / 100) : 0;
    onChange([
      ...items,
      {
        ui_key: createItemUiKey(),
        product_id: p.id,
        description: p.name,
        quantity: 1,
        unit_price: unitPrice,
        discount,
        sku: p.sku,
        image_url: resolveImageUrl(p.cover_image_path),
        unit_cost: p.cost,
        stock_available: p.stock,
        unit: p.unit,
        min_margin_pct: p.min_margin_pct,
        target_margin_pct: p.target_margin_pct,
        default_discount_pct: p.default_discount_pct,
      },
    ]);
    setQuery("");
    setOptions([]);
    setShowResults(false);
  }


  function addManual() {
    onChange([
      ...items,
      {
        ui_key: createItemUiKey(),
        product_id: null,
        description: "",
        quantity: 1,
        unit_price: 0,
        discount: 0,
      },
    ]);
  }

  function updateItem(index: number, patch: Partial<SaleItemDraft>) {
    const next = items.map((it, i) => (i === index ? { ...it, ...patch } : it));
    onChange(next);
  }

  function removeItem(index: number) {
    const prev = items;
    const removed = items[index];
    const next = items.filter((_, i) => i !== index);
    executeWithUndo({
      message: `✓ ${removed?.description || "Item"} removido da venda.`,
      apply: () => onChange(next),
      undo: () => onChange(prev),
    });
  }

  if (!enabled) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-8 text-center">
        <Lock className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
        <p className="text-sm font-medium">Selecione o cliente primeiro</p>
        <p className="mt-1 text-xs text-muted-foreground">
          A adição de produtos é liberada após a escolha do cliente.
        </p>
      </div>
    );
  }

  // Colunas: Produto (bem largo, prioridade máxima) | Qtd. | Valor Unit. | Desconto | Subtotal | (remover)
  const gridCols =
    "grid-cols-[minmax(0,1fr)_72px_108px_100px_112px_32px]";

  return (
    <div className="space-y-3">
      {/* Busca em destaque + Linha manual */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 150)}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowResults(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder="Buscar por nome, SKU ou código de barras..."
            className="h-12 border-2 pl-11 pr-11 text-base font-medium shadow-sm focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
          />
          <ScanBarcode className="pointer-events-none absolute right-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/60" />
          {showResults && options.length > 0 ? (
            <div className="absolute z-20 mt-1 w-full rounded-md border border-border bg-popover shadow-lg">
              <ul className="max-h-80 overflow-y-auto py-1">
                {options.map((p) => {
                  const img = resolveImageUrl(p.cover_image_path);
                  const isBroken = img ? brokenImages[img] === true : false;
                  const low = p.stock != null && p.stock <= 0;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.preventDefault();
                          addProduct(p);
                        }}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted">
                          {img && !isBroken ? (
                            <img
                              src={img}
                              alt={p.name}
                              loading="lazy"
                              className="h-full w-full object-cover"
                              onError={() =>
                                setBrokenImages((prev) => ({ ...prev, [img]: true }))
                              }
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
                              <span
                                className={
                                  low ? "text-destructive" : "text-muted-foreground"
                                }
                              >
                                Estoque: {p.stock}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <span className="shrink-0 text-sm font-medium tabular-nums">
                          {p.price != null ? formatCurrency(p.price) : "—"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={(e) => {
            e.preventDefault();
            addManual();
          }}
          className="h-12 shrink-0 px-4"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Linha manual
        </Button>
      </div>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-xl border border-border bg-background/40">
        <div className="min-w-[640px]">
          <div
            className={cn(
              "grid gap-2 border-b border-border bg-muted/40 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
              gridCols,
            )}
          >
            <div>Produto</div>
            <div className="text-right">Qtd.</div>
            <div className="text-right">Valor unit.</div>
            <div className="text-right">Desconto</div>
            <div className="text-right">Subtotal</div>
            <div />
          </div>

          {items.length === 0 ? (
            <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-muted">
                <Package className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-3 text-sm font-semibold text-foreground">
                Nenhum produto adicionado
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Pesquise pelo nome, SKU ou código de barras.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((it, idx) => {
                const fractional = isFractionalUnit(it.unit);
                const insufficient =
                  it.stock_available != null && it.quantity > it.stock_available;
                return (
                  <div
                    key={
                      it.ui_key ??
                      it.id ??
                      `${it.product_id ?? "manual"}-${it.description}`
                    }
                    className={cn("grid items-start gap-2 px-3 py-2.5", gridCols)}
                  >
                    <div className="flex min-w-0 items-start gap-2">
                      {it.image_url && !brokenImages[it.image_url] ? (
                        <img
                          src={it.image_url}
                          alt=""
                          loading="lazy"
                          className="mt-0.5 h-10 w-10 shrink-0 rounded-md border border-border object-cover"
                          onError={() =>
                            setBrokenImages((prev) => ({
                              ...prev,
                              [it.image_url as string]: true,
                            }))
                          }
                        />
                      ) : it.product_id ? (
                        <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-md border border-border bg-muted">
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
                            value={it.description}
                            onChange={(e) =>
                              updateItem(idx, { description: e.target.value })
                            }
                            placeholder="Descrição do item"
                            className="h-9 text-sm font-medium"
                          />
                        )}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                          {it.sku ? (
                            <span className="font-mono opacity-60">{it.sku}</span>
                          ) : null}
                          {it.stock_available != null ? (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 tabular-nums opacity-80",
                                insufficient ? "font-semibold text-destructive opacity-100" : "",
                              )}
                            >
                              {insufficient ? (
                                <AlertTriangle className="h-3 w-3" />
                              ) : null}
                              Est. {it.stock_available}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <Input
                      type="number"
                      min={0}
                      step={fractional ? "0.001" : "1"}
                      inputMode={fractional ? "decimal" : "numeric"}
                      value={it.quantity}
                      onChange={(e) =>
                        updateItem(idx, {
                          quantity: parseQuantity(e.target.value, fractional),
                        })
                      }
                      className="h-9 text-right tabular-nums"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.unit_price}
                      onChange={(e) =>
                        updateItem(idx, { unit_price: Number(e.target.value) || 0 })
                      }
                      className="h-9 text-right tabular-nums"
                    />
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.discount}
                      onChange={(e) =>
                        updateItem(idx, { discount: Number(e.target.value) || 0 })
                      }
                      className="h-9 text-right tabular-nums"
                    />
                    <div className="flex flex-col items-end gap-0.5">
                      <div className="text-right text-sm font-semibold tabular-nums">
                        {formatCurrency(computeItemTotal(it))}
                      </div>
                      {(() => {
                        const { marginPct } = computeItemMargin(it);
                        if (marginPct == null) return null;
                        const min = it.min_margin_pct;
                        const hasDiscount = (it.discount || 0) > 0;
                        if (min == null && !hasDiscount) return null;
                        const below = min != null && marginPct < min;
                        return (
                          <span
                            title={
                              min != null
                                ? `Margem ${marginPct.toFixed(1)}% • mínimo ${Number(min).toFixed(1)}%`
                                : `Margem ${marginPct.toFixed(1)}%`
                            }
                            className={cn(
                              "inline-flex items-center gap-1 text-[10px] font-medium tabular-nums",
                              below ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
                            )}
                          >
                            {below ? (
                              <ShieldAlert className="h-3 w-3" />
                            ) : (
                              <ShieldCheck className="h-3 w-3" />
                            )}
                            {marginPct.toFixed(1)}%
                          </span>
                        );
                      })()}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeItem(idx)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
