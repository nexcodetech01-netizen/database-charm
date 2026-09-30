import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ReceiptDialog } from "./receipt-dialog";
import { SaleCompletedDialog } from "./sale-completed-dialog";
import {
  ChargeView,
  CheckoutFooter,
  CheckoutSummary,
  CreditConfigDialog,
  MethodSelector,
  isChargeReceived,
  toSalePaymentMethod,
  type BillingType,
  type ChargeRow,
  type UiCheckoutMethod,
} from "./checkout";
import {
  CardChargePanel,
  CashPanel,
  ConfirmedPanel,
  CreditBlockedAlert,
  CreditPanel,
  DebitPanel,
  PendingPanel,
  PixManualPanel,
} from "./checkout/panels";
import {
  cashGuardQueryKey,
  useCashSessionGuard,
  useChargeRealtime,
  useCheckoutContacts,
  useCheckoutPricing,
  useOwnPix,
  useSalePaidRealtime,
} from "../hooks/checkout";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { parseCurrency } from "@/lib/masks";
import { useCreateAsaasCharge, useBellaPayConfig } from "@/features/bella-pay";
import { computeCreditCardCharge } from "@/features/bella-pay/lib/credit-card-fee";
import { useCardFixedFee } from "@/features/bella-pay/lib/card-fixed-fee";
import { useBellaFeeCatalog } from "@/features/bella-pay/lib/fee-catalog";
import { useSetSaleStatus } from "../hooks/use-sales";
import { salesService } from "../services/sales.service";
import { SettleTransactionDialog } from "@/features/finance/components/settle-transaction-dialog";
import type { FinancialTransaction } from "@/features/finance/types";
import type { CheckoutMethod } from "../types";
import { returnToSaleItems } from "../lib/checkout-return";
import { useCardPriceConfig } from "@/features/payment-methods/hooks/use-card-price-config";
import { maxInstallmentsFor } from "@/lib/pricing/card-price";
import { useCreateCreditSale } from "@/features/credit";

// Mantido para compatibilidade com `pdv/lib/payments.ts`.
export type { UiCheckoutMethod };

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companyId: string;
  saleId: string;
  saleNumber?: string | null;
  customerId: string | null;
  /** Total final da venda (grand_total). */
  amount: number;
  /** Subtotal (items_total) — opcional; para o resumo. */
  subtotal?: number;
  /** Desconto aplicado na venda — opcional; para o resumo. */
  discount?: number;
  /** Frete aplicado — opcional; para o resumo. */
  shipping?: number;
  description?: string | null;
  /**
   * Pagamento confirmado. Recebe o método escolhido no checkout (opcional,
   * retrocompatível) para que o chamador possa exibir/registrar a forma.
   */
  onPaid?: (info?: { method: UiCheckoutMethod }) => void;
  /** Se fornecido, exibe a ação "Nova Venda" no modal de sucesso/cupom. */
  onNewSale?: () => void;
  /**
   * Se fornecido, exibe o botão "Voltar aos itens" no rodapé (visível
   * enquanto o pagamento não foi confirmado). O callback é chamado
   * ANTES do `onOpenChange(false)` para permitir que o pai suprima
   * qualquer navegação padrão de close — o operador retorna ao editor
   * da MESMA venda sem trocar de rota nem perder dados.
   */
  onContinueEditing?: () => void;
  /** Informa ao formulário pai enquanto o rollback pending → draft está ativo. */
  onReturnToItemsStateChange?: (returning: boolean) => void;
  /** Itens do PDV com preço à vista, usados para persistir o valor efetivamente cobrado. */
  pdvCashItems?: Array<{
    product_id: string | null;
    unit_price: number;
    quantity: number;
    discount: number;
    position: number;
  }>;
  onPdvPricingChange?: (pricing: { amount: number; method: UiCheckoutMethod; installments: number }) => void;
}

export function CheckoutDialog({
  open,
  onOpenChange,
  companyId,
  saleId,
  saleNumber,
  customerId,
  amount: initialAmount,
  subtotal,
  discount,
  shipping,
  description,
  onPaid,
  onNewSale,
  onContinueEditing,
  onReturnToItemsStateChange,
  pdvCashItems,
  onPdvPricingChange,
}: Props) {
  const [method, setMethod] = useState<UiCheckoutMethod>("pix_manual");
  const [charge, setCharge] = useState<ChargeRow | null>(null);
  const [generating, setGenerating] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showCreditConfig, setShowCreditConfig] = useState(false);

  // PDV-010 — parcelamento (apenas cartão de crédito). Padrão: 1x.
  const [installments, setInstallments] = useState<number>(1);
  // BUG-001 — guarda por ref evita re-entrada por stale closure no polling.
  const confirmedRef = useRef(false);
  // Impede callbacks tardios de polling/realtime depois de "Voltar aos itens".
  const returningToItemsRef = useRef(false);

  // FIN-BAIXA — baixa financeira única (SettleTransactionDialog → RPC).
  const [settleTx, setSettleTx] = useState<FinancialTransaction | null>(null);
  const [openingSettle, setOpeningSettle] = useState(false);

  // FIN-001 — Dinheiro: valor recebido para cálculo de troco.
  const [cashReceivedStr, setCashReceivedStr] = useState<string>("");
  

  // FIN-001 — Entrada opcional (parcial): quando > 0, a cobrança é gerada
  // apenas pelo saldo restante, com vencimento configurável.
  const [entradaStr, setEntradaStr] = useState<string>("");
  const [installmentsCount, setInstallmentsCount] = useState<number>(1);
  const [saldoDueDate, setSaldoDueDate] = useState<string>(
    () => new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  );
  // FIN-001 — Override de sessão para "quem paga a taxa" (crédito).
  const [absorbOverride, setAbsorbOverride] = useState<boolean | null>(null);
  // Crediário — método usado para receber a entrada (quando informada).
  const [creditDownMethod, setCreditDownMethod] = useState<string>("cash");
  const [creditNotes, setCreditNotes] = useState<string>("");

  const createCharge = useCreateAsaasCharge(companyId);
  const createCredit = useCreateCreditSale();
  const setStatus = useSetSaleStatus();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: bellaConfig } = useBellaPayConfig(companyId);
  const { data: cardPriceConfig } = useCardPriceConfig(companyId);

  const [cardFixedFee] = useCardFixedFee(companyId);
  const { snapshots: feeSnapshots } = useBellaFeeCatalog(companyId);

  const absorb =
    absorbOverride ?? Boolean(bellaConfig?.credit_card_absorb_fee);

    const { amount, ensurePricingReady, restoreCashPricing } = useCheckoutPricing({
    open,
    saleId,
    initialAmount,
    method,
    installments,
    discount,
    shipping,
    pdvCashItems,
    cardPriceConfig,
    onPdvPricingChange,
    confirmed,
    confirmedRef,
    showCompleted,
  });

  // Efeito para preencher automaticamente o valor recebido em Dinheiro
  useEffect(() => {
    if (method === "cash" && !confirmed && !showCompleted) {
      setCashReceivedStr(amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  }, [method, amount, confirmed, showCompleted, setCashReceivedStr]);

  // Entrada parseada — nunca maior que o total, saldo nunca negativo.
  const entradaRaw = parseCurrency(entradaStr);
  const entradaNegativa = entradaRaw < 0;
  const entradaExcedeu = entradaRaw > amount;
  const entradaValue = Math.min(Math.max(0, entradaRaw), amount);
  const saldoValue = Math.max(0, amount - entradaValue);
  const chargeableAmount = entradaValue > 0 ? saldoValue : amount;

    // Parcelas permitidas: limite do Asaas + valor mínimo para parcelar da
  // empresa (abaixo dele o crédito é só 1x).
  const maxAllowedInstallments = maxInstallmentsFor(chargeableAmount, {
    maxInstallments: Number(bellaConfig?.credit_card_max_installments ?? 3),
    minInstallmentAmount: cardPriceConfig?.minInstallmentAmount ?? 0,
  });

  useEffect(() => {
    if (installments > maxAllowedInstallments) setInstallments(1);
  }, [installments, maxAllowedInstallments]);

  const creditCardPreview = useMemo(() => {
    if (method !== "credit_card") return null;
    return computeCreditCardCharge(chargeableAmount, installments, {
      absorb,
      feePercent: Number(bellaConfig?.credit_card_fee_percent ?? 0),
      maxInstallments: Number(bellaConfig?.credit_card_max_installments ?? 3),
      fixedFee: cardFixedFee,
    });
  }, [method, installments, chargeableAmount, absorb, bellaConfig, cardFixedFee]);





  const { customerName, whatsappNumber, company, companyName } = useCheckoutContacts({
    open,
    customerId,
    companyId,
  });

  const { payload: ownPixPayload, qrDataUrl: ownPixQrDataUrl } = useOwnPix({
    enabled: method === "pix_manual",
    company,
    amount,
    saleNumber,
  });



  // Reset quando abre/fecha
  useEffect(() => {
    if (!open) {
      setCharge(null);
      setConfirmed(false);
      confirmedRef.current = false;
      setGenerating(false);
      setMethod("pix_manual");
      setShowCompleted(false);
      setShowCreditConfig(false);
      setInstallments(1);
      setInstallmentsCount(1);
      setCashReceivedStr("");
      setEntradaStr("");
      setAbsorbOverride(null);
    }
  }, [open]);


  // Polling da cobrança enquanto aguarda pagamento.
  // HOTFIX-001: o polling apenas OBSERVA. A confirmação do pagamento
  // (sale.status='paid', baixa financeira e movimento de estoque) é
  // executada exclusivamente pelo servidor no webhook Bella Pay.
  // Realtime deve cobrir TODAS as modalidades cuja confirmação chega por
  // webhook Asaas — inclusive Payment Link (billingType UNDEFINED) e Boleto.
  // Substituímos o polling de 4s (charge) e 3s (sale) por Postgres Changes:
  // o webhook atualiza `bella_pay_charges` e `sales`, e o Realtime entrega a
  // mudança quase instantaneamente. A confirmação definitiva de venda paga
  // continua sendo controlada pelo canal de `sales.status='paid'` mais abaixo.
  const shouldPoll =
    !!charge &&
    (method === "pix" ||
      method === "credit_card" ||
      method === "payment_link" ||
      method === "boleto") &&
    !confirmed;

  // Realtime da cobrança — atualiza status/QR/URL sem polling.
  useChargeRealtime(shouldPoll ? (charge?.id ?? null) : null, setCharge);



  // Revalidação dinâmica: se o caixa vinculado à venda for fechado enquanto
  // o operador está no checkout, bloqueamos qualquer nova ação de finalização.
  // O guard do banco também recusaria (trg_enforce_sale_open_cash_upd), mas
  // aqui damos feedback imediato e evitamos a chamada à API do Asaas.
  const cashClosed = useCashSessionGuard(saleId, open && !confirmed);


  // BUG-002 (Payment Link) — Realtime como caminho preferencial. Evita a
  // janela de até 3s do poll, e é praticamente instantâneo quando o
  // webhook grava sales.status='paid'.
  useSalePaidRealtime(saleId, open && !confirmed, () => {
    if (!confirmedRef.current && !returningToItemsRef.current) {
      void onWebhookConfirmed();
    }
  });

  /**
   * Persiste no cabeçalho da venda o meio de pagamento efetivo e o número
   * de parcelas (obrigatório em cartão de crédito). Usado antes de qualquer
   * confirmação (manual ou via webhook) para garantir que Bella IA, Painel
   * Executivo e Relatórios consigam apurar taxas e receita líquida.
   */
  async function persistPaymentSelection() {
    try {
      const paymentMethod =
        method === "pending_payment" ? null : toSalePaymentMethod(method);
      const inst = method === "credit_card" ? Math.max(1, Math.trunc(installments || 1)) : 1;
      await supabase
        .from("sales")
        .update({
          payment_method: paymentMethod,
          installments: inst,
          updated_at: new Date().toISOString()
        })
        .eq("id", saleId);
    } catch {
      /* não bloqueia o fluxo — o setStatus segue mesmo em caso de falha aqui. */
    }
  }

  /**
   * Handler quando a UI detecta que o webhook já confirmou o pagamento.
   * Não altera estado — apenas reflete o resultado já persistido pelo servidor.
   */
  async function onWebhookConfirmed() {
    // BUG-001 — guarda síncrona por ref evita re-entrada por stale closure.
    if (confirmedRef.current || returningToItemsRef.current) return;
    confirmedRef.current = true;
    setConfirmed(true);
    await persistPaymentSelection();
    qc.setQueryData(["sales", "detail", saleId], (current: unknown) =>
      current && typeof current === "object"
        ? { ...current, status: "paid" }
        : current,
    );
    void qc.invalidateQueries({
      queryKey: ["sales", "detail", saleId],
      exact: true,
      refetchType: "none",
    });
    void qc.invalidateQueries({ queryKey: ["sales", "list"] });
    void qc.invalidateQueries({ queryKey: ["sales", "metrics"] });
    // BUG-001 — chave específica: NÃO invalidar ["bella-pay"] inteiro,
    // pois isso re-dispara o próprio poll ("charge-poll") em cascata.
    qc.invalidateQueries({ queryKey: ["bella-pay", "charge-by-sale", saleId] });
    qc.invalidateQueries({ queryKey: ["bella-pay", "charges", companyId] });
    qc.invalidateQueries({ queryKey: ["bella-pay", "metrics", companyId] });
    toast.success("Pagamento confirmado", {
      description: saleNumber
        ? `Venda ${saleNumber} confirmada pelo servidor.`
        : "Confirmação recebida pelo webhook.",
    });
    onPaid?.({ method });
  }

  /**
   * FIN-BAIXA — Manual (dinheiro / débito / PIX próprio).
   * O checkout NÃO altera mais `sales.status='paid'` diretamente: abre o
   * SettleTransactionDialog sobre o recebível da venda, que executa a RPC
   * `settle_financial_transaction` (payment_method, account_id, paid_at,
   * cash_movement e saldo da conta). A venda só é marcada como paga depois
   * da baixa concluída, em `handleSettled()`.
   */
  async function beginManualSettlement() {
    if (confirmedRef.current || openingSettle) return;
    setOpeningSettle(true);
    try {
      await persistPaymentSelection();
      
      const { data: saleRow } = await supabase
        .from("sales")
        .select("status, cash_session_id")
        .eq("id", saleId)
        .maybeSingle();
      
      if (saleRow?.status === "draft") {
        await setStatus.mutateAsync({ id: saleId, status: "pending" });
      }

      // Vendas do tipo 'crediário' ou 'pagamento pendente' abrem o modal de baixa manual
      if (method === "credit" || method === "pending_payment") {
        const tx = await salesService.openReceivableForSale(saleId);
        if (!tx) {
          toast.error("Não foi possível localizar o título financeiro");
          return;
        }
        setSettleTx(tx as FinancialTransaction);
      } else {
        // Para Pix Próprio, Dinheiro e Débito: baixa automática usando motor financeiro
        await salesService.autoSettleSale(saleId, {
          paymentMethod: method === "pix_manual" ? "pix_manual" : (method as any),
          companyId
        });
        await handleSettled();
      }
    } catch (e) {
      toast.error("Não foi possível processar a venda", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setOpeningSettle(false);
    }
  }

  /** Executado apenas após a baixa concluída pela RPC. */
  async function handleSettled(info?: { isPartial: boolean }) {
    setSettleTx(null);
    confirmedRef.current = true;
    setConfirmed(true);
    // FIX (2026-09-06): antes forçava sempre "paid", mesmo numa baixa
    // parcial — o que fazia essa chamada falhar (status inválido pra
    // uma venda com saldo ainda em aberto) e mostrar "Baixa registrada,
    // mas o status da venda não foi atualizado", mesmo o pagamento em
    // si já tendo sido registrado corretamente.
    const targetStatus = info?.isPartial ? "partially_paid" : "paid";
    try {
      await setStatus.mutateAsync({ id: saleId, status: targetStatus });
      toast.success(
        targetStatus === "partially_paid" ? "Pagamento parcial registrado" : "Pagamento registrado com sucesso",
        { description: saleNumber ? `Venda ${saleNumber} ${targetStatus === "partially_paid" ? "atualizada" : "concluída"}.` : undefined },
      );
      onPaid?.({ method });
      openCompletedDialog();
    } catch (e) {
      toast.error("Baixa registrada, mas o status da venda não foi atualizado", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  const billingType: BillingType | null = useMemo(() => {
    if (method === "pix") return "PIX";
    if (method === "credit_card") return "CREDIT_CARD";
    if (method === "payment_link" || method === "boleto") return "UNDEFINED";
    return null; // dinheiro / débito
  }, [method]);

  async function handleGenerate() {
    if (!billingType) return;
    if (cashClosed) {
      toast.error("O caixa foi fechado durante a venda.", {
        description: "Abra o caixa novamente para finalizar o pagamento.",
        action: { label: "Abrir caixa", onClick: () => navigate({ to: "/caixa" }) },
      });
      return;
    }
    if (chargeableAmount <= 0) {
      toast.error("Valor a cobrar deve ser maior que zero.");
      return;
    }


    setGenerating(true);
    try {
      // FIN-001 — dueDate reflete o vencimento do saldo quando há entrada;
      // caso contrário, mantém o padrão (D+1) do fluxo original.
      const dueDate =
        entradaValue > 0
          ? saldoDueDate
          : new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
      const created = await createCharge.mutateAsync({
        customerId,
        saleId,
        billingType,
        value: chargeableAmount,
        dueDate,
        description: description ?? (saleNumber ? `Venda ${saleNumber}` : undefined),
        installmentCount: method === "credit_card" ? installments : undefined,
      });
      setCharge(created as unknown as ChargeRow);

    } catch (error) {
      console.error("[checkout] falha ao gerar cobrança", {
        saleId,
        method,
        error,
      });
    } finally {
      setGenerating(false);
    }
  }


  function goToSaleDetails() {
    setShowCompleted(false);
    onOpenChange(false);
    navigate({ to: "/vendas/$saleId", params: { saleId } });
  }

  /**
   * PDV-009 — Elimina "estado morto".
   * Se o operador fechar o checkout SEM confirmar pagamento e SEM cobrança
   * ativa, a venda volta para "draft" (não fica presa como "pending").
   * Se houver cobrança Bella Pay aguardando pagamento, mantém "pending"
   * — o operador pode retomar/cancelar a cobrança no detalhe da venda.
   */
    /** Fechou sem pagar: não deixa a taxa do cartão gravada no rascunho. */
  async function restoreCashPricingSafely() {
    try {
      await restoreCashPricing();
    } catch (error) {
      console.error("[checkout] falha ao restaurar preço à vista", { saleId, error });
      toast.error("Não foi possível voltar a venda ao preço à vista", {
        description: "Ao reabrir, selecione a forma de pagamento de novo antes de finalizar.",
      });
    }
  }

  async function requestClose() {
    if (!confirmed && !charge) {
      await restoreCashPricingSafely();
      try {
        await setStatus.mutateAsync({ id: saleId, status: "draft" });
      } catch (error) {
        console.error("[checkout] falha ao restaurar rascunho ao fechar", {
          saleId,
          error,
        });
        toast.error("Não foi possível restaurar a venda como rascunho", {
          description: "Reabra a venda antes de tentar finalizar novamente.",
        });
      }
    }
    onOpenChange(false);
  }

  /**
   * "Voltar aos itens" — fecha apenas o painel de pagamento e devolve o
   * operador ao editor da MESMA venda (mesmo id/número, mesmos itens,
   * cliente, descontos e frete). Não navega, não confirma pagamento,
   * não recria a venda. Se a venda foi promovida a "pending" durante o
   * checkout, volta para "draft" para permitir edição imediata.
   *
   * O callback do pai é invocado ANTES de `onOpenChange(false)` para
   * suprimir qualquer navegação padrão do handler de close.
   */
  function handleContinueEditing() {
    if (!onContinueEditing) return;

    returningToItemsRef.current = true;
    onReturnToItemsStateChange?.(true);
    void qc.cancelQueries({ queryKey: cashGuardQueryKey(saleId) });

    returnToSaleItems({
      prepareEditor: onContinueEditing,
      closeCheckout: () => onOpenChange(false),
      rollbackSaleStatus:
        !confirmed && !charge
                    ? async () => {
              await restoreCashPricingSafely();
              await setStatus.mutateAsync({ id: saleId, status: "draft" });
              qc.setQueryData(["sales", "detail", saleId], (current: unknown) =>
                current && typeof current === "object"
                  ? { ...current, status: "draft" }
                  : current,
              );
              await qc.invalidateQueries({
                queryKey: ["sales", "detail", saleId],
                exact: true,
                refetchType: "none",
              });
            }
          : undefined,
      onRollbackError: (error) => {
        console.error("[checkout] não foi possível restaurar o status de rascunho", error);
        toast.error("Não foi possível voltar a venda para rascunho", {
          description: "A edição foi mantida. Aguarde e tente novamente.",
        });
      },
      onRollbackSettled: () => {
        returningToItemsRef.current = false;
        onReturnToItemsStateChange?.(false);
      },
    });
  }

  function openCompletedDialog() {
    setShowCompleted(true);
  }

  async function handleConfirm() {
    // Pagamento já confirmado (webhook ou manual): abrir modal de conclusão.
    if (confirmed) {
      openCompletedDialog();
      return;
    }
    // Revalidação dinâmica: caixa fechado durante o checkout bloqueia
    // qualquer nova finalização.
    if (cashClosed) {
      toast.error("O caixa foi fechado durante a venda.", {
        description: "Abra o caixa novamente para finalizar o pagamento.",
        action: { label: "Abrir caixa", onClick: () => navigate({ to: "/caixa" }) },
      });
      return;
    }
    if (!(await ensurePricingReady())) return;

    // GROUP 1: À VISTA (BAIXA E CONCLUSÃO IMEDIATA)
    if (method === "pix_manual" || method === "cash" || method === "debit_card" || method === "credit_card") {
      if (method === "pix_manual" && !ownPixPayload) {
        toast.error("Configure a chave PIX em Configurações → Empresa antes de usar PIX Próprio.");
        return;
      }
      
      // Para pagamentos à vista no PDV, realizamos a baixa automática em segundo plano
      // e redirecionamos imediatamente para a conclusão.
      await beginManualSettlement();
      return;
    }

    // GROUP 2: A PRAZO OU PENDENTES
    if (method === "credit" || method === "pending_payment" || method === "boleto" || method === "payment_link") {
      // 1. VALIDAÇÃO DE CLIENTE (Obrigatória para Grupo 2)
      if (!customerId) {
        toast.error("Selecione um cliente cadastrado para esta forma de pagamento.");
        return;
      }

      // 2. TELA DE CONDIÇÕES (Para Crediário e Pagamento Pendente)
      if (method === "credit") {
        setShowCreditConfig(true);
        return;
      }

      if (method === "pending_payment") {
        confirmedRef.current = true;
        setConfirmed(true);
        try {
          await persistPaymentSelection();
          // 3. REGISTRO NO FINANCEIRO (Status PENDENTE)
          await setStatus.mutateAsync({ id: saleId, status: "pending" });
          
          // 4. TELA FINAL (Sucesso personalizado)
          toast.success("Venda a prazo registrada com sucesso!");
          onPaid?.({ method });
          openCompletedDialog();
        } catch (e) {
          confirmedRef.current = false;
          setConfirmed(false);
          toast.error("Erro ao registrar venda pendente");
        }
        return;
      }
    }

    // Fluxo Bella Pay (Cartão, Boleto, Link) se ainda não gerado
    if (!charge && (method === "payment_link" || method === "boleto")) {
      await handleGenerate();
      return;
    }

    // Se já confirmado pelo webhook (Bella Pay), abrir conclusão
    if (charge && isChargeReceived(charge.status)) {
      onWebhookConfirmed();
      openCompletedDialog();
    } else {
      toast.info("Aguardando confirmação do pagamento…");
    }
  }

  async function handleConfirmCredit() {
    if (!(await ensurePricingReady())) return;
    const payload = {
      companyId,
      saleId,
      customerId: customerId!,
      downPayment: entradaValue,
      downPaymentMethod: entradaValue > 0 ? (creditDownMethod === "pix_manual" ? "pix_manual" : creditDownMethod) : null,
      dueDate: saldoDueDate || null,
      installments: installmentsCount,
      notes: creditNotes.trim() || null,
    };

    // Pré-flight: valida presença/consistência dos campos antes de bater na RPC.
    const invalid: string[] = [];
    if (!payload.companyId) invalid.push("companyId");
    if (!payload.saleId) invalid.push("saleId");
    if (!payload.customerId) invalid.push("customerId");
    if (payload.downPayment == null || Number.isNaN(payload.downPayment))
      invalid.push("downPayment");
    if (payload.downPayment > 0 && !payload.downPaymentMethod)
      invalid.push("downPaymentMethod");
    if (invalid.length) {
      toast.error("Não foi possível abrir o crediário", {
        description: `Campos inválidos: ${invalid.join(", ")}`,
      });
      return;
    }

    try {
      setOpeningSettle(true);
      setShowCreditConfig(false);
      
      // Confirma no banco que a venda existe, pertence à empresa e ainda é draft.
      const { data: saleRow, error: saleErr } = await supabase
        .from("sales")
        .select("id, company_id, customer_id, status, payment_method, grand_total")
        .eq("id", saleId)
        .maybeSingle();

      if (saleErr) throw saleErr;
      if (!saleRow) throw new Error(`Venda ${saleId} não encontrada.`);
      if (saleRow.company_id !== companyId) throw new Error(`company_id divergente.`);
      if (saleRow.status !== "draft" && saleRow.status !== "pending") {
        throw new Error(`Venda em status "${saleRow.status}" não pode abrir crediário.`);
      }

      const res = await createCredit.mutateAsync(payload);
      
      let finalStatus: string = "pending";
      if (entradaValue >= amount) {
        finalStatus = "paid";
      } else if (entradaValue > 0) {
        finalStatus = "partially_paid";
      }

      await setStatus.mutateAsync({ id: saleId, status: finalStatus });

      confirmedRef.current = true;
      setConfirmed(true);
      toast.success("Venda no Crediário Registrada com Sucesso!", {
        description: `Saldo em aberto: ${formatCurrency(res.balance)}`,
      });
      onPaid?.({ method });
      openCompletedDialog();
    } catch (e) {
      setConfirmed(false);
      const err = e as { message?: string } | null;
      toast.error("Falha ao abrir crediário", { description: err?.message || "Erro desconhecido." });
    } finally {
      setOpeningSettle(false);
    }
  }


  // Handlers estáveis para os componentes memoizados.
  const selectMethod = useCallback((next: UiCheckoutMethod) => {
    setMethod(next);
    setCharge(null);
    setCashReceivedStr("");
  }, []);

  const switchToPix = useCallback(() => {
    setMethod("pix_manual");
    setCharge(null);
  }, []);

  const showAsaasFlow =
    method === "credit_card" || method === "payment_link" || method === "boleto";

  // Método efetivo repassado a componentes que só conhecem CheckoutMethod.
  const effectiveMethod: CheckoutMethod =
    method === "boleto" ? "payment_link" : method;

  // ---- FIN-001 — Dinheiro (troco) ----
  // parseCurrency entende "1.234,56": o valor autopreenchido tem separador de milhar.
  const cashReceived = Math.max(0, parseCurrency(cashReceivedStr));
  const cashChange = Math.max(0, cashReceived - amount);
  const cashShort = Math.max(0, amount - cashReceived);
  const canConfirmCash = method !== "cash" || cashReceived >= amount;

  // ---- FIN-001 — Taxas informativas (débito e PIX) ----
  const debitSnapshot = feeSnapshots.find((s) => s.method === "debit_card");
  const pixSnapshot = feeSnapshots.find((s) => s.method === "pix");
  const debitFee = debitSnapshot
    ? amount * (debitSnapshot.percent / 100) + debitSnapshot.fixed
    : 0;
  const debitNet = Math.max(0, amount - debitFee);


  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) requestClose(); else onOpenChange(true); }}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-5 py-3 text-left">
          <DialogTitle className="flex items-center gap-2">
            Checkout
            {saleNumber ? (
              <Badge variant="outline" className="font-mono text-xs">
                {saleNumber}
              </Badge>
            ) : null}
          </DialogTitle>
          <DialogDescription>
            Selecione a forma de pagamento para finalizar a venda.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 px-5 py-4 space-y-4">
        <CheckoutSummary
          amount={amount}
          subtotal={subtotal}
          discount={discount}
          shipping={shipping}
          entradaValue={entradaValue}
          saldoValue={saldoValue}
          saldoDueDate={saldoDueDate}
        />

        {method === "credit" && !customerId ? (
          <CreditBlockedAlert onSelectCustomer={handleContinueEditing} />
        ) : null}

          <MethodSelector
            method={method}
            locked={!!charge && !confirmed}
            onSelect={selectMethod}
          />

          {/* Painel dinâmico por método */}
          <div className="rounded-xl border border-border p-4 mb-6">
          {confirmed ? (
            <ConfirmedPanel />
          ) : method === "cash" ? (
            <CashPanel
              amount={amount}
              cashReceivedStr={cashReceivedStr}
              onCashReceivedChange={setCashReceivedStr}
              cashShort={cashShort}
              cashChange={cashChange}
            />
          ) : method === "debit_card" ? (
            <DebitPanel
              amount={amount}
              debitSnapshot={debitSnapshot}
              debitFee={debitFee}
              debitNet={debitNet}
            />
          ) : method === "pix_manual" ? (
            <PixManualPanel
              ownPixPayload={ownPixPayload}
              ownPixQrDataUrl={ownPixQrDataUrl}
              whatsappNumber={whatsappNumber}
              customerName={customerName}
              companyName={companyName}
              amount={amount}
            />
          ) : method === "credit" ? (
            <CreditPanel customerId={customerId} customerName={customerName} amount={amount} />
          ) : showAsaasFlow && !charge ? (
            <CardChargePanel
              method={method}
              amount={amount}
              chargeableAmount={chargeableAmount}
              installments={installments}
              onInstallmentsChange={setInstallments}
              absorb={absorb}
              onAbsorbChange={setAbsorbOverride}
              creditCardPreview={creditCardPreview}
                            bellaConfig={bellaConfig}
              maxInstallments={maxAllowedInstallments}
              cardFixedFee={cardFixedFee}
              hasPdvItems={!!pdvCashItems?.length}
              entradaExcedeu={entradaExcedeu}
              entradaValue={entradaValue}
              saldoValue={saldoValue}
              isGenerating={generating || createCharge.isPending}
              onGenerate={handleGenerate}
              onSwitchToPix={switchToPix}
            />
          ) : method === "pending_payment" ? (
            <PendingPanel customerId={customerId} onSelectCustomer={handleContinueEditing} />
          ) : charge ? (
            <ChargeView
              charge={charge}
              method={effectiveMethod}
              amount={amount}
              customerName={customerName}
              companyName={companyName}
              whatsappNumber={whatsappNumber}
            />
          ) : null}
          </div>
        </div>

        <CheckoutFooter
          method={method}
          confirmed={confirmed}
          customerId={customerId}
          canGoBack={!!onContinueEditing}
          busy={setStatus.isPending || createCredit.isPending || openingSettle}
          closeDisabled={setStatus.isPending}
          confirmDisabled={
            setStatus.isPending ||
            createCredit.isPending ||
            openingSettle ||
            (!confirmed && cashClosed) ||
            (method === "cash" && !confirmed && !canConfirmCash) ||
            (method === "pix_manual" && !confirmed && !ownPixPayload) ||
            ((method === "credit" || method === "pending_payment") && !confirmed && !customerId)
          }
          onBack={handleContinueEditing}
          onClose={requestClose}
          onConfirm={handleConfirm}
        />
      </DialogContent>

      <CreditConfigDialog
        open={showCreditConfig}
        onOpenChange={setShowCreditConfig}
        amount={amount}
        entradaStr={entradaStr}
        onEntradaChange={setEntradaStr}
        entradaValue={entradaValue}
        entradaExcedeu={entradaExcedeu}
        entradaNegativa={entradaNegativa}
        saldoValue={saldoValue}
        installmentsCount={installmentsCount}
        onInstallmentsCountChange={setInstallmentsCount}
        creditDownMethod={creditDownMethod}
        onCreditDownMethodChange={setCreditDownMethod}
        saldoDueDate={saldoDueDate}
        onSaldoDueDateChange={setSaldoDueDate}
        creditNotes={creditNotes}
        onCreditNotesChange={setCreditNotes}
        submitting={openingSettle}
        onConfirm={handleConfirmCredit}
      />

      <ReceiptDialog
        open={showReceipt}
        onOpenChange={setShowReceipt}
        saleId={saleId}
        companyId={companyId}
        paymentMethod={effectiveMethod}
        pixQrBase64={charge?.pix_qr_code ?? null}
        pixPayload={charge?.pix_payload ?? null}
        pixPaid={confirmed}
        onViewSale={goToSaleDetails}
        onNewSale={
          onNewSale
            ? () => {
                setShowReceipt(false);
                setShowCompleted(false);
                onNewSale();
              }
            : undefined
        }
      />
      <SaleCompletedDialog
        open={showCompleted}
        onOpenChange={(v) => {
          setShowCompleted(v);
          // BUG ENCONTRADO E CORRIGIDO (2026-08-27): se essa tela de
          // "venda concluída" for fechada de qualquer jeito que NÃO
          // seja o botão "Nova Venda" (ex.: o X, clicar fora, tecla
          // Esc), a tela de CHECKOUT por trás nunca era avisada pra
          // fechar — ficava aberta e exposta, com os dados da venda
          // que já terminou, parecendo que "o PDV não fechou depois
          // de finalizar a venda". Agora, fechar essa tela de
          // qualquer jeito também fecha o checkout por trás.
          if (!v) onOpenChange(false);
        }}
        title={method === "credit" ? "Venda no Crediário Registrada com Sucesso!" : undefined}
        description={method === "credit" ? "O título foi gerado no Contas a Receber do cliente." : undefined}
        onPrintReceipt={() => setShowReceipt(true)}
        onViewSale={goToSaleDetails}
        onNewSale={
          onNewSale
            ? () => {
                setShowCompleted(false);
                onNewSale();
              }
            : undefined
        }
      />
      <SettleTransactionDialog
        open={!!settleTx}
        onOpenChange={(v) => {
          if (!v) setSettleTx(null);
        }}
        companyId={companyId}
        transaction={settleTx}
        verb="Receber"
        onSettled={(info) => void handleSettled(info)}
        defaultPaymentMethod={
          method === "pix_manual"
            ? "pix"
            : method === "cash"
              ? "cash"
              : method === "debit_card"
                ? "debit_card"
                : method === "credit"
                  ? "other"
                  : ""
        }
      />
    </Dialog>
  );
}
