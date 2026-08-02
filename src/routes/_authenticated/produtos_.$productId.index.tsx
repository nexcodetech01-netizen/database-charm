import { useState } from "react";
import { FramedImage } from "@/components/media/framed-image";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { ProductPricingSheet } from "@/features/pricing";
import { ProductPricingIntelligenceCard } from "@/features/pricing/components/product-pricing-intelligence-card";
import { SuggestedPricesByChannelCard } from "@/features/pricing/components/suggested-prices-by-channel-card";
import { AppliedMarginPolicyCard } from "@/features/pricing/components/applied-margin-policy-card";
import { Calculator, Megaphone } from "lucide-react";
import { SalesCenterDialog } from "@/features/marketing";
import { PublishToMercadoLivreDialog } from "@/features/products/components/publish-to-ml-dialog";
import { MercadoLivreBadge } from "@/features/products/components/mercadolivre-badge";
import { ShoppingBag } from "lucide-react";
import {
  Pencil,
  ImageIcon,
  Trash2,
  Loader2,
  Copy,
  DollarSign,
  Wallet,
  Percent,
  Boxes,
  Truck,
  Tag,
  TrendingUp,
  Package,
  Clock,
  History,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,

} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PauseCircle, PlayCircle, Link2Off, ChevronDown } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

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
import { KpiSection, KpiCard } from "@/components/layout";
import { EntityHeader, Section, LoadingSurface } from "@/components/design";
import { ProductInterestPanel } from "@/features/interests";

import {
  ProductStatusBadge,
  useProduct,
  useSignedImageUrls,
  useDeleteProduct,
} from "@/features/products";
import { useProductMovements } from "@/features/inventory/hooks/use-inventory";
import { MovementTypeBadge } from "@/features/inventory/components/movement-type-badge";
import { MovementFormDialog } from "@/features/inventory/components/movement-form-dialog";
import type { ManualMovementType } from "@/features/inventory/types";

import { useProductFinancials } from "@/features/products/hooks/use-product-financials";
import { ProductCostBreakdown } from "@/features/products/components/product-cost-breakdown";

import { formatCurrency, formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/produtos_/$productId/")({
  beforeLoad: requirePermission("products.view"),
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { productId } = Route.useParams();
  const { company } = Route.useRouteContext();
  const navigate = useNavigate();
  const { data: product, isLoading } = useProduct(productId);
  const deleteProduct = useDeleteProduct();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [salesCenterOpen, setSalesCenterOpen] = useState(false);
  const [mlPublishOpen, setMlPublishOpen] = useState(false);
  const [mlActionPending, setMlActionPending] = useState<null | "pause" | "activate" | "unlink">(null);
  const [unlinkConfirmOpen, setUnlinkConfirmOpen] = useState(false);
  const [movementOpen, setMovementOpen] = useState(false);
  const [movementType, setMovementType] = useState<ManualMovementType>("in");

  const qc = useQueryClient();

  const orderedImages = (product?.images ?? [])
    .slice()
    .sort((a, b) => a.position - b.position);
  const imagePaths = orderedImages.map((i) => i.path);
  const { data: signed = [] } = useSignedImageUrls(imagePaths);
  const cover = signed[0]?.signedUrl;
  const coverImage = orderedImages[0] ?? null;
  const { data: movements = [] } = useProductMovements(productId);
  const financials = useProductFinancials(product);

  const isRemoving = isDeleting || deleteProduct.isPending || deleteProduct.isSuccess;

  if (isLoading || isRemoving) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
        <LoadingSurface variant="detail" rows={6} />
      </div>
    );
  }

  if (!product) throw notFound();

  const handleDelete = async () => {
    const id = product.id;
    setIsDeleting(true);
    setConfirmOpen(false);
    try {
      await deleteProduct.mutateAsync(id);
      await navigate({ to: "/produtos", replace: true });
      toast.success("Produto excluído");
    } catch (err) {
      setIsDeleting(false);
      toast.error(err instanceof Error ? err.message : "Falha ao excluir");
    }
  };

  // Fonte única da verdade — todos os blocos financeiros da página consomem
  // este objeto (Header, Precificação, Estoque).
  const {
    cost,
    freight,
    insurance,
    otherCosts,
    price,
    costTotal,
    grossProfit: profit,
    markupPct: markup,
    stock,
    minStock,
    stockValue,
    marginPctReal,
  } = financials!;

  // Margem exibida = (Preço − Custo Total) / Preço, com arredondamento
  // matemático padrão em 2 casas (evita truncamento tipo 47,40% vs 47,49%).
  const margin = Math.round(marginPctReal * 100) / 100;


  // Estoque: reservado / máx / última entrada / última venda (derivados de movements)
  const reserved = movements
    .filter((m) => m.type === "reservation")
    .reduce((acc, m) => acc + Number(m.quantity ?? 0), 0);
  const lastIn = movements.find((m) => m.type === "in" || m.source === "purchase");
  const lastOut = movements.find((m) => m.type === "out" || m.source === "sale");


  const meta = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {product.sku ? (
        <span className="font-mono">SKU {product.sku}</span>
      ) : null}
      {product.category?.name ? (
        <span className="inline-flex items-center gap-1">
          <Tag className="h-3 w-3" />
          {product.category.name}
        </span>
      ) : null}
      {product.supplier?.name ? (
        <span className="inline-flex items-center gap-1">
          <Truck className="h-3 w-3" />
          {product.supplier.name}
        </span>
      ) : null}
      <ProductStatusBadge status={product.status} />
      <MercadoLivreBadge
        mlItemId={(product as { ml_item_id: string | null }).ml_item_id}
        permalink={(product as { ml_permalink: string | null }).ml_permalink}
      />
    </div>
  );

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => setSalesCenterOpen(true)}>
        <Megaphone className="mr-1.5 h-4 w-4" /> Vender este produto
      </Button>
      <Button variant="outline" size="sm" onClick={() => setPricingOpen(true)}>
        <Calculator className="mr-1.5 h-4 w-4" /> Calcular preço
      </Button>
      <Button variant="outline" size="sm" onClick={() => setMlPublishOpen(true)}>
        <ShoppingBag className="mr-1.5 h-4 w-4" />
        {(product as { ml_item_id: string | null }).ml_item_id
          ? "Reanunciar no ML"
          : "Anunciar no Mercado Livre"}
      </Button>
      {(product as { ml_item_id: string | null }).ml_item_id ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              disabled={mlActionPending !== null}
              aria-label="Gerenciar anúncio no Mercado Livre"
            >
              Gerenciar ML <ChevronDown className="ml-1 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={mlActionPending !== null}
              onClick={async () => {
                setMlActionPending("pause");
                try {
                  const { setMercadoLivreItemStatus } = await import(
                    "@/lib/mercadolivre-actions.functions"
                  );
                  await setMercadoLivreItemStatus({
                    data: { productId: product.id, status: "paused" },
                  });
                  toast.success("Anúncio pausado no Mercado Livre");
                } catch (e) {
                  toast.error("Não foi possível pausar o anúncio", {
                    description: e instanceof Error ? e.message : undefined,
                  });
                } finally {
                  setMlActionPending(null);
                }
              }}
            >
              <PauseCircle className="mr-2 h-4 w-4" /> Pausar anúncio
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={mlActionPending !== null}
              onClick={async () => {
                setMlActionPending("activate");
                try {
                  const { setMercadoLivreItemStatus } = await import(
                    "@/lib/mercadolivre-actions.functions"
                  );
                  await setMercadoLivreItemStatus({
                    data: { productId: product.id, status: "active" },
                  });
                  toast.success("Anúncio reativado no Mercado Livre");
                } catch (e) {
                  toast.error("Não foi possível reativar o anúncio", {
                    description: e instanceof Error ? e.message : undefined,
                  });
                } finally {
                  setMlActionPending(null);
                }
              }}
            >
              <PlayCircle className="mr-2 h-4 w-4" /> Reativar anúncio
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={mlActionPending !== null}
              onSelect={(e) => {
                e.preventDefault();
                setUnlinkConfirmOpen(true);
              }}
              className="text-danger focus:text-danger"
            >
              <Link2Off className="mr-2 h-4 w-4" /> Limpar vínculo ML
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <Button asChild variant="default" size="sm">
        <Link to="/produtos/$productId/editar" params={{ productId: product.id }}>
          <Pencil className="mr-1.5 h-4 w-4" /> Editar
        </Link>
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          navigate({
            to: "/produtos/novo",
            search: { duplicateFrom: product.id },
          })
        }
        aria-label="Duplicar produto"
      >
        <Copy className="mr-1.5 h-4 w-4" /> Duplicar
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={() => setConfirmOpen(true)}
        disabled={deleteProduct.isPending}
        className="text-danger hover:text-danger"
      >
        <Trash2 className="mr-1.5 h-4 w-4" /> Excluir
      </Button>
    </div>
  );

  // Layout local: cards mais largos (auto-fit), altura uniforme e valores
  // monetários/unidade sem quebra de linha; hint (ex.: Markup) exibido por
  // completo. Não afeta o KpiCard/KpiSection compartilhados.
  const kpiCardClass = cn(
    "h-full",
    "[&_p.tabular-nums]:whitespace-nowrap",
    "[&_span.truncate]:whitespace-normal [&_span.truncate]:overflow-visible [&_span.truncate]:text-clip",
  );
  // Produto sem preço cadastrado: não calcular "prejuízo" — exibir "A definir".
  const hasPrice = price > 0;
  const kpis = (
    <KpiSection
      columns={5}
      className="auto-rows-fr sm:grid-cols-[repeat(auto-fit,minmax(200px,1fr))] lg:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
    >
      <KpiCard
        className={kpiCardClass}
        label="Preço de venda"
        value={hasPrice ? formatCurrency(price) : "A definir"}
        icon={DollarSign}
        hint={
          hasPrice
            ? product.unit
              ? `por ${product.unit}`
              : undefined
            : "Preço ainda não cadastrado"
        }
      />
      <KpiCard
        className={kpiCardClass}
        label="Custo total"
        value={formatCurrency(costTotal)}
        icon={Wallet}
      />
      <KpiCard
        className={kpiCardClass}
        label="Margem de Lucro"
        value={hasPrice ? `${formatPercent(margin)}%` : "A definir"}
        icon={Percent}
        hint={
          hasPrice
            ? "Percentual do preço de venda que representa lucro."
            : "Defina o preço de venda para calcular a margem."
        }
      />
      <KpiCard
        className={kpiCardClass}
        label="Lucro Unitário"
        value={hasPrice ? formatCurrency(profit) : "A definir"}
        icon={TrendingUp}
        hint={
          hasPrice ? (
            <span className="flex flex-col gap-0.5 text-xs">
              <span>Custo Total: {formatCurrency(costTotal)}</span>
              <span>Preço de Venda: {formatCurrency(price)}</span>
              <span className={profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                Lucro Unitário: {formatCurrency(profit)}
              </span>
            </span>
          ) : (
            "Defina o preço de venda para calcular o lucro."
          )
        }
      />

      <KpiCard
        className={kpiCardClass}
        label="Estoque disponível"
        value={`${formatNumber(stock)} ${product.unit ?? ""}`.trim()}
        icon={Boxes}
        hint={stock <= minStock ? "Abaixo do mínimo" : undefined}
      />
    </KpiSection>
  );


  return (
    <>
    <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
      <EntityHeader
        icon={Package}
        title={product.name}
        description={product.brand || undefined}
        actions={actions}
        extra={
          <div className="space-y-4">
            {meta}
            {kpis}
          </div>
        }
      />

      <Tabs defaultValue="visao" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="visao">Visão geral</TabsTrigger>
          <TabsTrigger value="precificacao">Precificação</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="visao" className="space-y-6">
      {/* Informações principais — reconstruído: foto 35% + dados 65% */}
      <Section flushBody bodyClassName="p-6 lg:p-8">



          <div className="grid gap-8 lg:grid-cols-[39%_minmax(0,1fr)] lg:gap-10">
            {/* Coluna esquerda: foto */}
            <div className="space-y-3">
              <FramedImage
                src={cover}
                alt={product.name}
                framing={coverImage}
                aspect="square"
                rounded="2xl"
                fallback={<ImageIcon className="h-10 w-10" />}
              />
              {signed.length > 1 ? (
                <div className="flex flex-wrap gap-2">
                  {signed.slice(0, 5).map((s) => {
                    const img = orderedImages.find((i) => i.path === s.path);
                    return (
                      <div key={s.path} className="w-14">
                        <FramedImage
                          src={s.signedUrl}
                          framing={img}
                          aspect="square"
                          rounded="md"
                          containerClassName="border border-border"
                        />
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>

            {/* Coluna direita: dados do produto */}
            <div className="min-w-0">
              <div className="mb-5">
                <h2 className="text-base font-semibold text-foreground">Informações</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Dados de identificação e catálogo.
                </p>
              </div>

              <dl className="divide-y divide-border/40">
                <InfoRow label="SKU" value={product.sku ?? "—"} mono />
                <InfoRow label="Categoria" value={product.category?.name ?? "—"} />
                <InfoRow label="Fornecedor" value={product.supplier?.name ?? "—"} />
                <InfoRow label="Marca" value={product.brand ?? "—"} />
                <InfoRow label="Código de barras" value={product.barcode ?? "—"} mono />
                <InfoRow label="Unidade" value={product.unit} />
                <InfoRow
                  label="Estoque"
                  value={`${formatNumber(stock)} ${product.unit ?? ""}`.trim()}
                />
                <InfoRow label="Peso" value="—" />
                <InfoRow label="Dimensões" value="—" />
                <InfoRow label="NCM" value={product.ncm ?? "—"} mono />
                <InfoRow label="Origem" value="—" />
                <InfoRow label="Canal de venda" value={product.sales_channel ?? "—"} />
                <InfoRow label="Status" value={<ProductStatusBadge status={product.status} />} />
                <InfoRow
                  label="Tags"
                  value={
                    product.tags?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {product.tags.map((t) => (
                          <span
                            key={t}
                            className="rounded-md bg-accent px-2 py-0.5 text-[11px] text-muted-foreground"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      "—"
                    )
                  }
                />
              </dl>

              {product.description ? (
                <div className="mt-6 border-t border-border pt-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Descrição
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                    {product.description}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
      </Section>

      {/* Lista de Interesse — clientes aguardando este produto */}
      <ProductInterestPanel
        companyId={company.id}
        productId={product.id}
        stock={Number(stock) || 0}
      />
        </TabsContent>

        <TabsContent value="estoque" className="space-y-6">
      {/* Estoque */}
      <Section


            title="Estoque"
            description="Disponibilidade, limites e valor imobilizado."
            actions={
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setMovementType("in");
                    setMovementOpen(true);
                  }}
                >
                  <ArrowUpRight className="mr-1.5 h-4 w-4" /> Entrada de estoque
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setMovementType("adjustment");
                    setMovementOpen(true);
                  }}
                >
                  <Boxes className="mr-1.5 h-4 w-4" /> Ajustar estoque
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link to="/estoque/produto/$productId" params={{ productId: product.id }}>
                    <History className="mr-1.5 h-4 w-4" /> Ver movimentações
                  </Link>
                </Button>
              </div>
            }
          >
            {stock <= 0 ? (
              <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" /> Produto sem estoque.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Este produto não poderá ser vendido até que uma entrada ou ajuste
                  de estoque seja realizado.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setMovementType("in");
                      setMovementOpen(true);
                    }}
                  >
                    <ArrowUpRight className="mr-1.5 h-4 w-4" /> Entrada de estoque
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMovementType("adjustment");
                      setMovementOpen(true);
                    }}
                  >
                    <Boxes className="mr-1.5 h-4 w-4" /> Ajustar estoque
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <PriceTile
                label="Disponível"
                value={`${formatNumber(stock)} ${product.unit ?? ""}`.trim()}
                icon={Package}
                intent={stock <= minStock ? "negative" : "neutral"}
              />
              <PriceTile
                label="Reservado"
                value={`${formatNumber(reserved)} ${product.unit ?? ""}`.trim()}
                icon={Boxes}
              />
              <PriceTile
                label="Estoque mínimo"
                value={`${formatNumber(minStock)} ${product.unit ?? ""}`.trim()}
                icon={Boxes}
              />
              <PriceTile label="Estoque máximo" value="—" icon={Boxes} />
              <PriceTile
                label="Valor em estoque"
                value={formatCurrency(stockValue)}
                icon={Wallet}
              />
              <PriceTile
                label="Última entrada"
                value={lastIn ? formatDateTime(lastIn.movement_date) : "—"}
                icon={ArrowUpRight}
                intent={lastIn ? "positive" : "neutral"}
              />
              <PriceTile
                label="Última venda"
                value={lastOut ? formatDateTime(lastOut.movement_date) : "—"}
                icon={ArrowDownRight}
                intent={lastOut ? "negative" : "neutral"}
              />
              <PriceTile
                label="Última atualização"
                value={formatDateTime(product.updated_at)}
                icon={Clock}
              />
            </div>
      </Section>


      {/* Política de margem aplicada — categoria vs personalizada */}
      <AppliedMarginPolicyCard
        categoryName={product.category?.name ?? null}
        categoryTargetMarginPct={
          (product.category as { target_margin_pct?: number | null } | null | undefined)
            ?.target_margin_pct ?? null
        }
        categoryMinMarginPct={
          (product.category as { min_margin_pct?: number | null } | null | undefined)
            ?.min_margin_pct ?? null
        }
        categoryDefaultDiscountPct={
          (product.category as { default_discount_pct?: number | null } | null | undefined)
            ?.default_discount_pct ?? null
        }
        productMarginPct={margin}
        useCategoryMargin={
          (product as { use_category_margin?: boolean | null }).use_category_margin ?? false
        }
      />

      {/* Lista de Interesse — clientes aguardando este produto */}
      <ProductInterestPanel
        companyId={company.id}
        productId={product.id}
        stock={Number(stock) || 0}
      />

      {/* Inteligência Comercial — política aplicada e sugestão de preço */}
      <ProductPricingIntelligenceCard
        companyId={company.id}
        productId={product.id}
      />

      {/* Sugestão automática por canal (Loja, Site, ML, Shopee, Amazon) */}
      <SuggestedPricesByChannelCard
        companyId={company.id}
        productId={product.id}
      />


      {/* Custos operacionais e precificação */}
      <ProductCostBreakdown productId={product.id} product={product} />




      {/* Movimentações */}
      <Section

            title="Movimentações"
            description="Últimos eventos de estoque, compras e vendas deste produto."
            actions={
              <Button asChild variant="outline" size="sm" className="mt-2 w-full sm:w-auto">
                <Link to="/estoque/produto/$productId" params={{ productId: product.id }}>
                  <History className="mr-1.5 h-4 w-4" /> Ver todas
                </Link>
              </Button>
            }
          >
            {movements.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhuma movimentação registrada até o momento.
              </div>
            ) : (
              <ol className="relative space-y-3 border-l border-border pl-5">
                {movements.slice(0, 8).map((m) => {
                  const qty = Number(m.quantity ?? 0);
                  return (
                    <li key={m.id} className="relative">
                      <span className="absolute -left-[27px] top-1.5 grid h-4 w-4 place-items-center rounded-full border border-border bg-card">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      </span>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <MovementTypeBadge type={m.type} />
                          <span className="text-sm text-foreground">
                            {m.reason ?? m.source ?? "Movimento"}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span
                            className={cn(
                              "font-medium tabular-nums",
                              qty > 0
                                ? "text-emerald-600 dark:text-emerald-400"
                                : qty < 0
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-foreground",
                            )}
                          >
                            {qty > 0 ? "+" : ""}
                            {formatNumber(qty)} {product.unit ?? ""}
                          </span>
                          <span className="text-muted-foreground">
                            {formatDateTime(m.movement_date)}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
      </Section>


      {/* Histórico */}
      <Section

            title="Histórico"
            description="Eventos recentes deste produto."
          >
            <ol className="relative space-y-4 border-l border-border pl-5">
              <TimelineItem
                icon={Package}
                title="Produto criado"
                description={formatDateTime(product.created_at)}
              />
              <TimelineItem
                icon={Clock}
                title="Última atualização"
                description={formatDateTime(product.updated_at)}
              />
              <li className="relative">
                <span className="absolute -left-[27px] top-1 grid h-4 w-4 place-items-center rounded-full border border-border bg-muted">
                  <History className="h-2.5 w-2.5 text-muted-foreground" />
                </span>
                <p className="text-xs text-muted-foreground">
                  Movimentações de estoque, vendas e compras aparecerão aqui conforme os
                  módulos forem sendo utilizados.
                </p>
              </li>
            </ol>
      </Section>


      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. O produto <strong>{product.name}</strong> será removido
              do catálogo. Movimentações de estoque, vendas e compras já registradas
              serão preservadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteProduct.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteProduct.isPending}
              className="bg-danger text-danger-foreground hover:bg-danger/90"
            >
              {deleteProduct.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={unlinkConfirmOpen} onOpenChange={setUnlinkConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar vínculo com o Mercado Livre?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove apenas o vínculo local (ml_item_id, permalink e data
              de publicação). O anúncio no Mercado Livre <strong>não</strong> é
              excluído. Use quando o anúncio foi removido ou moderado no ML e você
              precisa publicá-lo novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={mlActionPending === "unlink"}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mlActionPending === "unlink"}
              onClick={async (e) => {
                e.preventDefault();
                setMlActionPending("unlink");
                try {
                  const { unlinkMercadoLivreItem } = await import(
                    "@/lib/mercadolivre-actions.functions"
                  );
                  await unlinkMercadoLivreItem({
                    data: { productId: product.id },
                  });
                  toast.success("Vínculo com Mercado Livre removido");
                  void qc.invalidateQueries({ queryKey: ["products"] });
                  void qc.invalidateQueries({ queryKey: ["product", product.id] });
                  setUnlinkConfirmOpen(false);
                } catch (err) {
                  toast.error("Não foi possível limpar o vínculo", {
                    description: err instanceof Error ? err.message : undefined,
                  });
                } finally {
                  setMlActionPending(null);
                }
              }}
            >
              Limpar vínculo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
    <MovementFormDialog
      open={movementOpen}
      onOpenChange={setMovementOpen}
      companyId={company.id}
      defaultProductId={product.id}
      defaultType={movementType}
      lockProduct
      lockedProductLabel={product.name}
    />
    <ProductPricingSheet

      open={pricingOpen}
      onOpenChange={setPricingOpen}
      companyId={company.id}
      product={{
        id: product.id,
        name: product.name,
        cost: product.cost,
        freight: product.freight,
        insurance: product.insurance,
        other_costs: product.other_costs,
        price: product.price,
      }}
    />
    <SalesCenterDialog
      open={salesCenterOpen}
      onOpenChange={setSalesCenterOpen}
      product={{
        name: product.name,
        brand: product.brand,
        description: product.description,
        price: Number(product.price),
        unit: product.unit,
        tags: product.tags,
        category: product.category ? { name: product.category.name } : null,
        cover_image_path: product.cover_image_path ?? null,
      }}
    />
    <PublishToMercadoLivreDialog
      product={product}
      open={mlPublishOpen}
      onOpenChange={setMlPublishOpen}
    />
    </>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className="grid grid-cols-[10rem_minmax(0,1fr)] items-start gap-x-8 py-3">
      <dt className="pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "min-w-0 break-words text-sm leading-relaxed text-foreground",
          mono && "font-mono",
        )}
      >
        {value}
      </dd>
    </div>
  );
}


function PriceTile({
  label,
  value,
  icon: Icon,
  highlight,
  intent = "neutral",
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  highlight?: boolean;
  intent?: "positive" | "negative" | "neutral";
}) {
  const intentTone =
    intent === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : intent === "negative"
        ? "text-red-600 dark:text-red-400"
        : "text-foreground";
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        highlight
          ? "border-primary/40 bg-primary/5"
          : "border-border bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
        <span className="line-clamp-2 min-w-0 flex-1">{label}</span>
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            highlight ? "text-primary" : "text-muted-foreground",
          )}
        />
      </div>
      <p
        className={cn(
          "mt-1.5 font-semibold tabular-nums break-words",
          highlight ? "text-primary text-lg sm:text-xl" : "text-base",
          !highlight && intentTone,
        )}
      >
        {value}
      </p>
    </div>
  );
}

function TimelineItem({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <li className="relative">
      <span className="absolute -left-[27px] top-1 grid h-4 w-4 place-items-center rounded-full border border-primary/40 bg-primary/10">
        <Icon className="h-2.5 w-2.5 text-primary" />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="text-xs text-muted-foreground">{description}</p>
    </li>
  );
}
