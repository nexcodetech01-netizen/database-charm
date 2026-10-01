import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Calculator, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { parseCurrency } from "@/lib/masks";

interface MissingCostProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  last_purchase_cost: number | null;
}

const missingCostKey = (companyId: string) => ["products", "missing-cost", companyId] as const;

/**
 * "Preencher custos": lista os produtos com custo zero para digitar o custo
 * um embaixo do outro. Opcionalmente corrige as vendas já feitas desses
 * produtos (RPC set_product_costs), para o fechamento dos meses passados.
 */
export function BulkCostDialog({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [costs, setCosts] = useState<Record<string, string>>({});
  const [backfill, setBackfill] = useState(true);
  const [saving, setSaving] = useState(false);

  const { data: products, isLoading } = useQuery({
    queryKey: missingCostKey(companyId),
    enabled: open,
    queryFn: async (): Promise<MissingCostProduct[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, price, stock, last_purchase_cost")
        .eq("company_id", companyId)
        .neq("status", "inactive")
        .or("cost.is.null,cost.lte.0")
        .order("name", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as MissingCostProduct[];
    },
  });

  const filled = useMemo(
    () =>
      Object.entries(costs)
        .map(([productId, raw]) => ({ product_id: productId, cost: parseCurrency(raw) }))
        .filter((item) => item.cost > 0),
    [costs],
  );

    const withSuggestion = (products ?? []).filter(
    (p) => Number(p.last_purchase_cost) > 0 && !costs[p.id],
  );

  function fillAllSuggestions() {
    setCosts((c) => {
      const next = { ...c };
      for (const p of withSuggestion) {
        next[p.id] = Number(p.last_purchase_cost).toFixed(2).replace(".", ",");
      }
      return next;
    });
  }

  async function save() {
    if (filled.length === 0) {
      toast.error("Preencha o custo de pelo menos um produto.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await (supabase.rpc as any)("set_product_costs", {
        _company_id: companyId,
        _items: filled,
        _backfill_sales: backfill,
      });
      if (error) throw error;
      const result = (data ?? {}) as { products?: number; sale_items?: number };
      toast.success(`${result.products ?? filled.length} custo(s) salvo(s)`, {
        description:
          backfill && result.sale_items
            ? `${result.sale_items} item(ns) de vendas antigas também foram corrigidos.`
            : undefined,
      });
      setCosts({});
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["products"] }),
        qc.invalidateQueries({ queryKey: ["monthly-closing"] }),
      ]);
    } catch (err) {
      toast.error("Não foi possível salvar os custos", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Calculator className="mr-1.5 h-4 w-4" /> Preencher custos
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Produtos sem custo</DialogTitle>
          <DialogDescription>
            Digite quanto cada peça custou para vocês. Sem o custo, o lucro do fechamento aparece
            maior do que é. Não muda o preço de venda.
          </DialogDescription>
        </DialogHeader>

                {withSuggestion.length > 0 ? (
          <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs">
            <span>
              {withSuggestion.length} produto(s) têm custo da última compra registrado.
            </span>
            <Button size="sm" variant="secondary" onClick={fillAllSuggestions}>
              Usar última compra em todos
            </Button>
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : (products ?? []).length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              Todos os produtos têm custo cadastrado. 🎉
            </p>
          ) : (
            <ul className="divide-y">
              {products!.map((p) => {
                const cost = parseCurrency(costs[p.id] ?? "");
                const margin = cost > 0 && p.price > 0 ? Math.round(((p.price - cost) / p.price) * 100) : null;
                const suggestion = Number(p.last_purchase_cost) > 0 ? Number(p.last_purchase_cost) : null;
                return (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="break-words text-sm font-medium leading-snug">{p.name}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {p.sku ? `SKU ${p.sku} · ` : ""}venda {formatCurrency(p.price)} · estoque {p.stock}
                        {margin !== null ? (
                          <span className={margin < 0 ? " text-destructive" : " text-emerald-600"}>
                            {" "}· margem {margin}%
                          </span>
                        ) : null}
                      </p>
                      {suggestion && !costs[p.id] ? (
                        <button
                          type="button"
                          className="text-xs text-primary underline"
                          onClick={() =>
                            setCosts((c) => ({ ...c, [p.id]: suggestion.toFixed(2).replace(".", ",") }))
                          }
                        >
                          Usar última compra: {formatCurrency(suggestion)}
                        </button>
                      ) : null}
                    </div>
                    <Input
                      inputMode="decimal"
                      placeholder="Custo R$"
                      value={costs[p.id] ?? ""}
                      onChange={(e) => setCosts((c) => ({ ...c, [p.id]: e.target.value }))}
                      className="h-9 w-28 text-right tabular-nums"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-start gap-2 pt-1">
          <Checkbox
            id="backfill-costs"
            checked={backfill}
            onCheckedChange={(v) => setBackfill(v === true)}
          />
          <Label htmlFor="backfill-costs" className="text-sm font-normal leading-snug">
            Corrigir também as vendas já feitas desses produtos que ficaram sem custo (recomendado:
            o fechamento dos meses passados passa a mostrar o lucro certo).
          </Label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          <Button onClick={save} disabled={saving || filled.length === 0}>
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Salvar {filled.length > 0 ? `${filled.length} custo(s)` : "custos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
