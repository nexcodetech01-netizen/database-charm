import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { ArrowLeft, Plus, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  MovementFormDialog,
  MovementsTable,
  MovementsTimeline,
  useProductMovements,
} from "@/features/inventory";
import { useProduct } from "@/features/products";
import { formatCurrency } from "@/lib/format";
import { ErrorState } from "@/components/layout/state-views";

export const Route = createFileRoute("/_authenticated/estoque/produto/$productId")({
  beforeLoad: requirePermission("inventory.view"),
  component: ProductInventoryPage,
});

function ProductInventoryPage() {
  const { productId } = Route.useParams();
  const { company } = Route.useRouteContext();
  const product = useProduct(productId);
  const movements = useProductMovements(productId);
  const [openForm, setOpenForm] = useState(false);

  const p = product.data;
  const belowMin = p ? Number(p.stock) <= Number(p.min_stock) : false;

  const backLink = (
    <Button variant="ghost" size="sm" asChild>
      <Link to="/estoque">
        <ArrowLeft className="mr-1 h-4 w-4" /> Voltar ao estoque
      </Link>
    </Button>
  );

  // Sem produto, não dá para lançar movimentação: mostra o motivo e não
  // deixa o botão "Nova movimentação" ativo.
  if (!product.isLoading && !p) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">{backLink}</div>
        {product.isError ? (
          <ErrorState
            title="Não foi possível carregar este produto"
            description="O produto pode existir normalmente — o sistema só não conseguiu carregá-lo agora. Tente de novo."
            onRetry={() => void product.refetch()}
          />
        ) : (
          <ErrorState
            title="Produto não encontrado"
            description="Este produto não existe ou foi excluído. Volte ao estoque e escolha outro."
          />
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center justify-between">
        {backLink}
        <Button onClick={() => setOpenForm(true)} disabled={!p}>
          <Plus className="mr-1.5 h-4 w-4" /> Nova movimentação
        </Button>
      </div>

      <Card className="border-border/60">
        <CardHeader>
          {product.isLoading ? (
            <Skeleton className="h-7 w-56" />
          ) : (
            <>
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-muted/60 p-2 text-primary">
                  <Package className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-xl">{p?.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {p?.sku ?? "Sem SKU"}
                  </p>
                </div>
                {belowMin && <Badge variant="danger">Abaixo do mínimo</Badge>}
              </div>
            </>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="Saldo atual" value={p ? `${Number(p.stock).toLocaleString("pt-BR")} ${p.unit}` : "—"} />
          <Stat label="Estoque mínimo" value={p ? Number(p.min_stock).toLocaleString("pt-BR") : "—"} />
          <Stat label="Custo unitário" value={p ? formatCurrency(Number(p.cost)) : "—"} />
          <Stat
            label="Valor em estoque"
            value={p ? formatCurrency(Number(p.stock) * Number(p.cost)) : "—"}
          />
        </CardContent>
      </Card>

      {movements.isError && !movements.data ? (
        <ErrorState
          title="Não foi possível carregar as movimentações"
          description="O histórico deste produto não carregou — isso não quer dizer que ele não tenha movimentações."
          onRetry={() => void movements.refetch()}
        />
      ) : (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <MovementsTable
            rows={movements.data ?? []}
            total={movements.data?.length ?? 0}
            isLoading={movements.isLoading}
            page={1}
            pageSize={100}
            onPageChange={() => {}}
            compact
          />
        </div>
        <div className="lg:col-span-2">
          <MovementsTimeline
            rows={movements.data ?? []}
            isLoading={movements.isLoading}
            title="Histórico"
          />
        </div>
      </div>
      )}

      <MovementFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        companyId={company.id}
        defaultProductId={productId}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}
