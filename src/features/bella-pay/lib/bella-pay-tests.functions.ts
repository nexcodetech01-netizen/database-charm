/**
 * Bella Pay — Painel de Testes Internos (admin-only).
 *
 * Estas server functions são de leitura/execução direta contra a API do
 * Asaas para validar a integração antes da migração para produção.
 * NÃO alteram a lógica de negócio existente:
 *  - reutilizam `asaasFetch` (retry/timeout já homologados)
 *  - reutilizam a configuração salva em `bella_pay_config`
 *  - o webhook oficial continua sendo o único responsável por confirmar venda
 *
 * Autorização: exige que o caller seja o dono (`companies.owner_id`) ou
 * possua o papel `admin` na empresa.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { integrationFetch } from "@/lib/http-client.server";

type Env = "sandbox" | "production";

interface AuthedContext {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
}

async function assertAdmin(ctx: AuthedContext, companyId: string) {
  const { supabase, userId } = ctx;
  const { data: owned } = await supabase
    .from("companies")
    .select("id")
    .eq("id", companyId)
    .eq("owner_id", userId)
    .maybeSingle();
  if (owned) return;

  const { data: adminRow } = await supabase
    .from("user_roles")
    .select("role_id, roles!inner(name)")
    .eq("user_id", userId)
    .eq("company_id", companyId)
    .in("roles.name", ["admin", "owner"])
    .maybeSingle();
  if (!adminRow) {
    throw new Error("Apenas administradores podem executar testes do Asaas.");
  }
}

async function resolveCreds(
  supabase: AuthedContext["supabase"],
  companyId: string,
): Promise<{ apiKey: string; env: Env }> {
  const { data: cfg } = await supabase
    .from("bella_pay_config")
    .select("environment, api_key_sandbox, api_key_production")
    .eq("company_id", companyId)
    .maybeSingle<{
      environment: Env | null;
      api_key_sandbox: string | null;
      api_key_production: string | null;
    }>();
  if (!cfg) throw new Error("Bella Pay não configurado para esta empresa.");
  const env: Env = cfg.environment ?? "sandbox";
  const apiKey =
    env === "production" ? cfg.api_key_production : cfg.api_key_sandbox;
  if (!apiKey) throw new Error(`Chave da API (${env}) não configurada.`);
  return { apiKey, env };
}

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

interface CallResult {
  ok: boolean;
  status: number | null;
  durationMs: number;
  request: { method: string; endpoint: string; body?: Json };
  response: Json;
  error?: string;
}

async function callAsaas(
  apiKey: string,
  env: Env,
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: Record<string, unknown>,
): Promise<CallResult> {
  const started = Date.now();
  const base =
    env === "production"
      ? "https://api.asaas.com/v3"
      : "https://api-sandbox.asaas.com/v3";
  const safeBody: Json = body
    ? (JSON.parse(JSON.stringify(body)) as Json)
    : null;
  try {
    const res = await integrationFetch(
      `${base}${path}`,
      {
        method,
        headers: {
          "Content-Type": "application/json",
          access_token: apiKey,
          "User-Agent": "NexOS-BellaPay-Tests/1.0",
        },
        body: body ? JSON.stringify(body) : undefined,
      },
      { integration: "asaas:diagnostics", timeoutMs: 15_000 },
    );
    const text = await res.text();
    let parsed: Json = text as Json;
    try {
      parsed = text ? (JSON.parse(text) as Json) : null;
    } catch {
      /* keep raw */
    }
    const parsedObj = parsed as { errors?: Array<{ description: string }>; message?: string } | null;
    return {
      ok: res.ok,
      status: res.status,
      durationMs: Date.now() - started,
      request: { method, endpoint: path, body: safeBody ?? undefined },
      response: parsed,
      error: res.ok
        ? undefined
        : parsedObj?.errors?.[0]?.description ??
          parsedObj?.message ??
          `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: null,
      durationMs: Date.now() - started,
      request: { method, endpoint: path, body: safeBody ?? undefined },
      response: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ─────────────────────────────────────────────────────────────
// 1) Criar cliente
// ─────────────────────────────────────────────────────────────
export const testCreateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      companyId: string;
      name: string;
      cpfCnpj: string;
      email?: string;
      phone?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as AuthedContext, data.companyId);
    const { apiKey, env } = await resolveCreds(context.supabase, data.companyId);
    return callAsaas(apiKey, env, "POST", "/customers", {
      name: data.name,
      cpfCnpj: data.cpfCnpj.replace(/\D/g, ""),
      email: data.email || undefined,
      mobilePhone: data.phone || undefined,
    });
  });

// ─────────────────────────────────────────────────────────────
// 2/3/4) Criar cobrança PIX / Boleto / Link (UNDEFINED)
// ─────────────────────────────────────────────────────────────
export const testCreateCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      companyId: string;
      customerId: string; // Asaas customer id
      billingType: "PIX" | "BOLETO" | "UNDEFINED" | "CREDIT_CARD";
      value: number;
      dueDate: string; // yyyy-mm-dd
      description?: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as AuthedContext, data.companyId);
    const { apiKey, env } = await resolveCreds(context.supabase, data.companyId);
    const res = await callAsaas(apiKey, env, "POST", "/payments", {
      customer: data.customerId,
      billingType: data.billingType,
      value: data.value,
      dueDate: data.dueDate,
      description: data.description,
    });
    // Para PIX, tentar buscar QR Code
    if (res.ok && data.billingType === "PIX") {
      const chargeId = (res.response as { id?: string })?.id;
      if (chargeId) {
        const qr = await callAsaas(
          apiKey,
          env,
          "GET",
          `/payments/${chargeId}/pixQrCode`,
        );
        return { charge: res, pixQr: qr };
      }
    }
    return { charge: res, pixQr: null };
  });

// ─────────────────────────────────────────────────────────────
// 5) Consultar status
// ─────────────────────────────────────────────────────────────
export const testGetCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string; chargeId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as AuthedContext, data.companyId);
    const { apiKey, env } = await resolveCreds(context.supabase, data.companyId);
    return callAsaas(apiKey, env, "GET", `/payments/${data.chargeId}`);
  });

// ─────────────────────────────────────────────────────────────
// 6) Simular recebimento (Sandbox)
// ─────────────────────────────────────────────────────────────
export const testSimulateReceive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId: string; chargeId: string }) => input)
  .handler(async ({ data, context }) => {
    await assertAdmin(context as AuthedContext, data.companyId);
    const { apiKey, env } = await resolveCreds(context.supabase, data.companyId);
    if (env !== "sandbox") {
      return {
        ok: false,
        status: null,
        durationMs: 0,
        request: {
          method: "POST",
          endpoint: `/payments/${data.chargeId}/receiveInCash`,
        },
        response: null,
        error:
          "Simulação disponível apenas no ambiente Sandbox. Alterne o ambiente antes de testar.",
      } satisfies CallResult;
    }
    // Sandbox aceita marcar como recebido em dinheiro para simular liquidação
    return callAsaas(apiKey, env, "POST", `/payments/${data.chargeId}/receiveInCash`, {
      paymentDate: new Date().toISOString().slice(0, 10),
      value: undefined,
      notifyCustomer: false,
    });
  });

// ─────────────────────────────────────────────────────────────
// 7 + 8) Validar recebimento do webhook e atualização da venda
// ─────────────────────────────────────────────────────────────
export const testInspectWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { companyId: string; asaasChargeId: string }) => input,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context as AuthedContext, data.companyId);
    const { supabase } = context;

    const { data: events } = await supabase
      .from("bella_pay_webhook_events")
      .select(
        "id, event_type, charge_status, processed, processed_at, error, value_mismatch, transition_rejected, sale_id, financial_transaction_id, created_at, warnings",
      )
      .eq("company_id", data.companyId)
      .eq("payment_id", data.asaasChargeId)
      .order("created_at", { ascending: false })
      .limit(10);

    const { data: localCharge } = await supabase
      .from("bella_pay_charges")
      .select(
        "id, status, sale_id, paid_at, value, net_value, updated_at, customer_id",
      )
      .eq("company_id", data.companyId)
      .eq("asaas_id", data.asaasChargeId)
      .maybeSingle();

    type SaleRow = {
      id: string;
      status: string | null;
      payment_status: string | null;
      total_amount: number | null;
      updated_at: string | null;
    };
    let sale: SaleRow | null = null;
    if (localCharge?.sale_id) {
      const { data: s } = await supabase
        .from("sales")
        .select("id, status, payment_status, total_amount, updated_at")
        .eq("id", localCharge.sale_id)
        .maybeSingle<SaleRow>();
      sale = s ?? null;
    }

    return {
      webhookEvents: events ?? [],
      localCharge,
      sale,
      receivedWebhook: (events ?? []).length > 0,
      saleUpdated:
        !!sale &&
        ["PAID", "RECEIVED", "CONFIRMED"].includes(
          String(sale.payment_status ?? "").toUpperCase(),
        ),
    };
  });
