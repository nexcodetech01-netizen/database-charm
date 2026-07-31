import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// -----------------------------------------------------------------------------
// Utilities are defined INSIDE handlers or imported from a separate module to
// avoid the tss-serverfn-split "ReferenceError" trap.
// -----------------------------------------------------------------------------

/**
 * Test Asaas connection with a temporary API key (before persisting) OR with
 * the currently saved credentials.
 */
export const testAsaasConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      companyId: string;
      apiKey?: string;
      environment: "sandbox" | "production";
      persist?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { asaasFetch } = await import("./asaas.server");
    const { supabase } = context;

    let apiKey = data.apiKey;
    if (!apiKey) {
      const { data: cfg } = await supabase
        .from("bella_pay_config")
        .select("api_key_sandbox, api_key_production")
        .eq("company_id", data.companyId)
        .maybeSingle();
      apiKey =
        (data.environment === "production"
          ? cfg?.api_key_production
          : cfg?.api_key_sandbox) || undefined;
    }
    if (!apiKey) {
      return { ok: false as const, message: "Nenhuma chave configurada." };
    }

    try {
      await asaasFetch({
        apiKey,
        environment: data.environment,
        path: "/myAccount",
        method: "GET",
      });
      if (data.persist) {
        await supabase
          .from("bella_pay_config")
          .update({
            connection_status: "connected",
            connection_message: null,
            last_tested_at: new Date().toISOString(),
          })
          .eq("company_id", data.companyId);
      }
      return { ok: true as const, message: "Conexão bem-sucedida." };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Falha ao conectar.";
      if (data.persist) {
        await supabase
          .from("bella_pay_config")
          .update({
            connection_status: "error",
            connection_message: message,
            last_tested_at: new Date().toISOString(),
          })
          .eq("company_id", data.companyId);
      }
      return { ok: false as const, message };
    }
  });

/**
 * Create a new Asaas charge (payment) and persist it locally.
 */
export const createAsaasCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      companyId: string;
      customerId?: string | null;
      saleId?: string | null;
      billingType: "PIX" | "CREDIT_CARD" | "UNDEFINED";
      value: number;
      dueDate: string;
      description?: string;
      /** PDV-010 — apenas CREDIT_CARD; 1..3. Ignorado nos demais tipos. */
      installmentCount?: number;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { asaasFetch } = await import("./asaas.server");
    const { computeCreditCardCharge } = await import("./credit-card-fee");
    const { computeStockInsufficiencies } = await import(
      "@/features/sales/lib/stock-validation"
    );
    const { supabase } = context;

    // ─── PDV-STOCK — barreira anti-bypass ──────────────────────────────────
    // Mesmo que o cliente tenha pulado a validação de estoque no `sale-form`,
    // não emitimos cobrança Asaas para venda com estoque insuficiente. A
    // consulta usa o mesmo cliente autenticado (RLS aplica).
    if (data.saleId) {
      const { data: saleItems, error: itemsErr } = await supabase
        .from("sale_items")
        .select("product_id, description, quantity, product:products(stock)")
        .eq("sale_id", data.saleId);
      if (itemsErr) {
        console.error("[createAsaasCharge] failed to load sale items for stock check", {
          saleId: data.saleId,
          error: itemsErr.message,
        });
        throw new Error("Falha ao validar estoque da venda.");
      }
      const candidates = (saleItems ?? []).map((row) => {
        const product = Array.isArray(row.product) ? row.product[0] : row.product;
        const stock = product?.stock;
        return {
          product_id: row.product_id,
          description: row.description,
          quantity: Number(row.quantity),
          stock_available: stock != null ? Number(stock) : null,
        };
      });
      const insufficient = computeStockInsufficiencies(candidates);
      if (insufficient.length > 0) {
        console.warn("[createAsaasCharge] blocked: insufficient stock", {
          companyId: data.companyId,
          saleId: data.saleId,
          issues: insufficient.map((i) => ({
            product_id: i.item.product_id,
            requested: i.requested,
            available: i.available,
            shortage: i.shortage,
          })),
        });
        const summary = insufficient
          .slice(0, 3)
          .map(
            (i) =>
              `${i.item.description ?? "Item"} (pedido ${i.requested}, disponível ${i.available})`,
          )
          .join("; ");
        throw new Error(
          `Estoque insuficiente para emitir cobrança: ${summary}${insufficient.length > 3 ? "…" : ""}.`,
        );
      }
    }

    const { data: cfg, error: cfgErr } = await supabase
      .from("bella_pay_config")
      .select("*")
      .eq("company_id", data.companyId)
      .maybeSingle();
    if (cfgErr) throw cfgErr;
    if (!cfg) throw new Error("Bella Pay não configurado.");
    const env = (cfg.environment as "sandbox" | "production") ?? "sandbox";
    const apiKey =
      env === "production" ? cfg.api_key_production : cfg.api_key_sandbox;
    if (!apiKey) throw new Error(`Chave da API (${env}) não configurada.`);

    // ─── P0-03 + P0-04 + ENV-SPLIT + IDEMPOTENCY: reuso de cliente Asaas ──
    const { resolveAsaasCustomerId } = await import("./customer-resolver");
    const { recordAsaasApiCall, raiseAsaasFailureAlert } = await import(
      "./asaas-metrics.server"
    );
    const { isValidCPF, isValidCNPJ } = await import("@/lib/validators");
    console.log(
      JSON.stringify({
        scope: "createAsaasCharge",
        level: "info",
        msg: "resolving customer",
        environment: env,
        companyId: data.companyId,
        customerId: data.customerId ?? null,
        saleId: data.saleId ?? null,
      }),
    );
    const asaasCustomerId = await resolveAsaasCustomerId({
      customerId: data.customerId ?? null,
      environment: env,
      validateDocument: (d) =>
        (d.length === 11 && isValidCPF(d)) ||
        (d.length === 14 && isValidCNPJ(d)),
      repo: {
        async findById(id) {
          const { data: customer } = await supabase
            .from("customers")
            .select(
              "id, name, email, document, phone, asaas_customer_id_sandbox, asaas_customer_id_production",
            )
            .eq("id", id)
            .maybeSingle();
          return customer ?? null;
        },
        async saveAsaasCustomerId(customerId, environment, asaasId) {
          const patch =
            environment === "production"
              ? {
                  asaas_customer_id_production: asaasId,
                  asaas_customer_id: asaasId,
                }
              : {
                  asaas_customer_id_sandbox: asaasId,
                  asaas_customer_id: asaasId,
                };
          await supabase.from("customers").update(patch).eq("id", customerId);
        },
        async clearAsaasCustomerId(customerId, environment) {
          const patch =
            environment === "production"
              ? { asaas_customer_id_production: null }
              : { asaas_customer_id_sandbox: null };
          await supabase.from("customers").update(patch).eq("id", customerId);
        },
      },
      gateway: {
        async findByDocument(cpfCnpj, externalReference) {
          const startedAt = Date.now();
          try {
            const res = await asaasFetch<{
              data?: Array<{ id: string; externalReference?: string | null }>;
            }>({
              apiKey,
              environment: env,
              path: `/customers?cpfCnpj=${encodeURIComponent(cpfCnpj)}&limit=10`,
              method: "GET",
            });
            const list = res.data ?? [];
            await recordAsaasApiCall(supabase, {
              companyId: data.companyId,
              environment: env,
              endpoint: "/customers",
              method: "GET",
              ok: true,
              durationMs: Date.now() - startedAt,
              metadata: { count: list.length, action: "lookup" },
            });
            if (list.length === 0) return null;
            const preferred =
              (externalReference &&
                list.find((c) => c.externalReference === externalReference)) ||
              list[0];
            return { id: preferred.id };
          } catch (err) {
            const anyErr = err as { message?: string; status?: number };
            await recordAsaasApiCall(supabase, {
              companyId: data.companyId,
              environment: env,
              endpoint: "/customers",
              method: "GET",
              ok: false,
              status: anyErr?.status,
              durationMs: Date.now() - startedAt,
              errorMessage: anyErr?.message,
              metadata: { action: "lookup", cpfCnpj },
            });
            // Não propaga — resolver decide se cria.
            return null;
          }
        },
        async createCustomer(body) {
          console.log(
            JSON.stringify({
              scope: "createAsaasCharge",
              level: "info",
              msg: "POST /customers request",
              environment: env,
              cpfCnpj: body.cpfCnpj ?? null,
              payload: body,
            }),
          );
          const startedAt = Date.now();
          try {
            const res = await asaasFetch<{ id: string }>({
              apiKey,
              environment: env,
              path: "/customers",
              method: "POST",
              body,
            });
            console.log(
              JSON.stringify({
                scope: "createAsaasCharge",
                level: "info",
                msg: "POST /customers response",
                environment: env,
                asaasCustomerId: res.id,
                response: res,
              }),
            );
            await recordAsaasApiCall(supabase, {
              companyId: data.companyId,
              environment: env,
              endpoint: "/customers",
              method: "POST",
              ok: true,
              durationMs: Date.now() - startedAt,
              metadata: { asaasCustomerId: res.id },
            });
            return res;
          } catch (err) {
            const anyErr = err as { message?: string; body?: unknown; status?: number };
            console.error(
              JSON.stringify({
                scope: "createAsaasCharge",
                level: "error",
                msg: "POST /customers failed",
                environment: env,
                cpfCnpj: body.cpfCnpj ?? null,
                payload: body,
                status: anyErr?.status,
                error: anyErr?.message,
                body: anyErr?.body,
              }),
            );
            await recordAsaasApiCall(supabase, {
              companyId: data.companyId,
              environment: env,
              endpoint: "/customers",
              method: "POST",
              ok: false,
              status: anyErr?.status,
              durationMs: Date.now() - startedAt,
              errorMessage: anyErr?.message,
              errorBody: anyErr?.body,
              metadata: { cpfCnpj: body.cpfCnpj ?? null },
            });
            await raiseAsaasFailureAlert(supabase, {
              companyId: data.companyId,
              environment: env,
              endpoint: "/customers",
              errorMessage: anyErr?.message ?? "erro desconhecido",
              status: anyErr?.status,
              context: { cpfCnpj: body.cpfCnpj ?? null },
            });
            throw new Error(
              `Falha ao criar cliente no Asaas (${env}): ${anyErr?.message ?? "erro desconhecido"}`,
            );
          }
        },
        async updateCustomer(asaasCustomerId, body) {
          return asaasFetch<{ id: string }>({
            apiKey,
            environment: env,
            path: `/customers/${asaasCustomerId}`,
            method: "POST",
            body,
            idempotent: true,
          });
        },
      },
    });
    console.log(
      JSON.stringify({
        scope: "createAsaasCharge",
        level: "info",
        msg: "customer resolved",
        environment: env,
        customerId: data.customerId ?? null,
        asaasCustomerId,
      }),
    );

    // PDV-010 — só cartão de crédito passa por parcelamento e absorção de taxa.
    const isCredit = data.billingType === "CREDIT_CARD";
    const requested = Math.max(1, Math.floor(data.installmentCount ?? 1));
    const cardAmounts = isCredit
      ? computeCreditCardCharge(data.value, requested, {
          absorb: Boolean(cfg.credit_card_absorb_fee),
          feePercent: Number(cfg.credit_card_fee_percent ?? 0),
          maxInstallments: Number(cfg.credit_card_max_installments ?? 3),
        })
      : null;

    const finalValue = cardAmounts ? cardAmounts.chargedValue : data.value;

    const chargePayload: Record<string, unknown> = {
      customer: asaasCustomerId,
      billingType: data.billingType,
      value: finalValue,
      dueDate: data.dueDate,
      description: data.description,
      externalReference: data.saleId ?? undefined,
    };

    if (cardAmounts && cardAmounts.installmentCount > 1) {
      chargePayload.installmentCount = cardAmounts.installmentCount;
      chargePayload.installmentValue = cardAmounts.installmentValue;
    }

    console.log(
      JSON.stringify({
        scope: "createAsaasCharge",
        level: "info",
        msg: "POST /payments request",
        environment: env,
        customer: asaasCustomerId,
        payload: chargePayload,
      }),
    );
    let asaasCharge: {
      id: string;
      status: string;
      invoiceUrl?: string;
      value: number;
      netValue?: number;
    };
    const paymentsStartedAt = Date.now();
    try {
      asaasCharge = await asaasFetch({
        apiKey,
        environment: env,
        path: "/payments",
        method: "POST",
        body: chargePayload,
      });
      console.log(
        JSON.stringify({
          scope: "createAsaasCharge",
          level: "info",
          msg: "POST /payments response",
          environment: env,
          asaasChargeId: asaasCharge.id,
          status: asaasCharge.status,
        }),
      );
      await recordAsaasApiCall(supabase, {
        companyId: data.companyId,
        environment: env,
        endpoint: "/payments",
        method: "POST",
        ok: true,
        durationMs: Date.now() - paymentsStartedAt,
        metadata: {
          asaasChargeId: asaasCharge.id,
          billingType: data.billingType,
          saleId: data.saleId ?? null,
        },
      });
    } catch (err) {
      const anyErr = err as { message?: string; body?: unknown; status?: number };
      console.error(
        JSON.stringify({
          scope: "createAsaasCharge",
          level: "error",
          msg: "POST /payments failed",
          environment: env,
          customer: asaasCustomerId,
          payload: chargePayload,
          status: anyErr?.status,
          error: anyErr?.message,
          body: anyErr?.body,
        }),
      );
      await recordAsaasApiCall(supabase, {
        companyId: data.companyId,
        environment: env,
        endpoint: "/payments",
        method: "POST",
        ok: false,
        status: anyErr?.status,
        durationMs: Date.now() - paymentsStartedAt,
        errorMessage: anyErr?.message,
        errorBody: anyErr?.body,
        metadata: {
          customer: asaasCustomerId,
          billingType: data.billingType,
          saleId: data.saleId ?? null,
        },
      });
      await raiseAsaasFailureAlert(supabase, {
        companyId: data.companyId,
        environment: env,
        endpoint: "/payments",
        errorMessage: anyErr?.message ?? "erro desconhecido",
        status: anyErr?.status,
        context: {
          customer: asaasCustomerId,
          billingType: data.billingType,
          saleId: data.saleId ?? null,
        },
      });
      throw err;
    }

    // PIX QR code + expiração (P1-03)
    // FIX PIX-QR-PROD: em produção o Asaas leva alguns instantes para
    // provisionar o QR Code. Fazemos até 3 tentativas com backoff curto e
    // logamos toda resposta/erro. Se falhar, seguimos com pix_qr_code=null
    // — o front chama `refreshPixQrCode` até obter.
    let pixQr: string | null = null;
    let pixPayload: string | null = null;
    let pixExpiresAt: string | null = null;
    if (data.billingType === "PIX") {
      const pixPath = `/payments/${asaasCharge.id}/pixQrCode`;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const qr = await asaasFetch<{
            encodedImage?: string;
            payload?: string;
            expirationDate?: string;
            success?: boolean;
          }>({
            apiKey,
            environment: env,
            path: pixPath,
            method: "GET",
          });
          console.log(
            JSON.stringify({
              scope: "createAsaasCharge.pixQrCode",
              level: "info",
              msg: "GET /payments/:id/pixQrCode",
              environment: env,
              paymentId: asaasCharge.id,
              billingType: data.billingType,
              attempt,
              hasEncodedImage: !!qr?.encodedImage,
              hasPayload: !!qr?.payload,
              expirationDate: qr?.expirationDate ?? null,
            }),
          );
          pixQr = qr.encodedImage ?? null;
          pixPayload = qr.payload ?? null;
          if (qr.expirationDate) {
            const parsed = new Date(qr.expirationDate);
            pixExpiresAt = Number.isNaN(parsed.getTime())
              ? null
              : parsed.toISOString();
          }
          if (pixQr && pixPayload) break;
        } catch (err) {
          const anyErr = err as {
            status?: number;
            message?: string;
            body?: unknown;
          };
          console.warn(
            JSON.stringify({
              scope: "createAsaasCharge.pixQrCode",
              level: "warn",
              msg: "GET /payments/:id/pixQrCode falhou",
              environment: env,
              paymentId: asaasCharge.id,
              billingType: data.billingType,
              attempt,
              status: anyErr?.status,
              error: anyErr?.message,
              body: anyErr?.body,
            }),
          );
        }
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 400 * attempt));
        }
      }
    }

    const { data: inserted, error: insErr } = await supabase
      .from("bella_pay_charges")
      .insert({
        company_id: data.companyId,
        customer_id: data.customerId ?? null,
        sale_id: data.saleId ?? null,
        asaas_id: asaasCharge.id,
        asaas_customer_id: asaasCustomerId,
        billing_type: data.billingType,
        value: finalValue,
        original_value: cardAmounts ? cardAmounts.originalValue : data.value,
        installment_count: cardAmounts ? cardAmounts.installmentCount : 1,
        installment_value: cardAmounts
          ? cardAmounts.installmentValue
          : finalValue,
        net_value: asaasCharge.netValue ?? null,
        due_date: data.dueDate,
        description: data.description ?? null,
        status: asaasCharge.status ?? "PENDING",
        invoice_url: asaasCharge.invoiceUrl ?? null,
        payment_link: asaasCharge.invoiceUrl ?? null,
        pix_qr_code: pixQr,
        pix_payload: pixPayload,
        pix_expires_at: pixExpiresAt,
        external_reference: data.saleId ?? null,
        environment: env,
      })
      .select()
      .single();
    if (insErr) throw insErr;

    // ─── WhatsApp: template "cobranca_criada_v2" ──────────────────────────
    // Template no Meta Business Manager (categoria Utility) com header
    // do tipo IMAGE (QR do PIX) e 4 variáveis no corpo:
    //   {{1}} nome do cliente
    //   {{2}} lista de itens (multi-linha, "• Qx Nome")
    //   {{3}} valor total formatado (R$)
    //   {{4}} PIX copia e cola
    // Fire-and-forget: falha no envio não bloqueia a criação da cobrança.
    try {
      if (data.customerId) {
        const { data: customer } = await supabase
          .from("customers")
          .select("name, phone")
          .eq("id", data.customerId)
          .maybeSingle();
        const phone = customer?.phone ?? null;
        if (phone) {
          const { sendWhatsAppTemplateRaw, recordWhatsAppOutboundEvent } =
            await import("@/lib/whatsapp.server");
          const linkPix =
            pixPayload ?? inserted.payment_link ?? inserted.invoice_url ?? "";
          const valorFmt = new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
          }).format(Number(finalValue) || 0);

          // Lista completa de itens (uma linha por item).
          // Fallback: descrição da cobrança ou "Pedido".
          let itensText = data.description?.trim() || "Pedido";
          if (data.saleId) {
            const { data: items } = await supabase
              .from("sale_items")
              .select("description, quantity, product:products(name)")
              .eq("sale_id", data.saleId);
            const lines = (items ?? [])
              .map((row) => {
                const product = Array.isArray(row.product)
                  ? row.product[0]
                  : row.product;
                const name =
                  (product?.name ?? row.description ?? "").trim() || "Item";
                const qty = Math.max(1, Number(row.quantity) || 1);
                return `• ${qty}x ${name}`;
              })
              .filter(Boolean);
            if (lines.length > 0) itensText = lines.join("\n");
          }

          // URL pública do QR (header IMAGE do template).
          // Só monta quando temos QR salvo e conseguimos derivar o host.
          let headerImageUrl: string | undefined;
          if (pixQr) {
            try {
              const { getRequestHost } = await import(
                "@tanstack/react-start/server"
              );
              let host = "";
              try {
                host = getRequestHost();
              } catch {
                host = "";
              }
              if (host) {
                const proto =
                  host.startsWith("localhost") || host.startsWith("127.")
                    ? "http"
                    : "https";
                headerImageUrl = `${proto}://${host}/api/public/bella-pay/qr/${inserted.id}.png`;
              }
            } catch {
              headerImageUrl = undefined;
            }
          }

          const sendResult = await sendWhatsAppTemplateRaw({
            to: phone,
            templateName: "cobranca_criada_v2",
            languageCode: "pt_BR",
            variables: [
              customer?.name ?? "cliente",
              itensText,
              valorFmt,
              linkPix,
            ],
            headerImageUrl,
          });
          await recordWhatsAppOutboundEvent(supabase, {
            companyId: data.companyId,
            waMessageId: sendResult.waMessageId,
            status: sendResult.ok ? "sent" : "failed",
          });
        }
      }
    } catch (err) {
      console.warn(
        JSON.stringify({
          scope: "createAsaasCharge.whatsapp",
          level: "warn",
          msg: "envio WhatsApp falhou (não bloqueia)",
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }

    return inserted;
  });


/**
 * Cancel a charge on Asaas and locally.
 */
export const cancelAsaasCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { chargeId: string }) => input)
  .handler(async ({ data, context }) => {
    const { asaasFetch } = await import("./asaas.server");
    const { supabase } = context;

    const { data: charge, error } = await supabase
      .from("bella_pay_charges")
      .select("*, bella_pay_config:company_id(*)")
      .eq("id", data.chargeId)
      .maybeSingle();
    if (error) throw error;
    if (!charge) throw new Error("Cobrança não encontrada.");

    const { data: cfg } = await supabase
      .from("bella_pay_config")
      .select("*")
      .eq("company_id", charge.company_id)
      .maybeSingle();
    if (!cfg) throw new Error("Bella Pay não configurado.");
    const env = charge.environment as "sandbox" | "production";
    const apiKey =
      env === "production" ? cfg.api_key_production : cfg.api_key_sandbox;
    if (!apiKey) throw new Error("Chave da API não configurada.");

    await asaasFetch({
      apiKey,
      environment: env,
      path: `/payments/${charge.asaas_id}`,
      method: "DELETE",
    });

    await supabase
      .from("bella_pay_charges")
      .update({
        status: "CANCELED",
        canceled_at: new Date().toISOString(),
      })
      .eq("id", data.chargeId);

    return { ok: true as const };
  });

/**
 * Request a refund on Asaas for a paid charge.
 * Never deletes/mutates the original charge — only appends refund status.
 */
export const refundAsaasCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { chargeId: string; value?: number; description?: string }) =>
      input,
  )
  .handler(async ({ data, context }) => {
    const { asaasFetch } = await import("./asaas.server");
    const { supabase } = context;

    const { data: charge, error } = await supabase
      .from("bella_pay_charges")
      .select("*")
      .eq("id", data.chargeId)
      .maybeSingle();
    if (error) throw error;
    if (!charge) throw new Error("Cobrança não encontrada.");

    const { data: cfg } = await supabase
      .from("bella_pay_config")
      .select("*")
      .eq("company_id", charge.company_id)
      .maybeSingle();
    if (!cfg) throw new Error("Bella Pay não configurado.");

    const env = charge.environment as "sandbox" | "production";
    const apiKey =
      env === "production" ? cfg.api_key_production : cfg.api_key_sandbox;
    if (!apiKey) throw new Error("Chave da API não configurada.");

    try {
      const body: Record<string, unknown> = {};
      if (typeof data.value === "number" && data.value > 0) body.value = data.value;
      if (data.description) body.description = data.description;

      const res = await asaasFetch<{ status?: string }>({
        apiKey,
        environment: env,
        path: `/payments/${charge.asaas_id}/refund`,
        method: "POST",
        body,
        idempotent: false,
      });
      return {
        ok: true as const,
        gatewayStatus: res.status ?? "REFUND_REQUESTED",
      };
    } catch (err) {
      return {
        ok: false as const,
        message:
          err instanceof Error ? err.message : "Falha ao estornar cobrança.",
      };
    }
  });

/**
 * FIX PIX-QR-PROD — Re-obtém o QR Code PIX do Asaas para uma cobrança
 * existente e persiste em `bella_pay_charges`. Usado pelo checkout para
 * recuperar o QR quando a criação inicial (`createAsaasCharge`) não
 * conseguiu obter o QR (comum em produção logo após criar a cobrança).
 * Idempotente: se já tiver QR persistido, apenas retorna o atual.
 */
export const refreshPixQrCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { chargeId: string }) => input)
  .handler(async ({ data, context }) => {
    const { asaasFetch } = await import("./asaas.server");
    const { supabase } = context;

    const { data: charge, error } = await supabase
      .from("bella_pay_charges")
      .select(
        "id, company_id, asaas_id, billing_type, environment, pix_qr_code, pix_payload, pix_expires_at",
      )
      .eq("id", data.chargeId)
      .maybeSingle();
    if (error) throw error;
    if (!charge) throw new Error("Cobrança não encontrada.");
    if (charge.billing_type !== "PIX") {
      return {
        ok: false as const,
        message: "Cobrança não é PIX.",
        pix_qr_code: null,
        pix_payload: null,
        pix_expires_at: null,
      };
    }
    if (charge.pix_qr_code && charge.pix_payload) {
      return {
        ok: true as const,
        pix_qr_code: charge.pix_qr_code,
        pix_payload: charge.pix_payload,
        pix_expires_at: charge.pix_expires_at,
      };
    }

    const { data: cfg } = await supabase
      .from("bella_pay_config")
      .select("api_key_sandbox, api_key_production")
      .eq("company_id", charge.company_id)
      .maybeSingle();
    if (!cfg) throw new Error("Bella Pay não configurado.");
    const env = charge.environment as "sandbox" | "production";
    const apiKey =
      env === "production" ? cfg.api_key_production : cfg.api_key_sandbox;
    if (!apiKey) throw new Error("Chave da API não configurada.");

    const pixPath = `/payments/${charge.asaas_id}/pixQrCode`;
    try {
      const qr = await asaasFetch<{
        encodedImage?: string;
        payload?: string;
        expirationDate?: string;
      }>({
        apiKey,
        environment: env,
        path: pixPath,
        method: "GET",
      });
      console.log(
        JSON.stringify({
          scope: "refreshPixQrCode",
          level: "info",
          msg: "GET /payments/:id/pixQrCode",
          environment: env,
          chargeId: charge.id,
          paymentId: charge.asaas_id,
          billingType: charge.billing_type,
          hasEncodedImage: !!qr?.encodedImage,
          hasPayload: !!qr?.payload,
          expirationDate: qr?.expirationDate ?? null,
        }),
      );
      const pix_qr_code = qr.encodedImage ?? null;
      const pix_payload = qr.payload ?? null;
      let pix_expires_at: string | null = null;
      if (qr.expirationDate) {
        const parsed = new Date(qr.expirationDate);
        pix_expires_at = Number.isNaN(parsed.getTime())
          ? null
          : parsed.toISOString();
      }
      if (pix_qr_code || pix_payload) {
        await supabase
          .from("bella_pay_charges")
          .update({
            pix_qr_code,
            pix_payload,
            pix_expires_at,
          })
          .eq("id", charge.id);
      }
      return {
        ok: true as const,
        pix_qr_code,
        pix_payload,
        pix_expires_at,
      };
    } catch (err) {
      const anyErr = err as {
        status?: number;
        message?: string;
        body?: unknown;
      };
      console.warn(
        JSON.stringify({
          scope: "refreshPixQrCode",
          level: "warn",
          msg: "GET /payments/:id/pixQrCode falhou",
          environment: env,
          chargeId: charge.id,
          paymentId: charge.asaas_id,
          status: anyErr?.status,
          error: anyErr?.message,
          body: anyErr?.body,
        }),
      );
      return {
        ok: false as const,
        message: anyErr?.message ?? "Falha ao obter QR Code PIX.",
        pix_qr_code: null,
        pix_payload: null,
        pix_expires_at: null,
      };
    }
  });
