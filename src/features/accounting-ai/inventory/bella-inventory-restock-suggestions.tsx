import { useNavigate } from "@tanstack/react-router";
import { Loader2, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCreateRestockDrafts } from "@/features/purchases/hooks/use-purchases";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BellaInventoryActions } from "./bella-inventory-actions";
import type { BellaInventoryRestockSuggestion } from "./types";

export interface BellaInventoryRestockSuggestionsProps {
  companyId: string;
  suggestions: readonly BellaInventoryRestockSuggestion[];
  loading?: boolean;
  className?: string;
}

function formatQty(value: number): string {
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/**
 * Sugestão de reposição — quanto comprar de cada produto, olhando o giro
  * de venda dos últimos 60 dias (não só "abaixo do mínimo").
 *
 * O botão "Criar pedido de compra" gera pedidos em RASCUNHO (um por
 * fornecedor do produto), que não mexem em estoque nem em financeiro até
 * serem revisados e confirmados na tela de Compras.
 */
export function BellaInventoryRestockSuggestions({
  companyId,
  suggestions,
  loading = false,
  className,
}: BellaInventoryRestockSuggestionsProps) {
  const navigate = useNavigate();
  const createDrafts = useCreateRestockDrafts();

  async function handleCreateDrafts() {
    try {
      const drafts = await createDrafts.mutateAsync({
        companyId,
        suggestions: suggestions.map((item) => ({
          productId: item.id,
          name: item.name,
          quantity: item.suggestedQty,
        })),
      });
      if (drafts.length === 1) {
        toast.success("Pedido de compra criado como rascunho", {
          description: "Revise quantidades, custos e fornecedor antes de confirmar.",
        });
        navigate({
          to: "/compras/$purchaseId/editar",
          params: { purchaseId: drafts[0].purchaseId },
        });
      } else {
        toast.success(`${drafts.length} pedidos de compra criados como rascunho`, {
          description: "Um por fornecedor. Revise cada um antes de confirmar.",
        });
        navigate({ to: "/compras" });
      }
    } catch (err) {
      toast.error("Não foi possível criar o pedido de compra", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  return (
    <div className={cn("space-y-2", className)} data-testid="bella-inventory-restock-suggestions">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-4 w-4 text-primary" aria-hidden="true" />
        <p className="text-sm font-semibold">Sugestão de compra</p>
      </div>
            <p className="text-xs text-muted-foreground">
        Com base no que cada produto vendeu nos últimos 60 dias — não considera
        sazonalidade nem prazo de entrega do fornecedor. Nada é criado
        automaticamente: o botão abaixo gera rascunhos para você revisar.
      </p>

      {!loading && suggestions.length > 0 ? (
        <Button
          type="button"
          size="sm"
          onClick={handleCreateDrafts}
          disabled={createDrafts.isPending}
          data-testid="bella-inventory-restock-create-drafts"
        >
          {createDrafts.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShoppingCart className="mr-1.5 h-3.5 w-3.5" />
          )}
          Criar pedido de compra
        </Button>
      ) : null}

      {loading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma sugestão de compra no momento — estoque cobre a venda recente.
        </p>
      ) : (
        <ul className="space-y-2">
          {suggestions.map((item) => (
            <li
              key={item.id}
              className="space-y-1.5 rounded-xl border border-border/60 p-3"
              data-testid={`bella-inventory-restock-${item.id}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold leading-tight">{item.name}</p>
                <Badge variant="secondary" className="rounded-lg font-normal">
                  comprar {formatQty(item.suggestedQty)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Vendeu {formatQty(item.qtySold60d)} un. nos últimos 60 dias (
                {item.avgDailyVelocity.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}{" "}
                un./dia) · estoque atual {formatQty(item.stock)}
                {item.minStock > 0 ? ` · mín. ${formatQty(item.minStock)}` : ""}
              </p>
              <BellaInventoryActions size="xs" links={[item.link]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}