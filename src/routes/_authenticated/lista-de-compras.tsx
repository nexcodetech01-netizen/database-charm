import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { ShoppingCart, Plus, Trash2, X, Printer, Share2 } from "lucide-react";
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
} from "@/features/shopping-list/hooks/use-shopping-list";

export const Route = createFileRoute("/_authenticated/lista-de-compras")({
  beforeLoad: requirePermission("products.view"),
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

  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [notes, setNotes] = useState("");

  const pending = (items ?? []).filter((i) => !i.checked);
  const checked = (items ?? []).filter((i) => i.checked);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await addMut.mutateAsync({
        name: name.trim(),
        quantity: Number(quantity) || 1,
        notes: notes.trim() || null,
      });
      setName("");
      setQuantity("1");
      setNotes("");
    } catch (err) {
      toast.error("Não foi possível adicionar", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
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

  function buildListText(): string {
    if (pending.length === 0) return "Lista de compras vazia.";
    const lines = pending.map(
      (i) => `• ${i.name}${i.quantity > 1 ? ` (${i.quantity}x)` : ""}${i.notes ? ` — ${i.notes}` : ""}`,
    );
    return `*Lista de compras*\n\n${lines.join("\n")}`;
  }

  function handlePrint() {
    if (pending.length === 0) {
      toast.error("Sua lista está vazia, não tem nada pra imprimir.");
      return;
    }
    const rows = pending
      .map(
        (i) => `
          <tr>
            <td style="padding:6px 4px;border-bottom:1px solid #ddd;width:24px;">☐</td>
            <td style="padding:6px 4px;border-bottom:1px solid #ddd;">
              ${i.name}${i.quantity > 1 ? ` <b>(${i.quantity}x)</b>` : ""}
              ${i.notes ? `<div style="font-size:11px;color:#666;">${i.notes}</div>` : ""}
            </td>
          </tr>`,
      )
      .join("");
    const html = `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 16px;">
        <h2 style="margin-bottom: 4px;">Lista de compras</h2>
        <p style="color:#666; font-size:12px; margin-top:0;">${new Date().toLocaleDateString("pt-BR")}</p>
        <table style="width:100%; border-collapse: collapse; margin-top: 12px;">
          ${rows}
        </table>
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
      kpis={null}
    >
      <form onSubmit={handleAdd} className="mb-6 flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">O que você quer comprar?</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Bolsa transversal caramelo"
            autoFocus
          />
        </div>
        <div className="w-full sm:w-24">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Qtd.</label>
          <Input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-56">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Observação (opcional)</label>
          <Input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ex.: cor, fornecedor..."
          />
        </div>
        <Button type="submit" disabled={!name.trim() || addMut.isPending}>
          <Plus className="mr-1.5 h-4 w-4" /> Adicionar
        </Button>
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
            <ul className="divide-y divide-border rounded-xl border border-border">
              {pending.map((item) => (
                <li key={item.id} className="flex items-center gap-3 p-3">
                  <Checkbox checked={item.checked} onCheckedChange={() => handleToggle(item.id, item.checked)} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {item.name}
                      {item.quantity > 1 ? ` (${item.quantity}x)` : ""}
                    </p>
                    {item.notes ? <p className="text-xs text-muted-foreground">{item.notes}</p> : null}
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(item.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
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
                {checked.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 p-3">
                    <Checkbox checked={item.checked} onCheckedChange={() => handleToggle(item.id, item.checked)} />
                    <div className="flex-1">
                      <p className="text-sm font-medium line-through">
                        {item.name}
                        {item.quantity > 1 ? ` (${item.quantity}x)` : ""}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => handleRemove(item.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </PageLayout>
  );
}
