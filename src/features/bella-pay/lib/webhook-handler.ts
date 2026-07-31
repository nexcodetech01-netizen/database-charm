/**
 * Bella Pay — Handler puro do webhook, extraído do route file para permitir
 * testes de unidade (idempotência, transição de estados, promoção da venda).
 *
 * Contrato:
 *  - Não conhece `Response`, `Request`, nem `createFileRoute`.
 *  - Recebe um "admin-like" client (mesma API do supabaseAdmin) para permitir
 *    mock em memória nos testes.
 *  - O envelope de idempotência forte (unique index em bella_pay_webhook_events)
 *    permanece no route file — este handler assume que o evento já foi
 *    persistido e agora precisa APLICAR a mutação.
 */

import {
  resolveEventAction,
  isKnownEvent,
} from "./event-map";
import {
  canTransition,
  isChargeStatus,
  type ChargeStatus,
} from "./status-machine";
import { checkPaymentValue } from "./value-check";
import { toTransactionDate } from "./date-utils";

export interface WebhookPayload {
  id?: string;
  event?: string;
  payment?: {
    id?: string;
    status?: string;
    value?: number;
    netValue?: number;
    customer?: string;
    billingType?: string;
    paymentDate?: string;
    dueDate?: string;
    invoiceUrl?: string;
    description?: string;
    externalReference?: string;
    /** Presente em cobranças parceladas (cartão). Identifica o grupo. */
    installment?: string | null;
    /** Número da parcela (1..N). */
    installmentNumber?: number | null;
  };
}

export interface ChargeRow {
  id: string;
  company_id: string;
  customer_id: string | null;
  sale_id: string | null;
  financial_transaction_id: string | null;
  description: string | null;
  value: number;
  status: string | null;
  /** Cobranças parceladas: valor de cada parcela e nº de parcelas. */
  installment_value?: number | null;
  installment_count?: number | null;
}

export interface HandlerResult {
  chargeStatus?: string;
  financialTransactionId?: string | null;
  note?: string;
  transitionRejected?: boolean;
  valueMismatch?: boolean;
  warnings?: string[];
  salePromoted?: boolean;
}

/**
 * HOTFIX-004D — Intent puro decidido pelo handler. O route file executa
 * este intent via RPC `bella_pay_apply_webhook_result` (SECURITY DEFINER),
 * eliminando a dependência do SUPABASE_SERVICE_ROLE_KEY no webhook.
 */
export interface WebhookIntent {
  charge_id: string;
  company_id: string;
  sale_id: string | null;
  existing_ft_id: string | null;
  charge_patch: { status?: string; paid_at?: string; canceled_at?: string };
  settle_finance: boolean;
  payment_value: number;
  payment_id_ext: string | null;
  paid_at: string;
  transaction_date: string;
  description: string | null;
  /** ETAPA 2 — forma de recebimento aplicada na baixa financeira. */
  payment_method: "pix_gateway" | "card_gateway";
}

export interface DecideResult {
  result: HandlerResult;
  intent: WebhookIntent | null;
}

export type LogFn = (
  level: "info" | "warn" | "error",
  message: string,
  meta: Record<string, unknown>,
) => void;


/**
 * Subset mínimo do cliente Supabase que o handler usa. Assinatura pensada
 * para o mock em memória dos testes — não é o tipo completo do supabase-js.
 */
export interface AdminLike {
  from(table: string): TableBuilder;
}

interface TableBuilder {
  update(patch: Record<string, unknown>): UpdateBuilder;
  insert(row: Record<string, unknown>): InsertBuilder;
  select(cols?: string): SelectBuilder;
}
interface UpdateBuilder {
  eq(col: string, val: unknown): UpdateBuilder;
  neq(col: string, val: unknown): UpdateBuilder;
  select(cols?: string): {
    maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
  };
  then?: PromiseLike<{ error: { message: string } | null }>["then"];
}
interface InsertBuilder {
  select(cols?: string): {
    single(): Promise<{ data: Record<string, unknown>; error: { message: string } | null }>;
  };
}
interface SelectBuilder {
  eq(col: string, val: unknown): SelectBuilder;
  maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
}

const noopLog: LogFn = () => {};

export async function handleWebhookEvent(
  admin: AdminLike,
  event: string,
  payload: WebhookPayload,
  charge: ChargeRow | null,
  log: LogFn = noopLog,
  meta: Record<string, unknown> = {},
): Promise<HandlerResult> {
  const nowIso = new Date().toISOString();
  const warnings: string[] = [];

  if (!isKnownEvent(event)) {
    log("warn", `Evento desconhecido: ${event} — registrado e ignorado`, meta);
    return { note: "unknown_event", warnings: [`unknown_event:${event}`] };
  }

  if (!charge) {
    log("info", `${event} sem charge local — apenas registrado`, meta);
    return { note: "no_local_charge" };
  }

  const action = resolveEventAction(event);
  if (action.ignore) return { note: "ignored_by_map" };

  const currentStatus = isChargeStatus(charge.status) ? charge.status : null;
  if (action.status && !canTransition(currentStatus, action.status)) {
    log("warn", "Transição de status recusada pela máquina de estados", {
      ...meta,
      from: currentStatus,
      to: action.status,
    });
    return {
      note: "transition_rejected",
      transitionRejected: true,
      warnings: [`transition_rejected:${currentStatus}->${action.status}`],
    };
  }

  const patch: {
    status?: ChargeStatus;
    paid_at?: string | null;
    canceled_at?: string | null;
  } = {};
  if (action.status) patch.status = action.status;

  const rawPaymentDate = payload.payment?.paymentDate;
  const paidAtIso = rawPaymentDate
    ? new Date(rawPaymentDate).toISOString()
    : nowIso;
  const transactionDate = toTransactionDate(rawPaymentDate, nowIso);

  if (action.markPaid) patch.paid_at = paidAtIso;
  if (action.markCanceled) patch.canceled_at = nowIso;

  if (Object.keys(patch).length > 0) {
    const res = await (admin
      .from("bella_pay_charges")
      .update(patch)
      .eq("id", charge.id) as unknown as Promise<{ error: { message: string } | null }>);
    if (res?.error) throw new Error(`bella_pay_charges update: ${res.error.message}`);
  }

  let financialTransactionId: string | null = charge.financial_transaction_id;
  let salePromoted = false;

  if (action.settleFinance) {
    const received = Number(payload.payment?.value ?? 0);
    // Parceladas (cartão): Asaas envia PAYMENT_CONFIRMED por parcela com
    // value = valor da parcela. A charge local guarda o valor total. Sem
    // esse ajuste o value-check bloqueia a baixa por "value_mismatch".
    const isInstallment =
      (charge.installment_count ?? 0) > 1 &&
      !!charge.installment_value &&
      (!!payload.payment?.installment || !!payload.payment?.installmentNumber);
    const expected = isInstallment
      ? Number(charge.installment_value)
      : Number(charge.value ?? 0);
    const check = checkPaymentValue(expected, received);

    if (!check.ok) {
      log("warn", "Divergência de valor — baixa financeira bloqueada", {
        ...meta,
        expected: check.expected,
        received: check.received,
        diff: check.diff,
        isInstallment,
      });
      warnings.push(
        `value_mismatch:expected=${check.expected};received=${check.received};diff=${check.diff}`,
      );
      return {
        chargeStatus: action.status,
        financialTransactionId,
        valueMismatch: true,
        note: "value_mismatch",
        warnings,
      };
    }

    // HOTFIX-001: cobrança vinculada a venda → o servidor promove a venda
    // para 'paid'. Idempotente via `.neq('status','paid')`.
    // ETAPA 1 (estabilização PDV): `apply_sale_to_finance` NÃO baixa mais
    // nada — apenas garante o recebível PENDENTE. A baixa financeira
    // (payment_method/account_id/cash_movement/saldo) é exclusiva da RPC
    // `settle_financial_transaction`. O estoque segue por
    // `apply_sale_to_inventory`.
    if (charge.sale_id) {
      const { data: saleUpd, error: saleErr } = await admin
        .from("sales")
        .update({
          status: "paid",
          paid_at: paidAtIso,
          payment_confirmed_at: nowIso,
        })
        .eq("id", charge.sale_id)
        .neq("status", "paid")
        .select("id, finance_ref")
        .maybeSingle();
      if (saleErr) throw new Error(`sales update: ${saleErr.message}`);
      salePromoted = !!saleUpd;

      let saleFinanceRef: string | null =
        (saleUpd?.finance_ref as string | null | undefined) ?? null;
      if (!saleFinanceRef) {
        const { data: existing } = await admin
          .from("sales")
          .select("finance_ref")
          .eq("id", charge.sale_id)
          .maybeSingle();
        saleFinanceRef =
          (existing?.finance_ref as string | null | undefined) ?? null;
      }
      if (saleFinanceRef && saleFinanceRef !== financialTransactionId) {
        financialTransactionId = saleFinanceRef;
        await (admin
          .from("bella_pay_charges")
          .update({ financial_transaction_id: financialTransactionId })
          .eq("id", charge.id) as unknown as Promise<{ error: { message: string } | null }>);
      }
    } else if (!financialTransactionId && received > 0) {
      // Cobrança avulsa (sem sale_id) — cria SEMPRE o lançamento em aberto.
      // A baixa (paid_at, account_id, payment_method, cash_movement e saldo)
      // é responsabilidade EXCLUSIVA do motor `settle_financial_transaction`,
      // acionado pela RPC oficial `bella_pay_apply_webhook_result` no fluxo
      // de produção (`decideWebhookEvent`). Este handler legado (usado por
      // testes) não escreve mais `status: 'paid'` para não recriar o padrão
      // de FT órfã (sem cash_movement, sem account_id, sem payment_method).
      const { data: tx, error } = await admin
        .from("financial_transactions")
        .insert({
          company_id: charge.company_id,
          type: "income",
          status: "pending",
          amount: received,
          transaction_date: transactionDate,
          description:
            charge.description ??
            `Recebimento Bella Pay ${payload.payment?.id ?? ""}`.trim(),
          source: "bella_pay",
          reference_id: charge.id,
          reference_number: payload.payment?.id ?? null,
          asaas_charge_id: payload.payment?.id ?? null,
          bella_pay_charge_id: charge.id,
        })
        .select("id")
        .single();
      if (error) throw new Error(`financial_transactions insert: ${error.message}`);
      financialTransactionId = (tx as { id: string }).id;
      await (admin
        .from("bella_pay_charges")
        .update({ financial_transaction_id: financialTransactionId })
        .eq("id", charge.id) as unknown as Promise<{ error: { message: string } | null }>);
      warnings.push("legacy_handler:pending_only:settle_via_official_rpc");
    }

  }

  return {
    chargeStatus: action.status,
    financialTransactionId,
    salePromoted,
    warnings: warnings.length ? warnings : undefined,
  };
}

/**
 * HOTFIX-004D — Versão pura do handler: aplica event-map + status-machine +
 * value-check e devolve `{result, intent}`. O route file (webhook) só chama
 * a RPC `bella_pay_apply_webhook_result` com o intent, sem tocar tabelas
 * diretamente — logo, sem service role.
 *
 * A lógica é bit-a-bit equivalente à do `handleWebhookEvent`:
 *  - mesmos ramos (evento desconhecido, sem charge, ignore, transição
 *    recusada, valor divergente, promoção da venda, criação de FT avulsa)
 *  - mesmos warnings e mesma `HandlerResult` no retorno
 */
/** ETAPA 2 — mapeia o billingType do gateway para a forma de recebimento. */
export function resolveGatewayPaymentMethod(
  billingType?: string | null,
): "pix_gateway" | "card_gateway" {
  return String(billingType ?? "").toUpperCase() === "PIX"
    ? "pix_gateway"
    : "card_gateway";
}

export function decideWebhookEvent(
  event: string,
  payload: WebhookPayload,
  charge: ChargeRow | null,
  log: LogFn = noopLog,
  meta: Record<string, unknown> = {},
): DecideResult {
  const nowIso = new Date().toISOString();
  const warnings: string[] = [];
  const paymentMethod = resolveGatewayPaymentMethod(payload.payment?.billingType);

  if (!isKnownEvent(event)) {
    log("warn", `Evento desconhecido: ${event} — registrado e ignorado`, meta);
    return {
      result: { note: "unknown_event", warnings: [`unknown_event:${event}`] },
      intent: null,
    };
  }

  if (!charge) {
    log("info", `${event} sem charge local — apenas registrado`, meta);
    return { result: { note: "no_local_charge" }, intent: null };
  }

  const action = resolveEventAction(event);
  if (action.ignore) {
    return { result: { note: "ignored_by_map" }, intent: null };
  }

  const currentStatus = isChargeStatus(charge.status) ? charge.status : null;
  if (action.status && !canTransition(currentStatus, action.status)) {
    log("warn", "Transição de status recusada pela máquina de estados", {
      ...meta,
      from: currentStatus,
      to: action.status,
    });
    return {
      result: {
        note: "transition_rejected",
        transitionRejected: true,
        warnings: [`transition_rejected:${currentStatus}->${action.status}`],
      },
      intent: null,
    };
  }

  const patch: WebhookIntent["charge_patch"] = {};
  if (action.status) patch.status = action.status;

  const rawPaymentDate = payload.payment?.paymentDate;
  const paidAtIso = rawPaymentDate
    ? new Date(rawPaymentDate).toISOString()
    : nowIso;
  const transactionDate = toTransactionDate(rawPaymentDate, nowIso);

  if (action.markPaid) patch.paid_at = paidAtIso;
  if (action.markCanceled) patch.canceled_at = nowIso;

  let settleFinance = false;
  const received = Number(payload.payment?.value ?? 0);

  if (action.settleFinance) {
    // Parceladas (cartão): Asaas envia PAYMENT_CONFIRMED por parcela com
    // value = valor da parcela. Sem esse ajuste o value-check bloqueia por
    // "value_mismatch" comparando parcela vs. total da charge.
    const isInstallment =
      (charge.installment_count ?? 0) > 1 &&
      !!charge.installment_value &&
      (!!payload.payment?.installment || !!payload.payment?.installmentNumber);
    const expected = isInstallment
      ? Number(charge.installment_value)
      : Number(charge.value ?? 0);
    const check = checkPaymentValue(expected, received);

    if (!check.ok) {
      log("warn", "Divergência de valor — baixa financeira bloqueada", {
        ...meta,
        expected: check.expected,
        received: check.received,
        diff: check.diff,
        isInstallment,
      });
      warnings.push(
        `value_mismatch:expected=${check.expected};received=${check.received};diff=${check.diff}`,
      );
      // Ainda aplicamos o patch de status (mesmo comportamento de antes:
      // charge muda de status; finanças e venda ficam bloqueadas).
      return {
        result: {
          chargeStatus: action.status,
          financialTransactionId: charge.financial_transaction_id,
          valueMismatch: true,
          note: "value_mismatch",
          warnings,
        },
        intent: {
          charge_id: charge.id,
          company_id: charge.company_id,
          sale_id: null,
          existing_ft_id: charge.financial_transaction_id,
          charge_patch: patch,
          settle_finance: false,
          payment_value: received,
          payment_id_ext: payload.payment?.id ?? null,
          paid_at: paidAtIso,
          transaction_date: transactionDate,
          description: charge.description,
          payment_method: paymentMethod,
        },
      };
    }
    settleFinance = true;
  }

  return {
    result: {
      chargeStatus: action.status,
      // financialTransactionId real virá do retorno da RPC. Devolvemos o
      // atual como fallback para compatibilidade de forma.
      financialTransactionId: charge.financial_transaction_id,
      salePromoted: false,
      warnings: warnings.length ? warnings : undefined,
    },
    intent: {
      charge_id: charge.id,
      company_id: charge.company_id,
      sale_id: charge.sale_id,
      existing_ft_id: charge.financial_transaction_id,
      charge_patch: patch,
      settle_finance: settleFinance,
      payment_value: received,
      payment_id_ext: payload.payment?.id ?? null,
      paid_at: paidAtIso,
      transaction_date: transactionDate,
      description: charge.description,
      payment_method: paymentMethod,
    },
  };
}

