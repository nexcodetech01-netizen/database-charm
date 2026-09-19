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
  AlertTriangle,
} from "lucide-react";
import { ImportOrderDialog } from "./import-order-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { applyProductSearch } from "@/features/products/lib/product-search";
import {
  findProductsByNameKey,
  type ProductNameMatch,
} from "@/features/products/lib/product-matching";
import { productImagesService } from "@/features/products/services/product-images.service";

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

/** O bucket product-images é privado; as miniaturas sempre usam URLs assinadas. */
const signedUrlCache = new Map<string, string>();

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
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [brokenImages, setBrokenImages] = useState<Record<string, true>>({});
  const searchInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const activeSignRef = useRef(0);


  useEffect(() => {
    if (!enabled || !query.trim()) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_products_unaccent", {
        search_term: query.trim(),
        company_id_param: companyId,
        limit_param: 10,
      });

      if (error) {
        console.error("PurchaseItemsEditor Search Error:", error);
        setOptions([]);
        return;
      }


      const mapped: ProductOption[] = (data ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
          cost: p.cost != null ? Number(p.cost) : null,
          stock: p.stock != null ? Number(p.stock) : null,
          unit: p.unit ?? null,
          cover_image_path: p.cover_image_path,
        }));
      setOptions(mapped);

      const paths = mapped
        .map((p) => p.cover_image_path)
        .filter((path): path is string => Boolean(path) && !signedUrlCache.has(path));
      const cached: Record<string, string> = {};
      for (const product of mapped) {
        const path = product.cover_image_path;
        const cachedUrl = path ? signedUrlCache.get(path) : undefined;
        if (path && cachedUrl) cached[path] = cachedUrl;
      }
      if (Object.keys(cached).length > 0) {
        setSignedUrls((previous) => ({ ...previous, ...cached }));
      }
      if (paths.length === 0) return;

      const token = ++activeSignRef.current;
      try {
        const signed = await productImagesService.signedUrls(paths);
        if (token !== activeSignRef.current) return;
        const next: Record<string, string> = {};
        for (const image of signed) {
          if (image.path && image.signedUrl) {
            signedUrlCache.set(image.path, image.signedUrl);
            next[image.path] = image.signedUrl;
          }
        }
        setSignedUrls((previous) => ({ ...previous, ...next }));
      } catch {
        // O ícone de produto permanece visível quando a assinatura falha.
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, companyId, enabled]);

  function resolveImageUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    return signedUrls[path] ?? signedUrlCache.get(path) ?? null;
  }

  function addProduct(p: ProductOption) {
    const newItem = {
      product_id: p.id,
      description: p.name,
      quantity: 1,
      unit_price: p.cost ?? 0,
      discount: 0,
      sku: p.sku,
      image_url: resolveImageUrl(p.cover_image_path),
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
    setManualMatches((m) => {
      if (!(index in m)) return m;
      const nextMatches = { ...m };
      delete nextMatches[index];
      return nextMatches;
    });
  }

  // Sugestão de produto já existente — linha manual (a mesma checagem
  // roda em lote na revisão de importação, ver purchase-import-review-dialog.tsx).
  // Evita criar duplicata quando a pessoa digita o nome de um produto que
  // já está no catálogo em vez de buscar e clicar nele.
  const [manualMatches, setManualMatches] = useState<Record<number, ProductNameMatch[]>>({});
  const [dismissedMatches, setDismissedMatches] = useState<Record<number, boolean>>({});
  const matchTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      matchTimers.current.forEach((t) => clearTimeout(t));
    };
  }, []);

  function handleManualDescriptionChange(index: number, name: string) {
    updateItem(index, { description: name });
    setDismissedMatches((d) => {
      if (!(index in d)) return d;
      const next = { ...d };
      delete next[index];
      return next;
    });

    const existingTimer = matchTimers.current.get(index);
    if (existingTimer) clearTimeout(existingTimer);

    const trimmed = name.trim();
    if (trimmed.length < 3) {
      setManualMatches((m) => {
        if (!(index in m)) return m;
        const next = { ...m };
        delete next[index];
        return next;
      });
      return;
    }

    const timer = setTimeout(async () => {
      const matches = await findProductsByNameKey(companyId, trimmed);
      setManualMatches((m) => ({ ...m, [index]: matches }));
    }, 400);
    matchTimers.current.set(index, timer);
  }

  async function linkSuggestedProduct(index: number, m: ProductNameMatch) {
    let imageUrl = resolveImageUrl(m.cover_image_path);
    if (!imageUrl && m.cover_image_path) {
      try {
        const [signed] = await productImagesService.signedUrls([m.cover_image_path]);
        if (signed?.signedUrl) {
          signedUrlCache.set(m.cover_image_path, signed.signedUrl);
          setSignedUrls((previous) => ({
            ...previous,
            [m.cover_image_path]: signed.signedUrl,
          }));
          imageUrl = signed.signedUrl;
        }
      } catch {
        // O item será vinculado com o placeholder quando a assinatura falhar.
      }
    }
    updateItem(index, {
      product_id: m.id,
      description: m.name,
      sku: m.sku,
      image_url: imageUrl,
      unit: m.unit,
      stock_available: m.stock,
      last_cost: m.cost,
    });
    setManualMatches((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }

  function dismissMatch(index: number) {
    setDismissedMatches((d) => ({ ...d, [index]: true }));
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
                const img = resolveImageUrl(p.cover_image_path);
                const isBroken = img ? brokenImages[img] === true : false;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addProduct(p)}
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
                              setBrokenImages((previous) => ({ ...previous, [img]: true }))
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
        <div className="flex-1 overflow-x-auto overflow-y-auto">
          <table className="w-full min-w-[640px] text-sm">
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
                      {it.image_url && !brokenImages[it.image_url] ? (
                        <img
                          src={it.image_url}
                          alt=""
                          loading="lazy"
                          className="mt-0.5 h-9 w-9 shrink-0 rounded border border-border object-cover"
                          onError={() => {
                            const imageUrl = it.image_url;
                            if (!imageUrl) return;
                            setBrokenImages((previous) => ({
                              ...previous,
                              [imageUrl]: true,
                            }));
                          }}
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
                              handleManualDescriptionChange(idx, e.target.value)
                            }
                            onKeyDown={(e) => handleKeyDown(e, idx)}
                            placeholder="Descrição do item"
                            className="h-8 text-sm font-medium"
                          />
                        )}
                        {!it.product_id &&
                        manualMatches[idx]?.length > 0 &&
                        !dismissedMatches[idx] ? (
                          <div className="mt-1 flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span className="min-w-0 flex-1 truncate">
                              Já existe{" "}
                              <strong className="font-semibold">
                                {manualMatches[idx][0].name}
                              </strong>
                              {manualMatches[idx][0].sku
                                ? ` (${manualMatches[idx][0].sku})`
                                : ""}{" "}
                              no catálogo — pode ser duplicata.
                            </span>
                            <button
                              type="button"
                              className="shrink-0 font-semibold underline underline-offset-2"
                              onClick={() =>
                                linkSuggestedProduct(idx, manualMatches[idx][0])
                              }
                            >
                              Usar este
                            </button>
                            <button
                              type="button"
                              className="shrink-0 text-amber-700/70 hover:text-amber-900 dark:text-amber-300/70"
                              onClick={() => dismissMatch(idx)}
                            >
                              Ignorar
                            </button>
                          </div>
                        ) : null}
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
