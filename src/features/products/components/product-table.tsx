import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Package, ShoppingBag, PowerOff, Tag, Play, Pause, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import {
  DataTableActions,
  EnterpriseDataTable,
  type DataTableColumn,
} from "@/components/design";
import { formatCurrency, formatNumber } from "@/lib/format";
import { ProductStatusBadge } from "./product-status-badge";
import { ProductThumb } from "./product-thumb";
import { MercadoLivreBadge } from "./mercadolivre-badge";
import { PublishToMercadoLivreDialog } from "./publish-to-ml-dialog";
import { useSignedImageUrls, useDeactivateProduct } from "../hooks/use-products";
import type { Product } from "../types";
import { LabelPrintDialog } from "@/features/printing";
import { updateMercadoLivreItem, syncProductToMercadoLivre } from "@/lib/mercadolivre-sync.functions";

type Row = Product & {
  category?: { id: string; name: string } | null;
  supplier?: { id: string; name: string } | null;
};

interface Props {
  rows: Row[];
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function ProductTable({ rows, isLoading, total, page, pageSize, onPageChange }: Props) {
  const [publishTarget, setPublishTarget] = useState<Product | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Product | null>(null);
  const [labelTarget, setLabelTarget] = useState<Product | null>(null);
  const deactivate = useDeactivateProduct();
  const updateMlItem = useServerFn(updateMercadoLivreItem);
  const syncMlItem = useServerFn(syncProductToMercadoLivre);
  const [isUpdatingMl, setIsUpdatingMl] = useState<string | null>(null);

  const handleUpdateMlStatus = async (productId: string, status: "active" | "paused") => {
    setIsUpdatingMl(productId);
    try {
      await updateMlItem({ data: { productId, status } });
      toast.success(status === "active" ? "Anúncio reativado" : "Anúncio pausado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar anúncio");
    } finally {
      setIsUpdatingMl(null);
    }
  };

  const handleSyncMlPrice = async (productId: string) => {
    setIsUpdatingMl(productId);
    try {
      await syncMlItem({ data: { productId } });
      toast.success("Preço e estoque sincronizados com o ML");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao sincronizar");
    } finally {
      setIsUpdatingMl(null);
    }
  };

  // Agrega paths do dataset atual em UMA única assinatura em lote (evita N queries).
  const coverPaths = useMemo(
    () =>
      Array.from(
        new Set(
          rows
            .map((r) => (r as Row & { cover_image_path?: string | null }).cover_image_path)
            .filter((p): p is string => !!p),
        ),
      ),
    [rows],
  );
  const { data: signed = [] } = useSignedImageUrls(coverPaths);
  const urlByPath = useMemo(
    () => new Map(signed.map((s) => [s.path, s.signedUrl] as const)),
    [signed],
  );

  const columns: DataTableColumn<Row>[] = useMemo(
    () => [
      {
        id: "photo",
        header: "Foto",
        width: "w-[64px]",
        cell: (p) => {
          const path =
            (p as Row & { cover_image_path?: string | null }).cover_image_path ?? null;
          return (
            <ProductThumb
              signedUrl={path ? urlByPath.get(path) ?? null : null}
              alt={p.name}
              size="sm"
            />
          );
        },
      },
      {
        id: "name",
        header: "Produto",
        cell: (p) => (
          <>
            <div className="flex items-center gap-2">
              <Link
                to="/produtos/$productId"
                params={{ productId: p.id }}
                className="font-medium hover:text-primary"
              >
                {p.name}
              </Link>
              <MercadoLivreBadge
                mlItemId={(p as Product & { ml_item_id?: string | null }).ml_item_id ?? null}
                permalink={
                  (p as Product & { ml_permalink?: string | null }).ml_permalink ?? null
                }
                compact
              />
            </div>
            {p.brand ? <p className="text-xs text-muted-foreground">{p.brand}</p> : null}
          </>
        ),
      },
      {
        id: "sku",
        header: "SKU",
        className: "font-mono text-xs",
        cell: (p) => p.sku ?? "—",
      },
      {
        id: "category",
        header: "Categoria",
        className: "text-sm",
        hideBelow: "md",
        cell: (p) => p.category?.name ?? "—",
      },
      {
        id: "supplier",
        header: "Fornecedor",
        className: "text-sm",
        hideBelow: "lg",
        cell: (p) => p.supplier?.name ?? "—",
      },
      {
        id: "price",
        header: "Preço",
        align: "right",
        className: "tabular-nums",
        cell: (p) => formatCurrency(Number(p.price)),
      },
      {
        id: "stock",
        header: "Estoque",
        align: "right",
        className: "tabular-nums",
        cell: (p) => {
          const isKit = (p as any).product_type === "kit";
          const stock = Number(p.stock);
          const minStock = Number(p.min_stock);


          return (
            <div className="flex flex-col items-end">
              <span
                className={cn(
                  "tabular-nums",
                  stock <= minStock && !isKit ? "font-medium text-warning" : undefined
                )}
                title={isKit ? "Estoque calculado (Mínimo dos componentes)" : undefined}
              >
                {formatNumber(stock)} {p.unit}
              </span>
              {isKit && (
                <span className="text-[9px] uppercase tracking-tighter text-blue-500 font-bold bg-blue-50 dark:bg-blue-900/20 px-1 rounded-sm">
                  Kit / Virtual
                </span>
              )}
            </div>
          );
        },
      },
      {
        id: "status",
        header: "Status",
        cell: (p) => <ProductStatusBadge status={p.status} />,
      },
    ],
    [urlByPath],
  );

  return (
    <EnterpriseDataTable<Row>
      rows={rows}
      columns={columns}
      getRowId={(p) => p.id}
      isLoading={isLoading}
      empty={{
        icon: Package,
        title: "Nenhum produto encontrado",
        description: "Ajuste os filtros ou cadastre um novo produto.",
      }}
      pagination={{ page, pageSize, total, onPageChange }}
      rowActions={(p) => {
        const mlItemId = (p as Product & { ml_item_id?: string | null }).ml_item_id ?? null;
        return (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                console.log("Abrindo modal de publicação para o produto:", p.id);
                setPublishTarget(p as Product);
              }}
              title={mlItemId ? "Reanunciar no Mercado Livre" : "Anunciar no Mercado Livre"}
            >
              <ShoppingBag className="mr-1.5 h-4 w-4" />
              {mlItemId ? "Reanunciar" : "Anunciar no ML"}
            </Button>
            <DataTableActions>
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  setLabelTarget(p as Product);
                }}
              >
                <Tag className="mr-2 h-4 w-4" />
                Imprimir etiqueta
              </DropdownMenuItem>

              {mlItemId && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    disabled={!!isUpdatingMl}
                    onSelect={(e) => {
                      e.preventDefault();
                      handleUpdateMlStatus(p.id, "active");
                    }}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Reativar no ML
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!!isUpdatingMl}
                    onSelect={(e) => {
                      e.preventDefault();
                      handleUpdateMlStatus(p.id, "paused");
                    }}
                  >
                    <Pause className="mr-2 h-4 w-4" />
                    Pausar no ML
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!!isUpdatingMl}
                    onSelect={(e) => {
                      e.preventDefault();
                      handleSyncMlPrice(p.id);
                    }}
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${isUpdatingMl === p.id ? "animate-spin" : ""}`} />
                    Sincronizar Preço/Estoque
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                </>
              )}

              {p.status === "active" ? (
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    setDeactivateTarget(p as Product);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <PowerOff className="mr-2 h-4 w-4" />
                  Inativar produto
                </DropdownMenuItem>
              ) : null}
            </DataTableActions>
          </>
        );
      }}
    >
      {labelTarget ? (
        <LabelPrintDialog
          open={!!labelTarget}
          onOpenChange={(open) => {
            if (!open) setLabelTarget(null);
          }}
          companyId={labelTarget.company_id}
          item={{
            name: labelTarget.name,
            sku: labelTarget.sku,
            barcode: labelTarget.barcode,
            price: Number(labelTarget.price),
          }}
        />
      ) : null}

      {publishTarget ? (
        <PublishToMercadoLivreDialog
          product={publishTarget}
          open={!!publishTarget}
          onOpenChange={(open) => {
            if (!open) setPublishTarget(null);
          }}
        />
      ) : null}

      <AlertDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Inativar produto?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget?.name
                ? `"${deactivateTarget.name}" deixará de aparecer nos seletores de venda e compra. `
                : ""}
              O histórico, SKU, imagens e movimentações de estoque serão preservados. Você poderá reativá-lo depois editando o produto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deactivate.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deactivate.isPending}
              onClick={async (e) => {
                e.preventDefault();
                if (!deactivateTarget) return;
                try {
                  await deactivate.mutateAsync(deactivateTarget.id);
                  toast.success("Produto inativado");
                  setDeactivateTarget(null);
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : "Falha ao inativar produto",
                  );
                }
              }}
            >
              {deactivate.isPending ? "Inativando..." : "Inativar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </EnterpriseDataTable>
  );
}
