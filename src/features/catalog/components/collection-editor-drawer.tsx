import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Copy, Share2, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import type { CollectionWithCount } from "../types";
import { COLLECTION_STATUS_OPTIONS } from "../types";
import {
  useCollectionItems,
  useRemoveCollectionItem,
  useAddCollectionProducts,
} from "../hooks/use-catalog";
import { ProductPickerDialog } from "./product-picker-dialog";
import { ProductThumb, productImagesService } from "@/features/products";
import { useQuery } from "@tanstack/react-query";
import { formatCurrency } from "@/lib/format";
import { offerUndo } from "@/lib/undo-manager";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  collection: CollectionWithCount | null;
}

export function CollectionEditorDrawer({
  open,
  onOpenChange,
  companyId,
  collection,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const { data: items = [] } = useCollectionItems(collection?.id ?? null);
  const removeItem = useRemoveCollectionItem(companyId, collection?.id ?? "");
  const addProducts = useAddCollectionProducts(companyId);

  const paths = items
    .map((it) => (it.product as { cover_image_path?: string | null } | null)?.cover_image_path)
    .filter((p): p is string => !!p);

  const { data: signed = [] } = useQuery({
    queryKey: ["signed-urls", ...paths],
    queryFn: () => productImagesService.signedUrls(paths),
    enabled: paths.length > 0,
    staleTime: 30 * 60 * 1000,
  });

  const publicUrl =
    collection && typeof window !== "undefined"
      ? `${window.location.origin}/catalogo/colecao/${collection.slug}`
      : "";

  async function handleCopy() {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    toast.success("Link copiado");
  }

  async function handleShare() {
    if (!publicUrl) return;
    if (navigator.share) {
      await navigator
        .share({ title: collection?.name ?? "Coleção", url: publicUrl })
        .catch(() => {});
    } else {
      handleCopy();
    }
  }

  const statusLabel = COLLECTION_STATUS_OPTIONS.find(
    (o) => o.value === collection?.status,
  )?.label;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{collection?.name ?? "Coleção"}</SheetTitle>
            <SheetDescription>
              {collection?.description ?? "Gerencie os produtos desta coleção."}
            </SheetDescription>
          </SheetHeader>

          {collection && (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{statusLabel}</Badge>
                <Badge variant="outline">
                  {items.length} produto{items.length === 1 ? "" : "s"}
                </Badge>
              </div>

              <div className="rounded-md border bg-muted/40 p-3">
                <div className="text-xs font-medium text-muted-foreground">
                  Link público
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs">
                    {publicUrl}
                  </code>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={handleCopy}>
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copiar link
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleShare}>
                    <Share2 className="mr-1 h-3.5 w-3.5" /> Compartilhar
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link
                      to="/catalogo/colecao/$slug"
                      params={{ slug: collection.slug }}
                      target="_blank"
                    >
                      <ExternalLink className="mr-1 h-3.5 w-3.5" /> Abrir
                    </Link>
                  </Button>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Produtos</h4>
                <Button size="sm" onClick={() => setPickerOpen(true)}>
                  <Plus className="mr-1 h-4 w-4" /> Adicionar
                </Button>
              </div>

              <div className="divide-y rounded-md border">
                {items.map((it) => {
                  const prod = it.product as {
                    id: string;
                    name: string;
                    brand: string | null;
                    price: number;
                    stock: number;
                    cover_image_path: string | null;
                  } | null;
                  if (!prod) return null;
                  const url =
                    signed.find((s) => s.path === prod.cover_image_path)
                      ?.signedUrl ?? null;
                  return (
                    <div
                      key={it.id}
                      className="flex items-center gap-3 px-3 py-2"
                    >
                      <ProductThumb signedUrl={url} alt={prod.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">
                          {prod.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatCurrency(Number(prod.price))} · Estoque{" "}
                          {Number(prod.stock)}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          const itemId = it.id;
                          const label = prod.name;
                          removeItem.mutate(itemId, {
                            onSuccess: () => {
                              offerUndo({
                                message: `“${label}” removido da coleção`,
                                onUndo: () =>
                                  addProducts.mutateAsync({
                                    collectionId: collection.id,
                                    productIds: [prod.id],
                                  }),
                              });
                            },
                          });
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  );
                })}
                {items.length === 0 && (
                  <div className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Nenhum produto ainda. Clique em “Adicionar”.
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {collection && (
        <ProductPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          companyId={companyId}
          excludeProductIds={
            new Set(items.map((it) => it.product_id).filter(Boolean) as string[])
          }
          onConfirm={(ids) =>
            addProducts.mutateAsync({
              collectionId: collection.id,
              productIds: ids,
            })
          }
        />
      )}
    </>
  );
}
