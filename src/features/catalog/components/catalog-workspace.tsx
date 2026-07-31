import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/layout";
import {
  Plus,
  MoreVertical,
  Pencil,
  Trash2,
  Copy,
  ExternalLink,
  LayoutGrid,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  useUpdateCollection,
} from "../hooks/use-catalog";
import type { Collection, CollectionWithCount } from "../types";
import { COLLECTION_STATUS_OPTIONS } from "../types";
import { CollectionFormDialog } from "./collection-form-dialog";
import { CollectionEditorDrawer } from "./collection-editor-drawer";
import { CatalogBellaHint } from "./catalog-bella-hint";
import { offerUndo } from "@/lib/undo-manager";

interface Props {
  companyId: string;
}

export function CatalogWorkspace({ companyId }: Props) {
  const { data: collections = [], isLoading } = useCollections(companyId);
  const create = useCreateCollection(companyId);
  const update = useUpdateCollection(companyId);
  const remove = useDeleteCollection(companyId);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Collection | null>(null);
  const [drawerCol, setDrawerCol] = useState<CollectionWithCount | null>(null);

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(c: Collection) {
    setEditing(c);
    setFormOpen(true);
  }

  async function copyLink(slug: string) {
    const url = `${window.location.origin}/catalogo/colecao/${slug}`;
    await navigator.clipboard.writeText(url);
    toast.success("Link copiado");
  }

  return (
    <div className="space-y-4">
      <CatalogBellaHint companyId={companyId} onOpen={openNew} />

      <Card>
        <CardHeader className="flex flex-col gap-2 pb-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Coleções do catálogo</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Agrupe produtos existentes em coleções compartilháveis. Preço,
              estoque e imagens são reutilizados em tempo real.
            </p>
          </div>
          <Button size="sm" onClick={openNew}>
            <Plus className="mr-1 h-4 w-4" /> Nova coleção
          </Button>
        </CardHeader>

        <CardContent className="pt-0">
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-full" />
              ))}
            </div>
          ) : collections.length === 0 ? (
            <EmptyState
              icon={LayoutGrid}
              title="Nenhuma coleção ainda"
              description="Crie a primeira coleção para começar a compartilhar produtos."
              className="py-12"
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {collections.map((c) => {
                const statusLabel = COLLECTION_STATUS_OPTIONS.find(
                  (o) => o.value === c.status,
                )?.label;
                return (
                  <div
                    key={c.id}
                    className="group relative flex flex-col overflow-hidden rounded-lg border bg-card"
                  >
                    <button
                      onClick={() => setDrawerCol(c)}
                      className="relative aspect-[16/9] w-full overflow-hidden bg-muted text-left"
                    >
                      {c.cover_url ? (
                        <img
                          src={c.cover_url}
                          alt={c.name}
                          className="h-full w-full object-cover transition group-hover:scale-105"
                          loading="lazy"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center">
                          <LayoutGrid className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                    </button>

                    <div className="flex flex-1 flex-col gap-2 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          onClick={() => setDrawerCol(c)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="truncate text-sm font-semibold">
                            {c.name}
                          </div>
                          {c.description && (
                            <div className="line-clamp-2 text-xs text-muted-foreground">
                              {c.description}
                            </div>
                          )}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-7 w-7">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(c)}>
                              <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => copyLink(c.slug)}>
                              <Copy className="mr-2 h-3.5 w-3.5" /> Copiar link
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                const snapshot = c;
                                remove.mutate(c.id, {
                                  onSuccess: () =>
                                    offerUndo({
                                      message: `Coleção “${c.name}” removida`,
                                      onUndo: async () => {
                                        await create.mutateAsync({
                                          company_id: companyId,
                                          name: snapshot.name,
                                          description: snapshot.description,
                                          cover_url: snapshot.cover_url,
                                          status: snapshot.status,
                                          scheduled_at: snapshot.scheduled_at,
                                        });
                                      },
                                    }),
                                });
                              }}
                              className="text-destructive"
                            >
                              <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge variant="secondary" className="text-[10px]">
                            {statusLabel}
                          </Badge>
                          <Badge variant="outline" className="text-[10px]">
                            {c.product_count} produto
                            {c.product_count === 1 ? "" : "s"}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          asChild
                          className="h-7 px-2 text-xs"
                        >
                          <Link
                            to="/catalogo/colecao/$slug"
                            params={{ slug: c.slug }}
                            target="_blank"
                          >
                            <ExternalLink className="mr-1 h-3 w-3" /> Ver
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CollectionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        companyId={companyId}
        editing={editing}
        onSubmit={async (values) => {
          if (values.mode === "create") {
            await create.mutateAsync(values.input);
            toast.success("Coleção criada");
          } else {
            await update.mutateAsync({
              id: values.id,
              patch: values.patch,
              rename: values.rename,
            });
            toast.success("Coleção atualizada");
          }
        }}
      />

      <CollectionEditorDrawer
        open={!!drawerCol}
        onOpenChange={(v) => !v && setDrawerCol(null)}
        companyId={companyId}
        collection={drawerCol}
      />
    </div>
  );
}
