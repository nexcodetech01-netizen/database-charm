import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Package, ShoppingBag, MoreHorizontal, PowerOff } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { formatCurrency, formatNumber } from "@/lib/format";
import { ProductStatusBadge } from "./product-status-badge";
import { ProductThumb } from "./product-thumb";
import { MercadoLivreBadge } from "./mercadolivre-badge";
import { PublishToMercadoLivreDialog } from "./publish-to-ml-dialog";
import { useSignedImageUrls, useDeactivateProduct } from "../hooks/use-products";
import type { Product } from "../types";


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
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [publishTarget, setPublishTarget] = useState<Product | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Product | null>(null);
  const deactivate = useDeactivateProduct();


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

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[64px]">Foto</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Fornecedor</TableHead>
              <TableHead className="text-right">Preço</TableHead>
              <TableHead className="text-right">Estoque</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16">
                  <div className="flex flex-col items-center gap-2 text-center text-muted-foreground">
                    <Package className="h-8 w-8" />
                    <p className="font-medium text-foreground">Nenhum produto encontrado</p>
                    <p className="text-sm">Ajuste os filtros ou cadastre um novo produto.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => {
                const low = Number(p.stock) <= Number(p.min_stock);
                const path = (p as Row & { cover_image_path?: string | null }).cover_image_path ?? null;
                const url = path ? urlByPath.get(path) ?? null : null;
                const mlItemId = (p as Product & { ml_item_id?: string | null }).ml_item_id ?? null;
                const mlPermalink = (p as Product & { ml_permalink?: string | null }).ml_permalink ?? null;
                return (
                  <TableRow key={p.id} className="cursor-pointer">
                    <TableCell>
                      <ProductThumb signedUrl={url} alt={p.name} size="sm" />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Link
                          to="/produtos/$productId"
                          params={{ productId: p.id }}
                          className="font-medium hover:text-primary"
                        >
                          {p.name}
                        </Link>
                        <MercadoLivreBadge mlItemId={mlItemId} permalink={mlPermalink} compact />
                      </div>
                      {p.brand ? (
                        <p className="text-xs text-muted-foreground">{p.brand}</p>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{p.sku ?? "—"}</TableCell>
                    <TableCell className="text-sm">{p.category?.name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{p.supplier?.name ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(Number(p.price))}
                    </TableCell>
                    <TableCell className={`text-right tabular-nums ${low ? "text-warning font-medium" : ""}`}>
                      {formatNumber(Number(p.stock))} {p.unit}
                    </TableCell>
                    <TableCell><ProductStatusBadge status={p.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPublishTarget(p as Product);
                          }}
                          title={mlItemId ? "Reanunciar no Mercado Livre" : "Anunciar no Mercado Livre"}
                        >
                          <ShoppingBag className="mr-1.5 h-4 w-4" />
                          {mlItemId ? "Reanunciar" : "Anunciar no ML"}
                        </Button>
                        {p.status === "active" ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => e.stopPropagation()}
                                title="Mais ações"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
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
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    </TableCell>

                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          {total > 0
            ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} de ${total}`
            : "0 resultados"}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            Anterior
          </Button>
          <span className="text-muted-foreground">Página {page} de {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Próxima
          </Button>
        </div>
      </div>

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
    </div>
  );

}
