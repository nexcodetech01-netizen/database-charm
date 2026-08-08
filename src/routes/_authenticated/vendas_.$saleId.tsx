import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Receipt,
  User,
  Calendar,
  CreditCard,
  MessageCircle,
  Printer,
  MoreHorizontal,
  Wallet,
  FileText,
  ExternalLink,
  Copy,
  ShoppingBag,
  TrendingUp,
  Percent,
  DollarSign,
  RotateCcw,
  Ban,
  CopyPlus,
  PlayCircle,
  Loader2,
} from "lucide-react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateSale, type SaleUpdate } from "@/features/sales";


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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  PageLayout,
  KpiSection,
  KpiCard,
  DetailPanel,
  SummaryRow,
  EmptyState,
} from "@/components/layout";
import {
  SaleStatusBadge,
  SaleTimeline,
  SALE_PAYMENT_METHODS,
  salesKeys,
  useSale,
  useSetSaleStatus,
  CheckoutDialog,
  TestSaleBadge,
} from "@/features/sales";

import { ReceiptDialog } from "@/features/sales/components/receipt-dialog";
import { ReturnDialog, ReturnsList } from "@/features/returns";
import { useCustomer } from "@/features/customers/hooks/use-customers";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/format";
import { CreditAccountPanel, useCreditDetailBySale } from "@/features/credit";
import { SaleFiscalCard } from "@/features/fiscal/v2/components/sale-fiscal-card";
import { MercadoLivrePrintDialog } from "@/features/mercadolivre/components/mercadolivre-print-dialog";
import { getMercadoLivreOrderLabel } from "@/lib/mercadolivre.functions";



export const Route = createFileRoute("/_authenticated/vendas_/$saleId")({
  beforeLoad: requirePermission("sales.view"),
  component: SaleDetailPage,
});

function SaleDetailPage() {
  const { saleId } = Route.useParams();
  const { company } = Route.useRouteContext();
  const { data: sale, isLoading } = useSale(saleId);
  const { data: customer } = useCustomer(sale?.customer_id ?? "");



  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (!sale) throw notFound();

  return (
    <SaleWorkspace
      sale={sale}
      customer={customer ?? null}
      companyId={company.id}
    />
  );
}


function CreditSummaryItems({ saleId }: { saleId: string }) {
  const { data: creditDetail } = useCreditDetailBySale(saleId);
  
  const downPayment = Number(creditDetail?.account?.down_payment ?? 0);
  const balance = Number(creditDetail?.account?.balance ?? 0);

  return (
    <>
      <SummaryRow
        label="Valor Pago (Entrada)"
        value={formatCurrency(downPayment)}
        mono
        className="text-success"
      />
      <SummaryRow
        label="Saldo Devedor / Restante"
        value={formatCurrency(balance)}
        mono
        className="font-bold text-destructive"
      />
    </>
  );
}

function SaleWorkspace({
  sale,
  customer,
  companyId,
}: {
  sale: NonNullable<ReturnType<typeof useSale>["data"]>;
  customer: ReturnType<typeof useCustomer>["data"] | null;
  companyId: string;
}) {
  const [copied, setCopied] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [editPaymentOpen, setEditPaymentOpen] = useState(false);
  const navigate = useNavigate();
  const setStatusMut = useSetSaleStatus();
  const updateSaleMut = useUpdateSale();
  const qc = useQueryClient();

  const [mlPrintOpen, setMlPrintOpen] = useState(false);
  const [mlLabelData, setMlLabelData] = useState<{ type: "pdf" | "zpl"; content: string; id: string } | null>(null);
  const [isFetchingLabel, setIsFetchingLabel] = useState(false);



  // PDV-009 — Ciclo de vida da venda determina quais ações estão disponíveis.
  const isDraft = sale.status === "draft";
  const isPending = sale.status === "pending";
  const isPaid = sale.status === "paid";
  const isCancelled = sale.status === "cancelled";
  const canEdit = isDraft || isPending;
  const canPay = isDraft || isPending;
  const canCancel = isDraft || isPending || isPaid;
  const canDuplicate = isCancelled || isPaid;
  const canReturn = isPaid;

  // Navegação programática para o PDV/POS em modo edição. Usada tanto pelo
  // botão "Continuar venda" quanto pela opção "Editar venda" do menu.
  // Substitui o `Link` dentro de `DropdownMenuItem asChild` — em alguns
  // browsers o `onSelect` do Radix cancela o clique do Link antes do router
  // interceptar, resultando em "botão que não faz nada".
  function openPosEditor() {
    navigate({
      to: "/vendas/$saleId/editar",
      params: { saleId: sale.id },
    });
  }

  async function handleCancelSale() {
    const reason = cancelReason.trim();
    if (!reason) {
      toast.error("Informe o motivo do cancelamento.");
      return;
    }
    try {
      await setStatusMut.mutateAsync({
        id: sale.id,
        status: "cancelled",
        reason,
      });
      toast.success("Venda cancelada");
      setCancelOpen(false);
      setCancelReason("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível cancelar a venda.");
    }
  }

  function handleDuplicate() {
    // Duplicação = abrir nova venda. Mantém rastreabilidade pela venda original.
    navigate({ to: "/vendas/novo" });
  }

  async function handlePrintMlLabel() {
    const mlOrderId = sale.metadata?.ml_order_id;
    if (!mlOrderId) {
      toast.error("Esta venda não possui um ID de pedido do Mercado Livre associado.");
      return;
    }

    setIsFetchingLabel(true);
    try {
      const label = await getMercadoLivreOrderLabel({ data: { mlOrderId } });
      setMlLabelData({ ...label, id: sale.id });
      setMlPrintOpen(true);
    } catch (error) {
      console.error("Erro ao buscar etiqueta ML:", error);
      toast.error("Falha ao buscar etiqueta: " + (error instanceof Error ? error.message : "Indisponível"));
    } finally {
      setIsFetchingLabel(false);
    }
  }



  const paymentLabel = useMemo(() => {
    if (sale.status === "pending" && !sale.payment_method) {
      return "Pagamento Pendente";
    }
    return (
      SALE_PAYMENT_METHODS.find((p) => p.value === sale.payment_method)?.label ??
      sale.payment_method ??
      "—"
    );
  }, [sale.status, sale.payment_method]);

  // PDV-010 — busca cobrança Bella Pay para exibir parcelamento na aba Pagamento.
  const { data: bellaCharge } = useQuery({
    queryKey: ["bella-pay", "charge-by-sale", sale.id],
    enabled: Boolean(sale.bella_pay_ref),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bella_pay_charges")
        .select(
          "id, asaas_id, billing_type, value, original_value, installment_count, installment_value, net_value, status, invoice_url, updated_at",
        )
        .eq("sale_id", sale.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });


  // BUG-PDV-011 — deps primitivas para evitar recomputo/render em cascata
  // caso `sale` mude de referência sem mudança real de conteúdo (refetch TQ).
  const itemsTotal = Number(sale.items_total ?? 0);
  const discountVal = Number(sale.discount ?? 0);
  const shippingVal = Number(sale.shipping ?? 0);
  const grandVal = Number(sale.grand_total ?? 0);
  const financials = useMemo(() => {
    // FIN-006 — Custo agora vem do snapshot persistido em sale_items.unit_cost
    // (gravado por `salesService.buildItemRow` no rascunho e edições). Se
    // NENHUM item tiver custo (venda antiga anterior ao snapshot ou item
    // avulso sem produto), mantemos a UX de "Custo indisponível".
    let cost = 0;
    let hasCost = false;
    for (const it of sale.items) {
      const unitCost = it.unit_cost != null ? Number(it.unit_cost) : null;
      if (unitCost != null && unitCost > 0) {
        hasCost = true;
        cost += unitCost * Number(it.quantity ?? 0);
      }
    }
    const profit = hasCost ? grandVal - cost : null;
    const margin = hasCost && grandVal > 0 ? ((grandVal - cost) / grandVal) * 100 : null;
    return {
      subtotal: itemsTotal,
      discount: discountVal,
      shipping: shippingVal,
      grand: grandVal,
      cost,
      hasCost,
      profit,
      margin,
    };
  }, [itemsTotal, discountVal, shippingVal, grandVal, sale.items]);


  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  }

  const meta = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1 font-mono">
        <Receipt className="h-3.5 w-3.5" /> {sale.number}
      </span>
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1">
        <Calendar className="h-3.5 w-3.5" /> {formatDate(sale.sale_date)}
      </span>
      <span aria-hidden>·</span>
      <span className="inline-flex items-center gap-1">
        <User className="h-3.5 w-3.5" />{" "}
        {sale.customer_name ?? "Consumidor final"}
      </span>
      {sale.payment_method || (sale.status === "pending") ? (
        <>
          <span aria-hidden>·</span>
          <span className="inline-flex items-center gap-1">
            <CreditCard className="h-3.5 w-3.5" /> {paymentLabel}
          </span>
        </>
      ) : null}
      <SaleStatusBadge status={sale.status} />
    </div>
  );

  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link to="/vendas">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Vendas
        </Link>
      </Button>

      {sale.metadata?.ml_order_id && (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handlePrintMlLabel}
          disabled={isFetchingLabel}
          className="border-yellow-500/50 bg-yellow-500/5 text-yellow-700 hover:bg-yellow-500/10 dark:text-yellow-400"
        >
          {isFetchingLabel ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Printer className="mr-1.5 h-4 w-4" />
          )}
          Etiqueta ML
        </Button>
      )}

      {isPaid ? (
        <Button variant="outline" size="sm" onClick={() => setReceiptOpen(true)}>
          <Printer className="mr-1.5 h-4 w-4" /> Imprimir cupom
        </Button>
      ) : null}


      {canReturn ? (
        <Button variant="outline" size="sm" onClick={() => setReturnOpen(true)}>
          <RotateCcw className="mr-1.5 h-4 w-4" /> Devolver
        </Button>
      ) : null}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {canEdit ? (
            <DropdownMenuItem onSelect={() => openPosEditor()}>
              <Pencil className="mr-2 h-4 w-4" /> Editar venda
            </DropdownMenuItem>
          ) : null}

          {canDuplicate ? (
            <DropdownMenuItem onClick={handleDuplicate}>
              <CopyPlus className="mr-2 h-4 w-4" /> Duplicar venda
            </DropdownMenuItem>
          ) : null}
          {canCancel ? (
            <DropdownMenuItem
              onClick={() => setCancelOpen(true)}
              disabled={setStatusMut.isPending}
            >
              <Ban className="mr-2 h-4 w-4" /> Cancelar venda
            </DropdownMenuItem>
          ) : null}
          {isPaid && sale.bella_pay_ref ? (
            <DropdownMenuItem disabled>
              <Wallet className="mr-2 h-4 w-4" /> Ver cobrança (em breve)
            </DropdownMenuItem>
          ) : null}
          {isPaid ? (
            <DropdownMenuItem disabled>
              <MessageCircle className="mr-2 h-4 w-4" /> WhatsApp (em breve)
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={copyLink}>
            <Copy className="mr-2 h-4 w-4" />
            {copied ? "Link copiado" : "Copiar link da venda"}
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <FileText className="mr-2 h-4 w-4" /> Gerar PDF (em breve)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {isDraft ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => openPosEditor()}
        >
          <Pencil className="mr-1.5 h-4 w-4" />

          Continuar venda
        </Button>
      ) : null}

      {canPay ? (
        <Button
          size="sm"
          disabled={!sale.customer_id}
          title={
            !sale.customer_id
              ? "Selecione um cliente para salvar a venda"
              : undefined
          }
          onClick={() => {
            if (!sale.customer_id) {
              toast.error(
                "É obrigatório selecionar um cliente para salvar a venda",
              );
              return;
            }
            setCheckoutOpen(true);
          }}
        >
          <PlayCircle className="mr-1.5 h-4 w-4" />
          {isPending ? "Retomar pagamento" : "Ir para pagamento"}
        </Button>
      ) : null}


      {isPaid ? (
        <Button asChild size="sm">
          <Link to="/vendas/novo">
            <Receipt className="mr-1.5 h-4 w-4" /> Nova venda
          </Link>
        </Button>
      ) : null}
    </div>
  );


  const kpis = (
    <KpiSection columns={4}>
      <KpiCard
        label="Total da venda"
        value={formatCurrency(financials.grand)}
        icon={DollarSign}
        hint={`${sale.items.length} ${sale.items.length === 1 ? "item" : "itens"}`}
      />
      <KpiCard
        label="Subtotal"
        value={formatCurrency(financials.subtotal)}
        icon={ShoppingBag}
        hint={
          financials.discount > 0
            ? `Desconto ${formatCurrency(financials.discount)}`
            : "Sem desconto"
        }
      />
      <KpiCard
        label="Lucro bruto"
        value={financials.hasCost ? formatCurrency(financials.profit ?? 0) : "—"}
        icon={TrendingUp}
        hint={financials.hasCost ? "Baseado nos custos" : "Custo indisponível"}
      />
      <KpiCard
        label="Margem"
        value={
          financials.hasCost && financials.margin != null
            ? `${financials.margin.toFixed(1)}%`
            : "—"
        }
        icon={Percent}
        hint="Sobre o total"
      />
    </KpiSection>
  );

  const aside = (
    <DetailPanel title="Resumo financeiro" description="Fechamento da venda">
      <div className="space-y-2">
        <SummaryRow
          label="Subtotal"
          value={formatCurrency(financials.subtotal)}
          mono
        />
        <SummaryRow
          label="Desconto"
          value={`- ${formatCurrency(financials.discount)}`}
          mono
        />
        <SummaryRow
          label="Frete"
          value={formatCurrency(financials.shipping)}
          mono
        />
      </div>
      <div className="border-t border-border pt-3">
        <SummaryRow
          label="Total da Venda"
          value={formatCurrency(financials.grand)}
          emphasis
          mono
        />
        {sale.payment_method === 'credit' ? (
          <CreditSummaryItems saleId={sale.id} />
        ) : (
          <SummaryRow
            label="Valor Pago"
            value={formatCurrency(sale.status === 'paid' ? financials.grand : 0)}
            mono
            className={sale.status === 'paid' ? "text-success" : ""}
          />
        )}
      </div>
      <div className="space-y-2 border-t border-border pt-3">
        <SummaryRow
          label="Custo da venda"
          value={financials.hasCost ? formatCurrency(financials.cost) : "—"}
          mono
        />
        <SummaryRow
          label="Lucro bruto"
          value={
            financials.hasCost ? formatCurrency(financials.profit ?? 0) : "—"
          }
          mono
        />
        <SummaryRow
          label="Margem"
          value={
            financials.hasCost && financials.margin != null
              ? `${financials.margin.toFixed(1)}%`
              : "—"
          }
        />
      </div>
      <div className="rounded-md border border-dashed border-border bg-background/40 p-3 text-xs text-muted-foreground">
        Integração <strong className="text-foreground">Bella Pay</strong> e{" "}
        <strong className="text-foreground">Financeiro</strong> — estrutura
        preparada. Recebimento e conciliação entram em Sprint futura.
      </div>
    </DetailPanel>
  );

  return (
    <PageLayout
      title={
        <span className="flex flex-wrap items-center gap-2 font-mono tracking-tight">
          Venda {sale.number}
          {sale.is_test ? <TestSaleBadge /> : null}
        </span>
      }
      description={
        sale.is_test
          ? "NF-e emitida em HOMOLOGAÇÃO — venda de teste, sem efeito fiscal."
          : (sale.customer_name ?? "Consumidor final")
      }
      icon={Receipt}
      meta={meta}
      actions={actions}
      kpis={kpis}
      aside={aside}
    >
      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="cliente">Cliente</TabsTrigger>
          <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="devolucoes">Devoluções</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4 space-y-4">
          <SaleFiscalCard
            saleId={sale.id}
            saleNumber={sale.number}
            customerName={customer?.name ?? sale.customer_name ?? null}
            customerEmail={customer?.email ?? null}
          />

          <Card title="Identificação">
            <Row label="Número" value={sale.number} mono />
            <Row label="Data" value={formatDate(sale.sale_date)} />
            <Row label="Status" value={<SaleStatusBadge status={sale.status} />} />
            <Row label="Forma de pagamento" value={paymentLabel} />
            <Row
              label="Paga em"
              value={sale.paid_at ? formatDateTime(sale.paid_at) : "—"}
            />
          </Card>

          <Card title="Observações">
            {sale.notes ? (
              <p className="whitespace-pre-wrap px-4 py-4 text-sm">
                {sale.notes}
              </p>
            ) : (
              <EmptyState
                title="Nenhuma observação registrada"
                className="border-0 bg-transparent py-10"
              />
            )}
          </Card>
        </TabsContent>

        <TabsContent value="itens" className="mt-4">
          <Card title={`Itens (${sale.items.length})`}>
            {sale.items.length === 0 ? (
              <EmptyState
                icon={Receipt}
                title="Nenhum item registrado nesta venda"
                className="border-0 bg-transparent py-10"
              />
            ) : (
              <div className="overflow-x-auto">
                <div className="min-w-[880px] divide-y divide-border">
                  <div className="grid grid-cols-[1fr_120px_80px_120px_110px_130px_110px] gap-3 bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <div>Produto</div>
                    <div>SKU</div>
                    <div className="text-right">Qtd.</div>
                    <div className="text-right">Preço</div>
                    <div className="text-right">Desc.</div>
                    <div className="text-right">Subtotal</div>
                    <div className="text-right">Lucro</div>
                  </div>
                  {sale.items.map((it) => (
                    <div
                      key={it.id}
                      className="grid grid-cols-[1fr_120px_80px_120px_110px_130px_110px] gap-3 px-4 py-3 text-sm"
                    >
                      <div className="truncate">{it.description}</div>
                      <div className="truncate font-mono text-xs text-muted-foreground">
                        —
                      </div>
                      <div className="text-right tabular-nums">
                        {Number(it.quantity)}
                      </div>
                      <div className="text-right tabular-nums">
                        {formatCurrency(Number(it.unit_price))}
                      </div>
                      <div className="text-right tabular-nums">
                        {formatCurrency(Number(it.discount))}
                      </div>
                      <div className="text-right tabular-nums font-medium">
                        {formatCurrency(Number(it.total))}
                      </div>
                      <div className="text-right tabular-nums text-muted-foreground">
                        —
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
          <p className="mt-2 px-1 text-xs text-muted-foreground">
            SKU e lucro por item entram junto com a leitura do Pricing Engine
            na próxima Sprint.
          </p>
        </TabsContent>

        <TabsContent value="cliente" className="mt-4 space-y-4">
          <Card title="Cliente">
            {sale.customer_id ? (
              <div className="space-y-4 px-4 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-lg font-semibold">
                      {customer?.name ?? sale.customer_name ?? "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Vinculado ao CRM
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to="/clientes/$customerId"
                        params={{ customerId: sale.customer_id }}
                      >
                        <ExternalLink className="mr-1.5 h-4 w-4" /> Abrir cliente
                      </Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link to="/vendas/novo">
                        <Receipt className="mr-1.5 h-4 w-4" /> Nova venda
                      </Link>
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Field label="Documento" value={customer?.document ?? "—"} />
                  <Field label="Telefone" value={customer?.phone ?? "—"} />
                  <Field label="E-mail" value={customer?.email ?? "—"} />
                  <Field label="WhatsApp" value={customer?.whatsapp ?? "—"} />
                  <Field
                    label="Endereço"
                    value={
                      customer
                        ? [
                            customer.address,
                            customer.address_number,
                            customer.neighborhood,
                            customer.city,
                            customer.state,
                          ]
                            .filter(Boolean)
                            .join(", ") || "—"
                        : "—"
                    }
                    full
                  />
                </div>
              </div>
            ) : (
              <div className="px-4 py-6 text-sm text-muted-foreground">
                Venda sem cliente vinculado (consumidor final).
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="pagamento" className="mt-4 space-y-4">
          <Card title="Pagamento">
            {isDraft ? (
              <div className="flex items-center justify-between gap-3 bg-muted/30 px-4 py-2">
                <span className="text-xs text-muted-foreground">
                  Rascunho — ajuste os dados antes de finalizar.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setEditPaymentOpen(true)}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Editar
                </Button>
              </div>
            ) : null}
            <Row label="Forma" value={paymentLabel} />
            <Row label="Status" value={<SaleStatusBadge status={sale.status} />} />
            <Row label="Data da venda" value={formatDate(sale.sale_date)} />
            <Row
              label="Data prevista de recebimento"
              value={
                (sale as unknown as { due_date: string | null }).due_date
                  ? formatDate(
                      (sale as unknown as { due_date: string }).due_date,
                    )
                  : "—"
              }
            />
            <Row
              label="Recebimento"
              value={sale.paid_at ? formatDateTime(sale.paid_at) : "—"}
            />


            {bellaCharge && bellaCharge.billing_type === "CREDIT_CARD" ? (
              <>
                <Row
                  label="Parcelamento"
                  value={
                    (bellaCharge.installment_count ?? 1) > 1
                      ? `${bellaCharge.installment_count}x de ${formatCurrency(Number(bellaCharge.installment_value ?? 0))}`
                      : `À vista — ${formatCurrency(Number(bellaCharge.value ?? 0))}`
                  }
                />
                {bellaCharge.original_value != null &&
                Number(bellaCharge.original_value) !==
                  Number(bellaCharge.value) ? (
                  <Row
                    label="Taxa cartão"
                    value={`+${formatCurrency(
                      Number(bellaCharge.value) -
                        Number(bellaCharge.original_value),
                    )}`}
                  />
                ) : null}
                {bellaCharge.net_value != null ? (
                  <Row
                    label="Líquido"
                    value={formatCurrency(Number(bellaCharge.net_value))}
                  />
                ) : null}
                <Row
                  label="Recebimento previsto"
                  value={computeSettlementDate(
                    sale.paid_at ?? sale.created_at,
                    32,
                  )}
                />
              </>
            ) : null}
          </Card>

          <Card title="Bella Pay">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
              <div className="text-sm">
                {sale.bella_pay_ref ? (
                  <>
                    <p className="font-medium">Cobrança ativa</p>
                    {bellaCharge ? (
                      <p className="text-xs text-muted-foreground">
                        {bellaCharge.billing_type === "CREDIT_CARD"
                          ? "Cartão de crédito"
                          : bellaCharge.billing_type}
                        {" · "}
                        Status {bellaCharge.status}
                        {bellaCharge.updated_at
                          ? ` · Atualizado ${formatDateTime(bellaCharge.updated_at)}`
                          : ""}
                      </p>
                    ) : null}
                    <p className="font-mono text-xs text-muted-foreground">
                      ID: {bellaCharge?.asaas_id ?? sale.bella_pay_ref}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Nenhuma cobrança gerada</p>
                    <p className="text-xs text-muted-foreground">
                      Gere um link para receber via PIX, cartão ou boleto.
                    </p>
                  </>
                )}
              </div>
              {canPay ? (
                <Button
                  size="sm"
                  disabled={!sale.customer_id}
                  title={
                    !sale.customer_id
                      ? "Selecione um cliente para salvar a venda"
                      : undefined
                  }
                  onClick={() => {
                    if (!sale.customer_id) {
                      toast.error(
                        "É obrigatório selecionar um cliente para salvar a venda",
                      );
                      return;
                    }
                    setCheckoutOpen(true);
                  }}
                >
                  <Wallet className="mr-1.5 h-4 w-4" />
                  {sale.bella_pay_ref ? "Abrir cobrança" : "Gerar cobrança"}
                </Button>

              ) : isPending ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    disabled={!sale.customer_id}
                    onClick={() => {
                      if (!sale.customer_id) {
                        toast.error("É obrigatório selecionar um cliente para salvar a venda");
                        return;
                      }
                      setCheckoutOpen(true);
                    }}
                  >
                    <Wallet className="mr-1.5 h-4 w-4" />
                    Gerar cobrança
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      try {
                        const { salesService } = await import("@/features/sales/services/sales.service");
                        const tx = await salesService.openReceivableForSale(sale.id);
                        if (!tx) {
                          toast.error("Não há lançamento financeiro em aberto para esta venda");
                          return;
                        }
                        // Navega para o financeiro com o filtro do lançamento
                        navigate({
                          to: "/financeiro",
                          search: { tab: "receivables" },
                        });
                        toast.info("Localize o lançamento da venda no Contas a Receber para baixar.");
                      } catch (e) {
                        toast.error("Erro ao localizar lançamento financeiro");
                      }
                    }}
                  >
                    <DollarSign className="mr-1.5 h-4 w-4" />
                    Receber Pagamento
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" disabled>
                  <Wallet className="mr-1.5 h-4 w-4" />
                  {sale.bella_pay_ref ? "Ver cobrança" : "Sem cobrança"}
                </Button>
              )}
            </div>

          </Card>

          {(sale.payment_method === "credit" || sale.status === "partially_paid" || sale.status === "pending") ? (
            <CreditAccountPanel saleId={sale.id} companyId={companyId} customerId={sale.customer_id} />
          ) : null}
        </TabsContent>


        <TabsContent value="historico" className="mt-4">
          <Card title="Histórico">
            <div className="px-5 py-5">
              <SaleTimeline sale={sale} />
              <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                Última atualização: {formatDateTime(sale.updated_at)}
              </div>
            </div>
          </Card>
        </TabsContent>
        <TabsContent value="devolucoes" className="mt-4">
          <Card title="Devoluções">
            <ReturnsList saleId={sale.id} />
          </Card>
        </TabsContent>
      </Tabs>

      <ReturnDialog
        open={returnOpen}
        onOpenChange={setReturnOpen}
        companyId={companyId}
        saleId={sale.id}
        saleNumber={sale.number ?? sale.id.slice(0, 8)}
        saleItems={sale.items}
        paymentMethod={sale.payment_method}
        hasBellaPayCharge={false}
      />

      {checkoutOpen ? (
        <CheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          companyId={companyId}
          saleId={sale.id}
          saleNumber={sale.number}
          customerId={sale.customer_id}
          amount={Number(sale.grand_total ?? 0)}
          onContinueEditing={() => {
            navigate({
              to: "/vendas/$saleId/editar",
              params: { saleId: sale.id },
            });
          }}
        />
      ) : null}

      <ReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        saleId={sale.id}
        companyId={companyId}
        paymentMethod={sale.payment_method}
        onViewSale={() => setReceiptOpen(false)}
      />

      <MercadoLivrePrintDialog
        open={mlPrintOpen}
        onOpenChange={setMlPrintOpen}
        labelData={mlLabelData}
      />


      <AlertDialog
        open={cancelOpen}
        onOpenChange={(o) => {
          setCancelOpen(o);
          if (!o) setCancelReason("");
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar esta venda?</AlertDialogTitle>
            <AlertDialogDescription>
              A venda ficará marcada como <strong>Cancelada</strong>. Você
              poderá duplicá-la para gerar uma nova, mas não poderá mais
              editá-la. Esta ação não altera cobranças Bella Pay já emitidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">
              Motivo do cancelamento <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="cancel-reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Ex.: cliente desistiu, erro de digitação, produto indisponível..."
              rows={3}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              O motivo fica registrado na trilha de auditoria da venda.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={setStatusMut.isPending}>
              Voltar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleCancelSale();
              }}
              disabled={setStatusMut.isPending || cancelReason.trim().length === 0}
            >
              Cancelar venda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {isDraft ? (
        <EditPaymentDialog
          open={editPaymentOpen}
          onOpenChange={setEditPaymentOpen}
          currentPaymentMethod={sale.payment_method}
          currentSaleDate={sale.sale_date}
          currentDueDate={(sale as unknown as { due_date: string | null }).due_date ?? null}
          saving={updateSaleMut.isPending}
          onSave={async (patch) => {
            try {
              await updateSaleMut.mutateAsync({
                id: sale.id,
                input: patch as SaleUpdate,
              });
              // Refetch imediato para refletir a nova data no card de Pagamento
              // e nos KPIs abaixo (o `useUpdateSale` marca stale sem refetch
              // para não trocar o snapshot do formulário durante edição).
              await qc.refetchQueries({
                queryKey: salesKeys.detail(sale.id),
                exact: true,
              });
              toast.success("Dados de pagamento atualizados");
              setEditPaymentOpen(false);
            } catch (e) {
              toast.error("Não foi possível atualizar", {
                description: e instanceof Error ? e.message : undefined,
              });
            }
          }}
        />



      ) : null}
    </PageLayout>
  );
}

/**
 * FIN-006 — Edição inline dos dados de pagamento enquanto a venda é
 * rascunho: forma de pagamento e data prevista de recebimento.
 * `sales.due_date` é propagada pelo trigger `apply_receivable_sale_trg`
 * ao lançamento em `financial_transactions` vinculado (finance_ref).
 *
 * TZ-002 — `sale_date` é somente leitura: representa a data em que a venda
 * ocorreu (data operacional da empresa). Vencimento/previsão usam `due_date`.
 * Venda retroativa (ajuste de sale_date) fica pendente de implementação
 * futura, sob permissão administrativa + auditoria.
 */
function EditPaymentDialog({
  open,
  onOpenChange,
  currentPaymentMethod,
  currentSaleDate,
  currentDueDate,
  saving,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentPaymentMethod: string | null;
  currentSaleDate: string;
  currentDueDate: string | null;
  saving: boolean;
  onSave: (patch: {
    payment_method: string | null;
    due_date: string | null;
  }) => void | Promise<void>;
}) {
  const NONE = "__none__";
  const [method, setMethod] = useState<string>(currentPaymentMethod ?? NONE);
  // Default: usa due_date da venda; se nunca definida, espelha sale_date
  // (mesmo comportamento do trigger no banco).
  const [dueDate, setDueDate] = useState<string>(
    currentDueDate ?? currentSaleDate,
  );

  // Ressincroniza com props quando o diálogo reabre (sale mudou via refetch).
  useEffect(() => {
    if (open) {
      setMethod(currentPaymentMethod ?? NONE);
      setDueDate(currentDueDate ?? currentSaleDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar dados de pagamento</DialogTitle>
          <DialogDescription>
            Ajuste a forma de pagamento e a data prevista de recebimento
            antes de finalizar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Forma de pagamento
            </Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue placeholder="Escolher no checkout" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Escolher no checkout</SelectItem>
                {SALE_PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Data da venda
              </Label>
              <div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm tabular-nums text-muted-foreground">
                {currentSaleDate
                  ? new Date(`${currentSaleDate}T12:00:00`).toLocaleDateString("pt-BR")
                  : "—"}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Data prevista de recebimento
              </Label>
              <Input
                type="date"
                value={dueDate}
                min={currentSaleDate || undefined}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <p className="text-[11px] leading-snug text-muted-foreground">
            A data da venda é a data operacional da empresa e não pode ser
            alterada. A data prevista de recebimento define o vencimento da
            cobrança em Contas a Receber. Vencimento <strong className="text-foreground">hoje</strong> aparece como
            {" "}“A receber hoje” — só é considerado <strong className="text-foreground">Vencido</strong> quando a data
            for anterior ao dia atual.
          </p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={saving || !dueDate}
            onClick={() =>
              onSave({
                payment_method: method === NONE ? null : method,
                due_date: dueDate || null,
              })
            }
          >

            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}





function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="border-b border-border px-4 py-2.5 text-sm font-semibold">
        {title}
      </div>
      <div className="divide-y divide-border">{children}</div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  bold,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span
        className={`text-sm ${mono ? "font-mono" : ""} ${bold ? "font-semibold" : ""} tabular-nums`}
      >
        {value}
      </span>
    </div>
  );
}

function Field({
  label,
  value,
  full,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div
      className={`rounded-md border border-border bg-background/40 px-3 py-2 ${
        full ? "sm:col-span-2" : ""
      }`}
    >
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 text-sm">{value}</p>
    </div>
  );
}

/**
 * PDV-014 — Calcula data prevista de liquidação (D+N) a partir de uma
 * data base (paid_at ou created_at) somando `days`.
 */
function computeSettlementDate(baseIso: string | null, days: number): string {
  const base = baseIso ? new Date(baseIso) : new Date();
  if (Number.isNaN(base.getTime())) return "—";
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("pt-BR");
}

