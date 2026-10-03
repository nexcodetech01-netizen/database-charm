import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { ShoppingCart, Plus, Trash2, X, Printer, Share2, Pencil, MessageCircle } from "lucide-react";
import { parseCurrency } from "@/lib/masks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { PageLayout, EmptyState } from "@/components/layout";
import { toast } from "sonner";
import { printHtmlDocument } from "@/features/printing";
import {
  useShoppingList,
  useAddShoppingListItem,
  useToggleShoppingListItem,
  useRemoveShoppingListItem,
  useClearCheckedShoppingList,
  useUpdateShoppingListItemDetails,
} from "@/features/shopping-list/hooks/use-shopping-list";
import type { ShoppingListItem } from "@/features/shopping-list/services/shopping-list.service";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function itemTotal(item: ShoppingListItem) {
  return item.estimated_price === null ? null : item.estimated_price * item.quantity;
}

/** Evita que texto digitado vire HTML na impressão. */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "15,50" ou "1.234,56" → número; vazio → null. */
function parsePrice(raw: string): number | null {
  if (!raw.trim()) return null;
  return parseCurrency(raw);
}

const NO_SUPPLIER = "Sem fornecedor";

function ItemPrice({ item }: { item: ShoppingListItem }) {
  const total = itemTotal(item);
  if (item.estimated_price === null || total === null) return null;
  return (
    <span className="font-normal text-muted-foreground">
      {" — "}{currencyFormatter.format(item.estimated_price)}/un · {currencyFormatter.format(total)}
    </span>
  );
}

export const Route = createFileRoute("/_authenticated/lista-de-compras")({
  beforeLoad: requirePermission("products.view"),
  head: () => ({
    meta: [
      { title: "Lista de compras | NexOS" },
      { name: "description", content: "Organize itens, categorias e valores estimados da lista de compras." },
      { property: "og:title", content: "Lista de compras | NexOS" },
      { property: "og:description", content: "Organize itens, categorias e valores estimados da lista de compras." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ShoppingListPage,
});

function ShoppingListPage() {
  const { company } = Route.useRouteContext();
  const companyId = company.id;

  const { data: items, isLoading } = useShoppingList(companyId);
  const addMut = useAddShoppingListItem(companyId);
  const toggleMut = useToggleShoppingListItem(companyId);
  const removeMut = useRemoveShoppingListItem(companyId);
  const clearCheckedMut = useClearCheckedShoppingList(companyId);
  const updateDetailsMut = useUpdateShoppingListItemDetails(companyId);

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");
  const [estimatedPrice, setEstimatedPrice] = useState("");
  const [category, setCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
    const [editingPrice, setEditingPrice] = useState("");
  const [editingCategory, setEditingCategory] = useState("");
  const [editingName, setEditingName] = useState("");
  const [editingQuantity, setEditingQuantity] = useState("1");
  const [editingNotes, setEditingNotes] = useState("");

  const pending = (items ?? []).filter((i) => !i.checked);
  const checked = (items ?? []).filter((i) => i.checked);
  const categorySuggestions = useMemo(
    () => Array.from(new Set((items ?? []).flatMap((item) => {
      const value = item.category?.trim();
      return value ? [value] : [];
    }))).sort((a, b) => a.localeCompare(b)),
    [items],
  );
  const pendingGroups = useMemo(() => {
    const groups = new Map<string, ShoppingListItem[]>();
    for (const item of pending) {
            const groupName = item.category?.trim() || NO_SUPPLIER;
      groups.set(groupName, [...(groups.get(groupName) ?? []), item]);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => {
            if (a === NO_SUPPLIER) return 1;
      if (b === NO_SUPPLIER) return -1;
      return a.localeCompare(b);
    });
  }, [pending]);
  const pendingWithPrice = pending.filter((item) => item.estimated_price !== null);
  const checkedWithPrice = checked.filter((item) => item.estimated_price !== null);
  const pendingTotal = pendingWithPrice.reduce((total, item) => total + (itemTotal(item) ?? 0), 0);
  const checkedTotal = checkedWithPrice.reduce((total, item) => total + (itemTotal(item) ?? 0), 0);

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await addMut.mutateAsync({
        name: name.trim(),
                quantity: Math.max(1, Math.round(parseCurrency(quantity)) || 1),
        notes: notes.trim() || null,
        estimatedPrice: parsePrice(estimatedPrice),
        category: category.trim() || null,
      });
      setName("");
      setQuantity("1");
      setNotes("");
      setEstimatedPrice("");
      setCategory("");
    } catch (err) {
      toast.error("Não foi possível adicionar", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  function startEditing(item: ShoppingListItem) {
    setEditingId(item.id);
        setEditingPrice(
      item.estimated_price === null ? "" : String(item.estimated_price).replace(".", ","),
    );
    setEditingCategory(item.category ?? "");
    setEditingName(item.name);
    setEditingQuantity(String(item.quantity));
    setEditingNotes(item.notes ?? "");
  }

  async function saveDetails(id: string) {
    try {
            await updateDetailsMut.mutateAsync({
        id,
        name: editingName,
        quantity: Math.max(1, Math.round(parseCurrency(editingQuantity)) || 1),
        notes: editingNotes,
        estimatedPrice: parsePrice(editingPrice),
        category: editingCategory.trim() || null,
      });
      setEditingId(null);
    } catch (err) {
      toast.error("Não foi possível atualizar os detalhes", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  function renderItem(item: ShoppingListItem, purchased = false) {
    const isEditing = editingId === item.id;
    return (
      <li key={item.id} className="flex items-start gap-3 p-3">
        <Checkbox
          className="mt-1"
          checked={item.checked}
          onCheckedChange={() => handleToggle(item.id, item.checked)}
        />
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <div className="grid gap-2 sm:grid-cols-6">
              <Input
                className="h-8 sm:col-span-3"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                placeholder="O que comprar"
                aria-label="Nome do item"
                autoFocus
              />
              <Input
                className="h-8"
                inputMode="numeric"
                value={editingQuantity}
                onChange={(e) => setEditingQuantity(e.target.value)}
                placeholder="Qtd."
                aria-label="Quantidade"
              />
              <Input
                className="h-8 sm:col-span-2"
                inputMode="decimal"
                value={editingPrice}
                onChange={(e) => setEditingPrice(e.target.value)}
                placeholder="Valor unitário (R$)"
                aria-label="Valor estimado do item"
              />
              <Input
                className="h-8 sm:col-span-3"
                value={editingCategory}
                onChange={(e) => setEditingCategory(e.target.value)}
                placeholder="Fornecedor"
                list="shopping-list-categories"
                aria-label="Fornecedor"
              />
              <Input
                className="h-8 sm:col-span-3"
                value={editingNotes}
                onChange={(e) => setEditingNotes(e.target.value)}
                placeholder="Observação (cor, tamanho...)"
                aria-label="Observação"
              />
              <div className="flex gap-2 sm:col-span-6">
                <Button size="sm" type="button" onClick={() => saveDetails(item.id)} disabled={updateDetailsMut.isPending}>
                  Salvar
                </Button>
                <Button size="sm" type="button" variant="ghost" onClick={() => setEditingId(null)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="block w-full text-left"
              onClick={() => startEditing(item)}
              title="Clique para editar"
            >
              <p className={`break-words text-sm font-medium ${purchased ? "line-through" : ""}`}>
                {item.quantity > 1 ? <span className="tabular-nums">{item.quantity}× </span> : null}
                {item.name}
                <ItemPrice item={item} />
              </p>
              {item.notes ? <p className="text-xs text-muted-foreground">{item.notes}</p> : null}
            </button>
          )}
        </div>
        {!isEditing ? (
          <Button variant="ghost" size="icon" onClick={() => startEditing(item)} aria-label={`Editar ${item.name}`}>
            <Pencil className="h-4 w-4" />
          </Button>
        ) : null}
        <Button variant="ghost" size="icon" onClick={() => handleRemove(item.id)} aria-label={`Remover ${item.name}`}>
          <X className="h-4 w-4" />
        </Button>
      </li>
    );
  }

  async function handleToggle(id: string, current: boolean) {
    try {
      await toggleMut.mutateAsync({ id, checked: !current });
    } catch (err) {
      toast.error("Não foi possível atualizar", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleRemove(id: string) {
    try {
      await removeMut.mutateAsync(id);
    } catch (err) {
      toast.error("Não foi possível remover", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function handleClearChecked() {
    if (checked.length === 0) return;
    if (!confirm(`Remover ${checked.length} item(ns) já marcado(s) como comprado(s)?`)) return;
    try {
      await clearCheckedMut.mutateAsync();
      toast.success("Itens comprados removidos da lista");
    } catch (err) {
      toast.error("Não foi possível limpar", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

    function itemLine(i: ShoppingListItem): string {
    return `• ${i.quantity}× ${i.name}${i.notes ? ` — ${i.notes}` : ""}`;
  }

  function buildListText(): string {
    if (pending.length === 0) return "Lista de compras vazia.";
    const blocks = pendingGroups.map(
      ([groupName, groupItems]) => `*${groupName}*\n${groupItems.map(itemLine).join("\n")}`,
    );
    return `*Lista de compras*\n\n${blocks.join("\n\n")}`;
  }

  /** Pedido para um fornecedor só (ex.: mandar no WhatsApp dele). */
  function shareGroup(groupName: string, groupItems: ShoppingListItem[]) {
    const header = groupName === NO_SUPPLIER ? "Olá! Gostaria de fazer um pedido:" : `Olá! Pedido para ${groupName}:`;
    const text = `${header}\n\n${groupItems.map(itemLine).join("\n")}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function handlePrint() {
    if (pending.length === 0) {
      toast.error("Sua lista está vazia, não tem nada pra imprimir.");
      return;
    }
    const groupsHtml = pendingGroups
      .map(([groupName, groupItems]) => {
        const pricedItems = groupItems.filter((item) => item.estimated_price !== null);
        const subtotal = pricedItems.reduce((total, item) => total + (itemTotal(item) ?? 0), 0);
        const rows = groupItems
          .map((i) => {
            const total = itemTotal(i);
            return `
              <tr>
                <td style="padding:6px 4px;border-bottom:1px solid #ddd;width:22px;vertical-align:top;">☐</td>
                <td style="padding:6px 4px;border-bottom:1px solid #ddd;">
                                    <b>${i.quantity}×</b> ${escapeHtml(i.name)}
                  ${i.notes ? `<div style="font-size:11px;color:#666;">${escapeHtml(i.notes)}</div>` : ""}
                </td>
                <td style="padding:6px 4px;border-bottom:1px solid #ddd;text-align:right;white-space:nowrap;font-size:12px;color:#444;">
                  ${i.estimated_price !== null ? `${currencyFormatter.format(i.estimated_price)}/un` : "—"}
                </td>
                <td style="padding:6px 4px;border-bottom:1px solid #ddd;text-align:right;white-space:nowrap;font-size:12px;font-weight:600;">
                  ${total !== null ? currencyFormatter.format(total) : "—"}
                </td>
              </tr>`;
          })
          .join("");
        return `
          <div style="margin-top:14px;">
            <div style="display:flex;justify-content:space-between;align-items:baseline;">
              <span style="font-size:12px;font-weight:700;color:#333;text-transform:uppercase;letter-spacing:0.04em;">${escapeHtml(groupName)}</span>
              ${pricedItems.length > 0 ? `<span style="font-size:11px;color:#666;">Subtotal: ${currencyFormatter.format(subtotal)}</span>` : ""}
            </div>
            <table style="width:100%; border-collapse: collapse; margin-top: 6px;">
              ${rows}
            </table>
          </div>`;
      })
      .join("");
    const totalHtml =
      pendingWithPrice.length > 0
        ? `
        <div style="margin-top:16px;padding-top:10px;border-top:2px solid #333;display:flex;justify-content:space-between;font-size:14px;font-weight:700;">
          <span>Total estimado</span>
          <span>${currencyFormatter.format(pendingTotal)}</span>
        </div>`
        : "";
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 16px;">
        <h2 style="margin-bottom: 4px;">Lista de compras</h2>
        <p style="color:#666; font-size:12px; margin-top:0;">${new Date().toLocaleDateString("pt-BR")}</p>
        ${groupsHtml}
        ${totalHtml}
      </div>`;
    void printHtmlDocument(html);
  }

  function handleShare() {
    if (pending.length === 0) {
      toast.error("Sua lista está vazia, não tem nada pra compartilhar.");
      return;
    }
    const text = buildListText();
    if (navigator.share) {
      navigator.share({ title: "Lista de compras", text }).catch(() => {
        // usuário cancelou o compartilhamento — não é erro
      });
    } else {
      const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <PageLayout
      icon={ShoppingCart}
      title="Lista de compras"
      meta={`${pending.length} pendente${pending.length === 1 ? "" : "s"}`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="mr-1.5 h-4 w-4" /> Compartilhar
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="mr-1.5 h-4 w-4" /> Imprimir
          </Button>
        </div>
      }
      kpis={
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-muted-foreground">Total estimado (pendente)</p>
            <p className="mt-1 text-lg font-semibold">
              {pendingWithPrice.length > 0 ? currencyFormatter.format(pendingTotal) : "Adicione valores pra ver o total estimado"}
            </p>
          </div>
          <div className="rounded-xl border border-border p-4">
            <p className="text-xs font-medium text-muted-foreground">Total comprado</p>
            <p className="mt-1 text-lg font-semibold">
              {checkedWithPrice.length > 0 ? currencyFormatter.format(checkedTotal) : "Adicione valores pra ver o total comprado"}
            </p>
          </div>
        </div>
      }
    >
      <datalist id="shopping-list-categories">
        {categorySuggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}
      </datalist>
      <form onSubmit={handleAdd} className="mb-6 grid w-full grid-cols-1 gap-3 rounded-xl border border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0 sm:col-span-2 lg:col-span-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">O que você quer comprar?</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Bolsa transversal caramelo"
            autoFocus
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Qtd.</label>
                    <Input
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Observação (opcional)</label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
                        placeholder="Ex.: cor, tamanho..."
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Valor estimado (R$)</label>
                    <Input
            inputMode="decimal"
            value={estimatedPrice}
            onChange={(event) => setEstimatedPrice(event.target.value)}
            placeholder="0,00"
          />
        </div>
        <div className="min-w-0">
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">Fornecedor</label>
          <Input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder="Ex.: Salomão Distribuidora"
            list="shopping-list-categories"
          />
        </div>
        <div className="flex justify-stretch sm:col-span-2 lg:col-span-3 lg:justify-end">
          <Button
            type="submit"
            disabled={!name.trim() || addMut.isPending}
            className="w-full lg:w-auto"
          >
            <Plus className="mr-1.5 h-4 w-4" /> Adicionar
          </Button>
        </div>
      </form>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (items ?? []).length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="Sua lista está vazia"
          description="Adicione o que você quer comprar antes de sair pra comprar (ex.: no Brás)."
        />
      ) : (
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">Pendentes ({pending.length})</h3>
            <div className="space-y-4">
              {pendingGroups.map(([groupName, groupItems]) => {
                const pricedItems = groupItems.filter((item) => item.estimated_price !== null);
                const subtotal = pricedItems.reduce((total, item) => total + (itemTotal(item) ?? 0), 0);
                return (
                  <section key={groupName}>
                    <div className="mb-1.5 flex items-center justify-between px-1">
                                            <h4 className="text-sm font-semibold">{groupName}</h4>
                      <div className="flex items-center gap-3">
                        {pricedItems.length > 0 ? <span className="text-xs text-muted-foreground">Subtotal: {currencyFormatter.format(subtotal)}</span> : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => shareGroup(groupName, groupItems)}
                          title="Enviar o pedido deste fornecedor pelo WhatsApp"
                        >
                          <MessageCircle className="mr-1 h-3.5 w-3.5" /> Enviar pedido
                        </Button>
                      </div>
                    </div>
                    <ul className="divide-y divide-border rounded-xl border border-border">
                      {groupItems.map((item) => renderItem(item))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </div>

          {checked.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">Já comprados ({checked.length})</h3>
                <Button variant="outline" size="sm" onClick={handleClearChecked}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Limpar comprados
                </Button>
              </div>
              <ul className="divide-y divide-border rounded-xl border border-border opacity-60">
                {checked.map((item) => renderItem(item, true))}
              </ul>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}
