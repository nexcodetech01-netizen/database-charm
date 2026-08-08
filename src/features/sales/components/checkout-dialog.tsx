import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import QRCode from "qrcode";
import { refreshPixQrCode } from "@/features/bella-pay/lib/bella-pay.functions";
import {
  AlertCircle,
  Banknote,
  Barcode,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  HandCoins,
  Link as LinkIcon,
  Loader2,
  MessageCircle,
  ArrowLeft,
  QrCode,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ReceiptDialog } from "./receipt-dialog";
import { SaleCompletedDialog } from "./sale-completed-dialog";
import { generatePixBRCode } from "../lib/pix-brcode";


import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { useCreateAsaasCharge, useBellaPayConfig } from "@/features/bella-pay";
import {
  computeCreditCardCharge,
  CREDIT_CARD_ALLOWED_INSTALLMENTS,
  SETTLEMENT_DAYS_PIX,
} from "@/features/bella-pay/lib/credit-card-fee";
import { useCardFixedFee } from "@/features/bella-pay/lib/card-fixed-fee";
import { useBellaFeeCatalog } from "@/features/bella-pay/lib/fee-catalog";
import { BellaInlineSuggestion } from "@/features/bella-ai/components/bella-inline-suggestion";
import { useSetSaleStatus } from "../hooks/use-sales";
import { salesService } from "../services/sales.service";
import { SettleTransactionDialog } from "@/features/finance/components/settle-transaction-dialog";
import type { FinancialTransaction } from "@/features/finance/types";
import type { CheckoutMethod } from "../types";
import { returnToSaleItems } from "../lib/checkout-return";
import {
  useCreateCreditSale,
  CREDIT_PAYMENT_METHOD_OPTIONS,
} from "@/features/credit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** UI-only: "boleto" reaproveita o fluxo de link (billingType UNDEFINED). */
export type UiCheckoutMethod = CheckoutMethod | "boleto";



function onlyDigits(v: string | null | undefined): string {
  return (v ?? "").replace(/\D+/g, "");
}

/**
 * Normaliza telefone para uso no wa.me (E.164 sem "+").
 * Considera padrão brasileiro (DDD + número) e prepende 55 quando ausente.
 */
function toWhatsAppNumber(phone: string | null | undefined): string | null {
  const d = onlyDigits(phone);
  if (!d) return null;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  if (d.length === 12 || d.length === 13) return d;
  return d.length >= 10 ? d : null;
}

function buildPixMessage(params: {
  customerName?: string | null;
  companyName?: string | null;
  amount: number;
  pixPayload: string;
}): string {
  const nome = params.customerName?.trim() || "cliente";
  const empresa = params.companyName?.trim() || "nossa loja";
  return [
    `Olá, ${nome}!`,
    "",
    `Segue sua cobrança da ${empresa}.`,
    "",
    `Valor: ${formatCurrency(params.amount)}`,
    "",
    "PIX Copia e Cola:",
    params.pixPayload,
    "",
    "Caso prefira, utilize o QR Code exibido.",
    "",
    "Obrigado pela preferência!",
  ].join("\n");
}

function buildLinkMessage(params: {
  customerName?: string | null;
  amount: number;
  paymentLink: string;
}): string {
  const nome = params.customerName?.trim() || "cliente";
  return [
    `Olá, ${nome}!`,
    "",
    "Segue seu link para pagamento:",
    params.paymentLink,
    "",
    `Valor: ${formatCurrency(params.amount)}`,
    "",
    "Obrigado pela preferência!",
  ].join("\n");
}

async function copyToClipboard(value: string, successLabel: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(successLabel);
  } catch {
    toast.error("Não foi possível copiar.");
  }
}

function openWhatsApp(phone: string, message: string): void {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

type BillingType = "PIX" | "CREDIT_CARD" | "UNDEFINED";

const METHODS: {
  id: UiCheckoutMethod;
  label: string;
  icon: typeof QrCode;
  hint: string;
}[] = [
  { id: "pix_manual", label: "Pix", icon: Wallet, hint: "Recebido direto na sua conta" },
  { id: "credit_card", label: "Crédito", icon: CreditCard, hint: "Parcelado (Asaas)" },
  { id: "payment_link", label: "Link", icon: LinkIcon, hint: "PIX + cartão + boleto" },
  { id: "boleto", label: "Boleto", icon: Barcode, hint: "Boleto bancário (Asaas)" },
  { id: "cash", label: "Dinheiro", icon: Banknote, hint: "Baixa imediata + troco" },
  { id: "debit_card", label: "Débito", icon: CreditCard, hint: "Baixa manual" },
  { id: "credit", label: "Crediário", icon: HandCoins, hint: "Venda a prazo na conta do cliente" },
  { id: "pending_payment", label: "Pagamento Pendente", icon: Wallet, hint: "Venda finalizada. O pagamento será informado posteriormente." },
];


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
}


interface ChargeRow {
  id: string;
  status: string;
  invoice_url: string | null;
  payment_link: string | null;
  pix_qr_code: string | null;
  pix_payload: string | null;
  billing_type: string;
}

const RECEIVED = new Set(["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"]);

export function CheckoutDialog({
  open,
  onOpenChange,
  companyId,
  saleId,
  saleNumber,
  customerId,
  amount,
  subtotal,
  discount,
  shipping,
  description,
  onPaid,
  onNewSale,
  onContinueEditing,
  onReturnToItemsStateChange,
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
  
  // Efeito para preencher automaticamente o valor recebido em Dinheiro
  useEffect(() => {
    if (method === "cash" && !confirmed && !showCompleted) {
      setCashReceivedStr(amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  }, [method, amount, confirmed, showCompleted, setCashReceivedStr]);

  // FIN-001 — Entrada opcional (parcial): quando > 0, a cobrança é gerada
  // apenas pelo saldo restante, com vencimento configurável.
  const [entradaStr, setEntradaStr] = useState<string>("");
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

  const [cardFixedFee] = useCardFixedFee(companyId);
  const { snapshots: feeSnapshots } = useBellaFeeCatalog(companyId);

  const absorb =
    absorbOverride ?? Boolean(bellaConfig?.credit_card_absorb_fee);

  // Entrada parseada — nunca maior que o total, saldo nunca negativo.
  const entradaRaw = Math.max(0, Number(entradaStr.replace(",", ".")) || 0);
  const entradaValue = Math.min(entradaRaw, amount);
  const entradaExcedeu = entradaRaw > amount;
  const saldoValue = Math.max(0, amount - entradaValue);
  const chargeableAmount = entradaValue > 0 ? saldoValue : amount;

  const creditCardPreview = useMemo(() => {
    if (method !== "credit_card") return null;
    return computeCreditCardCharge(chargeableAmount, installments, {
      absorb,
      feePercent: Number(bellaConfig?.credit_card_fee_percent ?? 0),
      maxInstallments: Number(bellaConfig?.credit_card_max_installments ?? 3),
      fixedFee: cardFixedFee,
    });
  }, [method, installments, chargeableAmount, absorb, bellaConfig, cardFixedFee]);





  // Dados do cliente (nome/telefone) para composição das mensagens de compartilhamento.
  const customerQuery = useQuery({
    queryKey: ["checkout-customer", customerId],
    enabled: open && !!customerId,
    staleTime: 60_000,
    queryFn: async () => {
      if (!customerId) return null;
      const { data, error } = await supabase
        .from("customers")
        .select("name,phone,whatsapp")
        .eq("id", customerId)
        .maybeSingle();
      if (error) throw error;
      return data as { name: string | null; phone: string | null; whatsapp: string | null } | null;
    },
  });

  // Nome da empresa + dados PIX Próprio para saudação/geração do BR Code.
  const companyQuery = useQuery({
    queryKey: ["checkout-company", companyId],
    enabled: open && !!companyId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select(
          "name,pix_key,pix_key_type,pix_recipient_name,pix_recipient_city",
        )
        .eq("id", companyId)
        .maybeSingle();
      if (error) throw error;
      return data as {
        name: string | null;
        pix_key: string | null;
        pix_key_type: string | null;
        pix_recipient_name: string | null;
        pix_recipient_city: string | null;
      } | null;
    },
  });

  const customerName = customerQuery.data?.name ?? null;
  const customerPhone =
    customerQuery.data?.whatsapp ?? customerQuery.data?.phone ?? null;
  const whatsappNumber = toWhatsAppNumber(customerPhone);
  const companyName = companyQuery.data?.name ?? null;

  // PIX Próprio — payload BR Code (copia-e-cola) gerado a partir da chave do lojista.
  const ownPixPayload = useMemo(() => {
    if (method !== "pix_manual") return null;
    const key = companyQuery.data?.pix_key?.trim();
    if (!key) return null;
    try {
      return generatePixBRCode({
        pixKey: key,
        recipientName: companyQuery.data?.pix_recipient_name ?? companyQuery.data?.name ?? "RECEBEDOR",
        recipientCity: companyQuery.data?.pix_recipient_city ?? "BRASIL",
        amount,
        txid: saleNumber?.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || undefined,
        description: saleNumber ? `Venda ${saleNumber}` : undefined,
      });
    } catch {
      return null;
    }
  }, [method, companyQuery.data, amount, saleNumber]);

  // QR Code (data URL PNG) — regenerado quando o payload muda.
  const [ownPixQrDataUrl, setOwnPixQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!ownPixPayload) {
      setOwnPixQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(ownPixPayload, { margin: 1, width: 256, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setOwnPixQrDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setOwnPixQrDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [ownPixPayload]);



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
  useEffect(() => {
    if (!shouldPoll || !charge?.id) return;
    const chargeId = charge.id;
    const channel = supabase
      .channel(`checkout-charge-${chargeId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bella_pay_charges",
          filter: `id=eq.${chargeId}`,
        },
        (payload) => {
          const next = (payload.new ?? {}) as Partial<ChargeRow>;
          setCharge((prev) => {
            if (!prev) return prev;
            if (
              prev.status === next.status &&
              prev.invoice_url === next.invoice_url &&
              prev.payment_link === next.payment_link &&
              prev.pix_qr_code === next.pix_qr_code &&
              prev.pix_payload === next.pix_payload &&
              prev.billing_type === next.billing_type
            ) {
              return prev;
            }
            return { ...prev, ...next } as ChargeRow;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [shouldPoll, charge?.id]);



  // Revalidação dinâmica: se o caixa vinculado à venda for fechado enquanto
  // o operador está no checkout, bloqueamos qualquer nova ação de finalização.
  // O guard do banco também recusaria (trg_enforce_sale_open_cash_upd), mas
  // aqui damos feedback imediato e evitamos a chamada à API do Asaas.
  const { data: cashStillOpen } = useQuery({
    queryKey: ["checkout", "cash-open", saleId],
    enabled: open && !confirmed,
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data: s, error } = await supabase
        .from("sales")
        .select("cash_session_id")
        .eq("id", saleId)
        .maybeSingle();
      if (error) throw error;
      if (!s?.cash_session_id) return false;
      const { data: sess, error: e2 } = await supabase
        .from("cash_sessions")
        .select("status")
        .eq("id", s.cash_session_id)
        .maybeSingle();
      if (e2) throw e2;
      return sess?.status === "open";
    },
  });
  const cashClosed = cashStillOpen === false;


  // BUG-002 (Payment Link) — Realtime como caminho preferencial. Evita a
  // janela de até 3s do poll, e é praticamente instantâneo quando o
  // webhook grava sales.status='paid'.
  useEffect(() => {
    if (!open || !saleId || confirmed) return;
    const channel = supabase
      .channel(`checkout-sale-${saleId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sales",
          filter: `id=eq.${saleId}`,
        },
        (payload) => {
          const next = (payload.new ?? {}) as { status?: string };
          if (
            next.status === "paid" &&
            !confirmedRef.current &&
            !returningToItemsRef.current
          ) {
            onWebhookConfirmed();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // onWebhookConfirmed é estável o suficiente (usa refs); não incluir
    // para evitar re-subscribe a cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saleId, confirmed]);
  // FIX PIX-QR-PROD — em produção, o QR Code PIX pode não vir na criação
  // da cobrança (Asaas leva alguns instantes). Consulta o endpoint
  // `/payments/:id/pixQrCode` até persistir o QR na cobrança. O polling
  // principal (acima) já lê `pix_qr_code` do banco e re-renderiza sozinho.
  const refreshPixQrFn = useServerFn(refreshPixQrCode);


  /**
   * Persiste no cabeçalho da venda o meio de pagamento efetivo e o número
   * de parcelas (obrigatório em cartão de crédito). Usado antes de qualquer
   * confirmação (manual ou via webhook) para garantir que Bella IA, Painel
   * Executivo e Relatórios consigam apurar taxas e receita líquida.
   */
  async function persistPaymentSelection() {
    try {
      const paymentMethod =
        method === "pending_payment"
          ? null
          : method === "cash"
            ? "cash"
            : method === "debit_card"
              ? "debit_card"
              : method === "credit_card"
                ? "credit_card"
                : method;
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
          paymentMethod: method === "pix_manual" ? "pix" : (method as any),
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
  async function handleSettled() {
    setSettleTx(null);
    confirmedRef.current = true;
    setConfirmed(true);
    try {
      await setStatus.mutateAsync({ id: saleId, status: "paid" });
      toast.success("Pagamento registrado com sucesso", {
        description: saleNumber ? `Venda ${saleNumber} concluída.` : undefined,
      });
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
  async function requestClose() {
    if (!confirmed && !charge) {
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
    void qc.cancelQueries({ queryKey: ["checkout", "sale-poll", saleId] });
    void qc.cancelQueries({ queryKey: ["checkout", "cash-open", saleId] });

    returnToSaleItems({
      prepareEditor: onContinueEditing,
      closeCheckout: () => onOpenChange(false),
      rollbackSaleStatus:
        !confirmed && !charge
          ? async () => {
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

    // Dinheiro/Débito/PIX Próprio/Pendente: baixa manual ou fluxo pendente.
    if (method === "cash" || method === "debit_card" || method === "pix_manual" || method === "pending_payment") {
      if (method === "pix_manual" && !ownPixPayload) {
        toast.error("Configure a chave PIX em Configurações → Empresa antes de usar PIX Próprio.");
        return;
      }

      if (method === "pending_payment") {
        if (!customerId) {
          toast.error("Venda pendente exige cliente vinculado.");
          return;
        }
        confirmedRef.current = true;
        setConfirmed(true);
        try {
          await persistPaymentSelection();
          await setStatus.mutateAsync({ id: saleId, status: "pending" });
          toast.success("Venda Registrada", {
            description: "Pagamento pendente registrado com sucesso.",
          });
          onPaid?.({ method });
          openCompletedDialog();
        } catch (e) {
          confirmedRef.current = false;
          setConfirmed(false);
          toast.error("Erro ao finalizar venda com pagamento pendente");
        }
        return;
      }

      await beginManualSettlement();
      return;
    }

    // Crediário — abre conta no cliente e registra entrada (opcional).
    if (method === "credit") {
      if (!customerId) {
        toast.error("Para vender no crediário, selecione um cliente cadastrado.");
        return;
      }
      
      // Ao invés de confirmar direto, abre o modal de opções de parcelamento/vencimento
      setShowCreditConfig(true);
      return;
    }


    // PIX/Cartão/Link: se cobrança ainda não gerada, gerar.
    if (!charge) {
      await handleGenerate();
      return;
    }
    // Se já confirmado pelo webhook, abrir modal de conclusão.
    if (RECEIVED.has(String(charge.status))) {
      onWebhookConfirmed();
      openCompletedDialog();
    } else {
      toast.info("Aguardando confirmação do pagamento…", {
        description:
          "A confirmação é feita pelo servidor via webhook. Você pode fechar esta janela com segurança — a venda será marcada como paga automaticamente.",
      });
    }
  }

  async function handleConfirmCredit() {
    const payload = {
      companyId,
      saleId,
      customerId: customerId!,
      downPayment: entradaValue,
      downPaymentMethod: entradaValue > 0 ? creditDownMethod : null,
      dueDate: saldoDueDate || null,
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


  const showAsaasFlow =
    method === "credit_card" || method === "payment_link" || method === "boleto";

  // Método efetivo repassado a componentes que só conhecem CheckoutMethod.
  const effectiveMethod: CheckoutMethod =
    method === "boleto" ? "payment_link" : method;

  // ---- FIN-001 — Dinheiro (troco) ----
  const cashReceived = Math.max(0, Number(cashReceivedStr.replace(",", ".")) || 0);
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
      <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
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

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 py-4">
        {/* Valor */}
        <div className="rounded-xl border border-border bg-muted/30 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Total a receber
          </div>
          <div className="mt-1 text-4xl font-bold tabular-nums text-primary">
            {formatCurrency(amount)}
          </div>

          {/* FIN-001 — resumo em tempo real (subtotal, desconto, frete, entrada, saldo) */}
          {(subtotal != null || discount != null || shipping != null || entradaValue > 0) ? (
            <div className="mt-3 space-y-1 border-t border-border/60 pt-3 text-xs">
              {subtotal != null ? (
                <SummaryLine label="Subtotal" value={formatCurrency(subtotal)} />
              ) : null}
              {discount != null && discount > 0 ? (
                <SummaryLine label="Desconto" value={`-${formatCurrency(discount)}`} />
              ) : null}
              {shipping != null && shipping > 0 ? (
                <SummaryLine label="Frete" value={`+${formatCurrency(shipping)}`} />
              ) : null}
              <SummaryLine label="Total da Venda" value={formatCurrency(amount)} strong />
              {entradaValue > 0 ? (
                <>
                  <SummaryLine label="Valor Pago (Entrada)" value={formatCurrency(entradaValue)} className="text-success" />
                  <SummaryLine label="Saldo Devedor / Restante" value={formatCurrency(saldoValue)} strong className="text-destructive font-bold" />
                  <div className="flex justify-between text-[11px] text-muted-foreground">
                    <span>Vencimento do saldo</span>
                    <span>{new Date(saldoDueDate + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* FIN-001 — Entrada + vencimento do saldo */}
        <div className="rounded-xl border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
                Entrada (R$) — opcional
              </Label>
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={entradaStr}
                onChange={(e) => setEntradaStr(e.target.value)}
                className="tabular-nums"
              />
              {entradaExcedeu ? (
                <p className="mt-1 text-[11px] text-destructive">
                  Entrada limitada ao total da venda ({formatCurrency(amount)}).
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Se informada, a cobrança usará apenas o saldo restante.
                </p>
              )}
            </div>
            <div>
              <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
                Vencimento do saldo
              </Label>
              <Input
                type="date"
                value={saldoDueDate}
                disabled={entradaValue <= 0}
                onChange={(e) => setSaldoDueDate(e.target.value)}
                className="tabular-nums"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Usado apenas quando há entrada.
              </p>
          </div>
        </div>

        {method === "credit" && !customerId && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5">
            <div className="flex items-center gap-3 text-destructive mb-2">
              <AlertCircle className="h-6 w-6" />
              <h3 className="font-bold">Crediário Bloqueado</h3>
            </div>
            <p className="text-sm text-destructive font-medium mb-3">
              Para vender no crediário, selecione um cliente cadastrado.
            </p>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={handleContinueEditing}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Selecionar Cliente
            </Button>
          </div>
        )}

        </div>

        {/* Métodos */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {METHODS.map((m) => {
            const Icon = m.icon;
            const active = method === m.id;
            return (
              <button
                key={m.id}
                type="button"
                disabled={!!charge && !confirmed}
                onClick={() => {
                  setMethod(m.id);
                  setCharge(null);
                  setCashReceivedStr("");
                }}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition",
                  active
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50 hover:bg-muted/40",
                  charge && !confirmed ? "opacity-60" : "",
                )}
              >
                <div
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-md",
                    active ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{m.label}</div>
                  <div className="text-[11px] text-muted-foreground">{m.hint}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Painel dinâmico por método */}
        <div className="rounded-xl border border-border p-4">
          {confirmed ? (
            <div className="flex items-center gap-3 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
              <div>
                <div className="text-sm font-semibold">Pagamento confirmado</div>
                <div className="text-xs text-muted-foreground">
                  Clique em Concluir venda para imprimir o cupom.
                </div>
              </div>
            </div>
          ) : method === "cash" ? (
            <div className="space-y-3">
              <div>
                <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
                  Valor recebido
                </Label>
                <Input
                  inputMode="decimal"
                  placeholder={formatCurrency(amount)}
                  value={cashReceivedStr}
                  onChange={(e) => setCashReceivedStr(e.target.value)}
                  className="text-lg tabular-nums"
                />
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-muted/40 p-2">
                  <div className="text-muted-foreground">Total</div>
                  <div className="font-semibold tabular-nums">{formatCurrency(amount)}</div>
                </div>
                <div
                  className={cn(
                    "rounded-md p-2",
                    cashShort > 0 ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                  )}
                >
                  <div className="opacity-80">{cashShort > 0 ? "Falta" : "Troco"}</div>
                  <div className="font-semibold tabular-nums">
                    {formatCurrency(cashShort > 0 ? cashShort : cashChange)}
                  </div>
                </div>
              </div>
            </div>
          ) : method === "debit_card" ? (
            <div className="space-y-2 text-xs">
              <div className="text-sm text-muted-foreground">
                Baixa manual do débito (sem TEF integrado).
              </div>
              {debitSnapshot ? (
                <div className="space-y-1 rounded-md bg-muted/40 p-3">
                  <SummaryLine label="Valor da venda" value={formatCurrency(amount)} />
                  <SummaryLine
                    label={`Taxa (${debitSnapshot.percent}%${debitSnapshot.fixed ? ` + ${formatCurrency(debitSnapshot.fixed)}` : ""})`}
                    value={`-${formatCurrency(debitFee)}`}
                  />
                  <SummaryLine label="Você receberá" value={formatCurrency(debitNet)} strong />
                </div>
              ) : null}
            </div>

          ) : method === "pix_manual" ? (
            <div className="space-y-3">
              {!ownPixPayload ? (
                <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                  Configure a <strong>Chave PIX</strong> e o <strong>Nome / Cidade do recebedor</strong> em
                  {" "}<em>Configurações → Empresa → PIX Próprio</em> para gerar o QR Code.
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                  {ownPixQrDataUrl ? (
                    <img
                      src={ownPixQrDataUrl}
                      alt="QR Code PIX Próprio"
                      className="h-48 w-48 rounded-md border border-border bg-white p-2"
                    />
                  ) : (
                    <div className="grid h-48 w-48 place-items-center rounded-md border border-border bg-muted/30">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="text-xs text-muted-foreground">
                      PIX recebido direto na conta do lojista — sem intermediário.
                      Confirme o recebimento ao visualizar o depósito no banco.
                    </div>
                    <div className="max-h-24 overflow-hidden break-all rounded-md border border-border bg-muted/40 p-2 font-mono text-[10px]">
                      {ownPixPayload}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(ownPixPayload, "PIX copiado")}
                      >
                        <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar PIX
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={!whatsappNumber}
                        title={!whatsappNumber ? "Cliente sem WhatsApp cadastrado" : undefined}
                        onClick={() => {
                          if (!whatsappNumber) return;
                          openWhatsApp(
                            whatsappNumber,
                            buildPixMessage({
                              customerName,
                              companyName,
                              amount,
                              pixPayload: ownPixPayload,
                            }),
                          );
                        }}
                      >
                        <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
                        Compartilhar WhatsApp
                      </Button>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Após visualizar o pagamento no seu banco, clique em
                      <strong> Confirmar pagamento</strong> para dar baixa no estoque
                      e no financeiro.
                    </div>
                  </div>
                </div>
              )}
            </div>

          ) : method === "credit" ? (
            <div className="space-y-3">
              {!customerId ? (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  Selecione um cliente antes de abrir crediário.
                </div>
              ) : (
                <>
                  <div className="rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                    Ao confirmar, será aberta uma <strong className="text-foreground">conta de crediário</strong> vinculada
                    a este cliente. A entrada informada acima cai no financeiro imediatamente e o saldo restante fica em aberto até a quitação.
                  </div>
                  <div className="space-y-1 rounded-md border p-3 text-xs">
                    <SummaryLine label="Total da venda" value={formatCurrency(amount)} />
                    <SummaryLine
                      label="Entrada"
                      value={entradaValue > 0 ? `-${formatCurrency(entradaValue)}` : "—"}
                    />
                    <SummaryLine
                      label="Saldo no crediário"
                      value={formatCurrency(Math.max(0, amount - entradaValue))}
                      strong
                    />
                    <div className="flex justify-between pt-1 text-[11px] text-muted-foreground">
                      <span>Vencimento do saldo</span>
                      <span>{new Date(saldoDueDate + "T00:00:00").toLocaleDateString("pt-BR")}</span>
                    </div>
                  </div>
                  {entradaValue > 0 ? (
                    <div>
                      <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
                        Forma de pagamento da entrada
                      </Label>
                      <Select value={creditDownMethod} onValueChange={setCreditDownMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CREDIT_PAYMENT_METHOD_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  <div>
                    <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
                      Observações (opcional)
                    </Label>
                    <Input
                      value={creditNotes}
                      onChange={(e) => setCreditNotes(e.target.value)}
                      placeholder="Ex.: cliente prometeu quitar em 30 dias"
                    />
                  </div>
                </>
              )}
            </div>

          ) : showAsaasFlow && !charge ? (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">

                {method === "credit_card"
                    ? "Escolha o parcelamento e gere a cobrança. O cliente pagará em ambiente seguro."
                    : method === "boleto"
                      ? "Gera boleto bancário via Asaas. Compensação em até 2 dias úteis após pagamento."
                      : "Gera link de pagamento (PIX, cartão ou boleto) para compartilhar."}
              </div>


              {method === "credit_card" && creditCardPreview ? (
                <div className="space-y-3 rounded-md border p-3">
                  {/* FIN-001 — Switch "Loja absorve a taxa" (override de sessão) */}
                  <div className="flex items-start justify-between gap-3 rounded-md bg-muted/40 p-3">
                    <div className="min-w-0">
                      <Label htmlFor="absorb-fee" className="text-sm font-medium">
                        Loja absorve a taxa
                      </Label>
                      <p className="text-[11px] text-muted-foreground">
                        {absorb
                          ? "A taxa sai do seu lucro. O cliente paga o preço cheio."
                          : "A taxa é somada ao valor cobrado do cliente."}
                      </p>
                    </div>
                    <Switch
                      id="absorb-fee"
                      checked={absorb}
                      onCheckedChange={(v) => setAbsorbOverride(v)}
                    />
                  </div>

                  <div>
                    <Label className="mb-1.5 block text-xs uppercase tracking-wide text-muted-foreground">
                      Parcelamento
                    </Label>
                    <div className="flex gap-2">
                      {CREDIT_CARD_ALLOWED_INSTALLMENTS.filter(
                        (n) =>
                          n <=
                          Number(
                            bellaConfig?.credit_card_max_installments ?? 3,
                          ),
                      ).map((n) => {
                        const preview = computeCreditCardCharge(chargeableAmount, n, {
                          absorb,
                          feePercent: Number(
                            bellaConfig?.credit_card_fee_percent ?? 0,
                          ),
                          maxInstallments: Number(
                            bellaConfig?.credit_card_max_installments ?? 3,
                          ),
                          fixedFee: cardFixedFee,
                        });
                        const selected = installments === n;
                        return (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setInstallments(n)}
                            className={`flex-1 rounded-md border px-3 py-2 text-left text-sm transition ${
                              selected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/50"
                            }`}
                          >
                            <div className="font-medium">
                              {n}x {n === 1 ? "à vista" : ""}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatCurrency(preview.installmentValue)}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* PDV-014 — Resumo inteligente. Sempre mostra líquido e recebimento. */}
                  <div className="space-y-1 rounded-md bg-muted/40 p-3 text-xs">
                    {absorb ? (
                      <>
                        <SummaryLine
                          label="Produto"
                          value={formatCurrency(creditCardPreview.originalValue)}
                        />
                        <SummaryLine
                          label="Taxa"
                          value={`+${formatCurrency(creditCardPreview.addedFee)}`}
                        />
                        <SummaryLine
                          label="Total cobrado do cliente"
                          value={formatCurrency(creditCardPreview.chargedValue)}
                          strong
                        />
                      </>
                    ) : (
                      <>
                        <SummaryLine
                          label="Valor da venda"
                          value={formatCurrency(creditCardPreview.chargedValue)}
                        />
                        <SummaryLine
                          label="Taxa"
                          value={`-${formatCurrency(creditCardPreview.processorFee)}`}
                        />
                        <SummaryLine
                          label="Você receberá"
                          value={formatCurrency(creditCardPreview.netValue)}
                          strong
                        />
                      </>
                    )}
                    <div className="mt-1 flex justify-between border-t pt-1 text-muted-foreground">
                      <span>Recebimento</span>
                      <span>{creditCardPreview.settlementDays} dias</span>
                    </div>
                    <div className="pt-1 text-center text-[11px] text-muted-foreground">
                      {creditCardPreview.installmentCount}x de{" "}
                      {formatCurrency(creditCardPreview.installmentValue)}
                    </div>
                  </div>

                  {/* Bella — sugestão contextual */}
                  {creditCardPreview.processorFee >= 5 ? (
                    <div className="flex items-start justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 p-3 text-xs">
                      <div>
                        <div className="font-medium text-primary">Bella sugere</div>
                        <p className="mt-0.5 text-muted-foreground">
                          Esta venda perde{" "}
                          <strong className="text-foreground">
                            {formatCurrency(creditCardPreview.processorFee)}
                          </strong>{" "}
                          em taxas. PIX recebe em {SETTLEMENT_DAYS_PIX} dia
                          {SETTLEMENT_DAYS_PIX > 1 ? "s" : ""}, sem taxa.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setMethod("pix_manual");
                          setCharge(null);
                        }}
                      >
                        Alterar para PIX
                      </Button>
                    </div>
                  ) : null}

                  {/* FIN-001 — Aviso de absorção da taxa */}
                  {absorb && creditCardPreview.processorFee > 0 ? (
                    <BellaInlineSuggestion
                      tone="warning"
                      title="Loja absorvendo a taxa"
                      message={`Lucro reduzido em ${formatCurrency(creditCardPreview.processorFee)} devido à absorção da taxa.`}
                      action={{
                        label: "Repassar ao cliente",
                        onClick: () => setAbsorbOverride(false),
                      }}
                    />
                  ) : null}
                </div>
              ) : null}


              <Button
                type="button"
                onClick={handleGenerate}
                disabled={
                  generating ||
                  createCharge.isPending ||
                  entradaExcedeu ||
                  chargeableAmount <= 0
                }
              >
                {generating || createCharge.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : null}
                Gerar cobrança {entradaValue > 0 ? `de ${formatCurrency(saldoValue)}` : ""}
              </Button>
            </div>

          ) : method === "pending_payment" ? (
            <div className="space-y-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-5">
              <div className="flex items-center gap-3 text-yellow-600 dark:text-yellow-500">
                <Wallet className="h-6 w-6" />
                <h3 className="font-bold">Pagamento Pendente</h3>
              </div>
              
              {!customerId ? (
                <div className="space-y-3">
                  <p className="text-sm text-yellow-700 dark:text-yellow-400 font-medium">
                    Para utilizar esta forma de pagamento é necessário selecionar um cliente.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="border-yellow-500/50 hover:bg-yellow-500/20"
                    onClick={handleContinueEditing}
                  >
                    <ArrowLeft className="mr-1.5 h-4 w-4" /> Selecionar Cliente
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    A venda será finalizada com status <span className="font-semibold text-foreground">Pendente</span>.
                    O estoque será baixado imediatamente e um título será criado no <span className="font-semibold text-foreground">Contas a Receber</span>.
                  </p>
                  <div className="rounded-lg bg-background/50 p-3 text-xs border border-yellow-500/20">
                    O pagamento poderá ser informado posteriormente na tela de detalhes da venda ou no módulo financeiro.
                  </div>
                </>
              )}
            </div>

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

        <DialogFooter className="shrink-0 flex-col-reverse gap-2 border-t bg-card px-5 py-3 sm:flex-row">
          {onContinueEditing && !confirmed ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleContinueEditing}
              title="Fecha o pagamento e volta para editar os itens desta venda"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar aos itens
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            onClick={requestClose}
            disabled={setStatus.isPending}
          >
            <XCircle className="mr-1.5 h-4 w-4" /> Fechar
          </Button>
          {confirmed || method === "cash" || method === "debit_card" || method === "pix_manual" || method === "credit" || method === "pending_payment" ? (
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={
                setStatus.isPending ||
                createCredit.isPending ||
                openingSettle ||
                (!confirmed && cashClosed) ||
                (method === "cash" && !confirmed && !canConfirmCash) ||
                (method === "pix_manual" && !confirmed && !ownPixPayload) ||
                ((method === "credit" || method === "pending_payment") && !confirmed && !customerId)
              }


              className="min-w-[180px]"
            >
              {setStatus.isPending || createCredit.isPending || openingSettle ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 h-4 w-4" />
              )}
              {confirmed
                ? "Concluído"
                : method === "pix_manual"
                  ? "Confirmar Pagamento (Pix)"
                  : method === "cash"
                    ? "Confirmar Recebimento (Dinheiro)"
                    : method === "debit_card"
                      ? "Confirmar Débito"
                      : method === "credit"
                        ? "Abrir Crediário"
                        : method === "pending_payment"
                          ? "Criar Venda Pendente"
                          : "Confirmar"}

            </Button>
          ) : null}


        </DialogFooter>
      </DialogContent>
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
        onOpenChange={setShowCompleted}
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
        onSettled={() => void handleSettled()}
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


function ChargeView({
  charge,
  method,
  amount,
  customerName,
  companyName,
  whatsappNumber,
}: {
  charge: ChargeRow;
  method: CheckoutMethod;
  amount: number;
  customerName: string | null;
  companyName: string | null;
  whatsappNumber: string | null;
}) {
  const link = charge.invoice_url ?? charge.payment_link ?? null;
  const received = RECEIVED.has(String(charge.status));

  const pixMessage = null;

  const linkMessage =
    (method === "payment_link" || method === "credit_card") && link
      ? buildLinkMessage({ customerName, amount, paymentLink: link })
      : null;

  const noPhoneTooltip = "Cliente sem WhatsApp cadastrado";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <StatusPill status={charge.status} />
        {!received ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Aguardando confirmação…
          </span>
        ) : null}
      </div>


      {method === "payment_link" || method === "credit_card" ? (
        link ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" asChild>
              <a href={link} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Abrir Link
              </a>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(link, "Link copiado")}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar Link
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!whatsappNumber || !linkMessage}
              title={!whatsappNumber ? noPhoneTooltip : undefined}
              onClick={() => {
                if (whatsappNumber && linkMessage) {
                  openWhatsApp(whatsappNumber, linkMessage);
                }
              }}
            >
              <MessageCircle className="mr-1.5 h-3.5 w-3.5" />
              Compartilhar WhatsApp
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!linkMessage}
              onClick={() => {
                if (linkMessage) copyToClipboard(linkMessage, "Mensagem copiada");
              }}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar Mensagem
            </Button>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            Link ainda não disponível.
          </div>
        )
      ) : null}
    </div>
  );
}


function SummaryLine({
  label,
  value,
  strong,
  className,
}: {
  label: string;
  value: string;
  strong?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex justify-between items-center",
        strong ? "border-t pt-1 font-semibold text-foreground" : "text-muted-foreground",
        className
      )}
    >
      <span>{label}</span>
      <span className={cn("tabular-nums", strong ? "text-foreground text-base" : "")}>{value}</span>
    </div>
  );
}



function StatusPill({ status }: { status: string }) {
  const s = String(status).toUpperCase();
  const received = RECEIVED.has(s);
  const overdue = s === "OVERDUE";
  const canceled = ["CANCELED", "REFUNDED"].includes(s);
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-mono text-[10px]",
        received && "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
        overdue && "border-amber-500/40 bg-amber-500/10 text-amber-600",
        canceled && "border-destructive/40 bg-destructive/10 text-destructive",
      )}
    >
      {s}
    </Badge>
  );
}

