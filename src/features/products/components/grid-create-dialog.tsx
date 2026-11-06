import { errorText } from "@/lib/describe-error";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Grid3x3, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/format";
import { companyDayKey } from "@/lib/time/company-day";
import { productsService } from "../services/products.service";
import { purchasesService } from "@/features/purchases/services/purchases.service";
import { generateNextSku } from "../lib/sku-generator";
import { buildProductName, describeVariant } from "../lib/product-identity";
import {
  emptyGroup,
  emptyRow,
  gridSummary,
  parseMoney,
  runGridCreate,
  validateGroups,
  type GridGroup,
} from "../lib/grid-create";

const NEW_SUPPLIER = "__novo__";

/**
 * Cadastro em grade: vários produtos parecidos (mesmo nome, custo e preço,
 * marcas/cores/tamanhos diferentes) de uma vez — e, se quiser, já lança a
 * compra do fornecedor com todos eles e o frete.
 */
export function GridCreateDialog({ companyId }: { companyId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<GridGroup[]>([emptyGroup()]);
  const [withPurchase, setWithPurchase] = useState(true);
  const [supplierId, setSupplierId] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [shipping, setShipping] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(() => companyDayKey(new Date()));
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");

  const categories = useQuery({
    queryKey: ["grid-create-categories", companyId],
    enabled: open,
    queryFn: async () => {
      const { data } = await supabase
        .from("product_categories")
        .select("id, name")
        .eq("company_id", companyId)
        .order("name");
      return (data ?? []) as { id: string; name: string }[];
    },
  });
  const suppliers = useQuery({
    queryKey: ["grid-create-suppliers", companyId],
    enabled: open && withPurchase,
    queryFn: () => purchasesService.listActiveSuppliers(companyId),
  });

  const summary = useMemo(() => gridSummary(groups, parseMoney(shipping)), [groups, shipping]);

  const patchGroup = (gi: number, patch: Partial<GridGroup>) =>
    setGroups((prev) => prev.map((g, i) => (i === gi ? { ...g, ...patch } : g)));
  const patchRow = (gi: number, ri: number, patch: Partial<GridGroup["rows"][number]>) =>
    setGroups((prev) =>
      prev.map((g, i) =>
        i === gi ? { ...g, rows: g.rows.map((r, j) => (j === ri ? { ...r, ...patch } : r)) } : g,
      ),
    );

  function reset() {
    setGroups([emptyGroup()]);
    setShipping("");
    setSupplierId("");
    setNewSupplier("");
    setProgress("");
  }

  async function resolveSupplier(): Promise<string | null> {
    if (supplierId && supplierId !== NEW_SUPPLIER) return supplierId;
    const name = newSupplier.trim();
    if (!name) return null;
    const { data, error } = await supabase
      .from("product_suppliers")
      .insert({ company_id: companyId, name })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  async function submit() {
    const problem = validateGroups(groups);
    if (problem) {
      toast.error(problem);
      return;
    }
    if (withPurchase && !supplierId && !newSupplier.trim()) {
      toast.error("Escolha o fornecedor da compra.");
      return;
    }
    if (withPurchase && supplierId === NEW_SUPPLIER && !newSupplier.trim()) {
      toast.error("Digite o nome do fornecedor novo.");
      return;
    }

    setSaving(true);
    let createdSoFar = 0;
    try {
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const catName = new Map((categories.data ?? []).map((c) => [c.id, c.name]));
      const result = await runGridCreate(
        {
          companyId,
          groups,
          withPurchase,
          shipping: parseMoney(shipping),
          purchaseDate,
          purchaseNumber: `PC-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`,
        },
        {
          findExisting: async ({ name, color, size }) => {
            let q = supabase
              .from("products")
              .select("id")
              .eq("company_id", companyId)
              .ilike("name", name)
              .neq("status", "archived")
              .limit(1);
            q = color ? q.ilike("color", color) : q.is("color", null);
            q = q.ilike("size", size);
            const { data } = await q;
            return data && data.length > 0 ? (data[0].id as string) : null;
          },
          generateSku: (fullName, categoryId) =>
            generateNextSku(companyId, fullName, catName.get(categoryId) ?? null),
          createProduct: async (p) => {
            const created = (await productsService.create(p as never)) as { id: string };
            createdSoFar++;
            return created;
          },
          createPurchase: (p) => {
            setProgress("Lançando a compra…");
            return purchasesService.create(p as never);
          },
          resolveSupplier,
          buildName: buildProductName,
          describe: describeVariant,
          onProgress: (done, total) => setProgress(`Cadastrando ${done} de ${total}…`),
        },
      );

      void qc.invalidateQueries({ queryKey: ["products"] });
      void qc.invalidateQueries({ queryKey: ["purchases"] });
      toast.success(`${result.createdCount} produto(s) cadastrado(s).`, {
        description: [
          result.reused > 0
            ? `${result.reused} já existia(m) e ${withPurchase ? "entrou(aram) só na compra" : "não foi(ram) criado(s) de novo — ajuste o estoque deles se precisar"}.`
            : null,
          result.purchaseNumber
            ? `Compra ${result.purchaseNumber} lançada como pendente. Marque como recebida quando as peças chegarem.`
            : "O estoque já entrou.",
        ]
          .filter(Boolean)
          .join(" "),
      });
      reset();
      setOpen(false);
    } catch (e) {
      toast.error("Parou no meio do cadastro", {
        description: `${createdSoFar} produto(s) já foram criados. ${errorText(e, "")}`,
      });
    } finally {
      setSaving(false);
      setProgress("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && setOpen(v)}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Grid3x3 className="mr-1.5 h-4 w-4" /> Cadastrar em grade
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle>Cadastrar em grade</DialogTitle>
          <DialogDescription>
            Um grupo para cada tipo de peça (mesmo nome, custo e preço). Em cada grupo, uma linha
            para cada marca, cor e tamanho que chegou.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {groups.map((g, gi) => (
            <div key={g.key} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Grupo {gi + 1}</p>
                {groups.length > 1 ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setGroups((prev) => prev.filter((_, i) => i !== gi))}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Tirar grupo
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Nome</Label>
                  <Input
                    value={g.name}
                    onChange={(e) => patchGroup(gi, { name: e.target.value })}
                    placeholder="Ex.: Camiseta Masculina Peruana Pima"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Modelo / estampa</Label>
                  <Input
                    value={g.model}
                    onChange={(e) => patchGroup(gi, { model: e.target.value })}
                    placeholder="Ex.: Minimalista"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select
                    value={g.categoryId}
                    onValueChange={(v) => patchGroup(gi, { categoryId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha" />
                    </SelectTrigger>
                    <SelectContent>
                      {(categories.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Custo (R$ cada)</Label>
                  <Input
                    inputMode="decimal"
                    value={g.cost}
                    onChange={(e) => patchGroup(gi, { cost: e.target.value })}
                    placeholder="23,90"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Preço de venda (R$)</Label>
                  <Input
                    inputMode="decimal"
                    value={g.price}
                    onChange={(e) => patchGroup(gi, { price: e.target.value })}
                    placeholder="89,90"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_1fr_80px_64px_32px] gap-2 text-xs font-medium text-muted-foreground">
                  <span>Marca</span>
                  <span>Cor</span>
                  <span>Tamanho</span>
                  <span>Qtd</span>
                  <span />
                </div>
                {g.rows.map((r, ri) => (
                  <div
                    key={r.key}
                    className="grid grid-cols-[1fr_1fr_80px_64px_32px] items-center gap-2"
                  >
                    <Input
                      value={r.brand}
                      onChange={(e) => patchRow(gi, ri, { brand: e.target.value })}
                      placeholder="Gucci"
                      aria-label="Marca"
                    />
                    <Input
                      value={r.color}
                      onChange={(e) => patchRow(gi, ri, { color: e.target.value })}
                      placeholder="Off-White"
                      aria-label="Cor"
                    />
                    <Input
                      value={r.size}
                      onChange={(e) => patchRow(gi, ri, { size: e.target.value.toUpperCase() })}
                      placeholder="M"
                      aria-label="Tamanho"
                    />
                    <Input
                      inputMode="numeric"
                      value={r.quantity}
                      onChange={(e) =>
                        patchRow(gi, ri, { quantity: e.target.value.replace(/\D/g, "") })
                      }
                      aria-label="Quantidade"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      aria-label="Tirar linha"
                      disabled={g.rows.length === 1}
                      onClick={() => patchGroup(gi, { rows: g.rows.filter((_, j) => j !== ri) })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const last = g.rows[g.rows.length - 1];
                    // Nova linha já com a marca e a cor da anterior (só troca o tamanho).
                    patchGroup(gi, {
                      rows: [
                        ...g.rows,
                        { ...emptyRow(), brand: last?.brand ?? "", color: last?.color ?? "" },
                      ],
                    });
                  }}
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Linha
                </Button>
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={() => setGroups((prev) => [...prev, emptyGroup()])}>
            <Plus className="mr-1.5 h-4 w-4" /> Outro grupo (outro tipo de peça)
          </Button>

          <div className="space-y-3 rounded-lg border p-4">
            <label className="flex items-center justify-between gap-3">
              <span>
                <span className="block text-sm font-semibold">Lançar a compra junto</span>
                <span className="block text-xs text-muted-foreground">
                  Uma compra só, com todas as peças e o frete (dividido entre elas). Fica pendente
                  até você marcar como recebida.
                </span>
              </span>
              <Switch checked={withPurchase} onCheckedChange={setWithPurchase} />
            </label>
            {withPurchase ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Fornecedor</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha" />
                    </SelectTrigger>
                    <SelectContent>
                      {(suppliers.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                      <SelectItem value={NEW_SUPPLIER}>+ Fornecedor novo</SelectItem>
                    </SelectContent>
                  </Select>
                  {supplierId === NEW_SUPPLIER ? (
                    <Input
                      value={newSupplier}
                      onChange={(e) => setNewSupplier(e.target.value)}
                      placeholder="Ex.: Vest Fácil"
                    />
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label>Frete (R$)</Label>
                  <Input
                    inputMode="decimal"
                    value={shipping}
                    onChange={(e) => setShipping(e.target.value)}
                    placeholder="32,72"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Data da compra</Label>
                  <Input
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Sem compra, a quantidade de cada linha já entra no estoque agora.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {summary.products} produto(s) · {summary.pieces} peça(s)
            {withPurchase ? ` · compra de ${formatCurrency(summary.total)}` : ""}
            {progress ? ` · ${progress}` : ""}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving || summary.products === 0}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              Criar produtos
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
