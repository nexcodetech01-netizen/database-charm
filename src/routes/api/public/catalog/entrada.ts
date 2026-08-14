import { createFileRoute } from "@tanstack/react-router";
import { buildExternalReference, parseEntradaRequest } from "@/lib/catalog-entrada";
import { enforceRateLimit } from "@/lib/rate-limit.server";

async function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
}

function jsonError(status: number, error: string, headers: HeadersInit) {
  return new Response(JSON.stringify({ error }), { status, headers });
}

function log(event: string, fields: Record<string, unknown> = {}) {
  const parts = Object.entries(fields)
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(" ");
  console.info(`[catalog:entrada] ${event} ${parts}`.trim());
}

function isoDueDate(daysAhead = 3): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/api/public/catalog/entrada")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: await corsHeaders() }),
      POST: async ({ request }) => {
        const startedAt = Date.now();
        const headers = {
          ...(await corsHeaders()),
          "content-type": "application/json",
        };

        // Anti-flood: endpoint público que cria cobranças no Asaas.
        const limited = enforceRateLimit(
          { route: "catalog:entrada", windowMs: 60_000, max: 5 },
          headers,
        );
        if (limited) return limited;

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          log("invalid_json");
          return jsonError(400, "invalid_json", headers);
        }

        const parsed = parseEntradaRequest(raw);
        if (!parsed.ok) {
          log("invalid_params", { error: parsed.error });
          return jsonError(400, parsed.error, headers);
        }
        const { slug, productId, buyerName } = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { asaasFetch } = await import("@/features/bella-pay/lib/asaas.server");

        const { data: col } = await supabaseAdmin
          .from("product_collections")
          .select("id, company_id, status")
          .eq("slug", slug)
          .maybeSingle();
        if (!col || col.status !== "active") {
          log("collection_not_found", { slug });
          return jsonError(404, "collection_not_found", headers);
        }

        const { data: link } = await supabaseAdmin
          .from("product_collection_items")
          .select("id")
          .eq("collection_id", col.id)
          .eq("product_id", productId)
          .maybeSingle();
        if (!link) {
          log("product_not_in_collection", { slug, productId });
          return jsonError(404, "product_not_in_collection", headers);
        }

        const { data: prod } = await supabaseAdmin
          .from("products")
          .select("id, name, price, status, company_id, sales_channels, stock")
          .eq("id", productId)
          .eq("company_id", col.company_id)
          .maybeSingle();
        if (!prod || prod.status !== "active" || Number(prod.stock) <= 0 || (prod as any).sales_channels?.includes("catalog") === false) {
          log("product_not_found", { productId });
          return jsonError(404, "product_not_found", headers);
        }

        const externalReference = buildExternalReference(col.id, prod.id, buyerName);

        // Idempotência: mesma coleção + produto + comprador com cobrança
        // pendente ativa → devolve a existente em vez de criar outra.
        const { data: existing } = await supabaseAdmin
          .from("bella_pay_charges")
          .select("id, status, invoice_url, pix_qr_code, pix_payload, value, original_value")
          .eq("company_id", col.company_id)
          .eq("external_reference", externalReference)
          .in("status", ["PENDING", "AWAITING_RISK_ANALYSIS", "CONFIRMED", "RECEIVED"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<{
            id: string;
            status: string;
            invoice_url: string | null;
            pix_qr_code: string | null;
            pix_payload: string | null;
            value: number;
            original_value: number | null;
          }>();

        if (existing) {
          log("charge_reused", { chargeId: existing.id, status: existing.status });
          return new Response(
            JSON.stringify({
              ok: true,
              reused: true,
              invoice_url: existing.invoice_url,
              pix_qr_code: existing.pix_qr_code,
              pix_payload: existing.pix_payload,
              value: Number(existing.value),
              remaining: Math.max(
                0,
                Math.round((Number(existing.original_value ?? 0) - Number(existing.value)) * 100) /
                  100,
              ),
            }),
            { status: 200, headers },
          );
        }

        const { data: cfg } = await supabaseAdmin
          .from("bella_pay_config")
          .select("environment, api_key_sandbox, api_key_production, connection_status")
          .eq("company_id", col.company_id)
          .maybeSingle<{
            environment: "sandbox" | "production";
            api_key_sandbox: string | null;
            api_key_production: string | null;
            connection_status: string | null;
          }>();

        if (!cfg || cfg.connection_status !== "connected") {
          log("bella_pay_unavailable", { companyId: col.company_id });
          return jsonError(400, "bella_pay_unavailable", headers);
        }
        const env = cfg.environment ?? "sandbox";
        const apiKey = env === "production" ? cfg.api_key_production : cfg.api_key_sandbox;
        if (!apiKey) {
          log("bella_pay_unavailable", { companyId: col.company_id, reason: "missing_key" });
          return jsonError(400, "bella_pay_unavailable", headers);
        }

        const entradaPercent = 30;
        const price = Number(prod.price);
        const entradaValue = Math.max(1, Math.round(price * (entradaPercent / 100) * 100) / 100);

        // Create (or reuse) an Asaas customer with name only.
        let asaasCustomerId: string | null = null;
        try {
          const created = await asaasFetch<{ id: string }>({
            apiKey,
            environment: env,
            path: "/customers",
            method: "POST",
            body: {
              name: buyerName,
              email: parsed.data.buyerEmail,
              mobilePhone: parsed.data.buyerPhone,
            },
          });
          asaasCustomerId = created.id;
        } catch (err) {
          const message = err instanceof Error ? err.message : "asaas_customer_error";
          return jsonError(502, message, headers);
        }

        // Create PIX charge for entrada.
        let charge: {
          id: string;
          status: string;
          invoiceUrl?: string;
          value: number;
          netValue?: number;
        };
        try {
          charge = await asaasFetch({
            apiKey,
            environment: env,
            path: "/payments",
            method: "POST",
            body: {
              customer: asaasCustomerId,
              billingType: "PIX",
              value: entradaValue,
              dueDate: isoDueDate(3),
              description: `Entrada — ${prod.name}`,
              externalReference,
            },
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "asaas_charge_error";
          return jsonError(502, message, headers);
        }

        let pixQr: string | null = null;
        let pixPayload: string | null = null;
        try {
          const qr = await asaasFetch<{
            encodedImage?: string;
            payload?: string;
          }>({
            apiKey,
            environment: env,
            path: `/payments/${charge.id}/pixQrCode`,
            method: "GET",
          });
          pixQr = qr.encodedImage ?? null;
          pixPayload = qr.payload ?? null;
        } catch {
          // continue — invoice URL still valid
        }

        await supabaseAdmin.from("bella_pay_charges").insert({
          company_id: col.company_id,
          customer_id: null,
          sale_id: null,
          asaas_id: charge.id,
          asaas_customer_id: asaasCustomerId,
          billing_type: "PIX",
          value: entradaValue,
          original_value: price,
          installment_count: 1,
          installment_value: entradaValue,
          net_value: charge.netValue ?? null,
          due_date: isoDueDate(3),
          description: `Entrada catálogo — ${prod.name} (${buyerName})`,
          status: charge.status ?? "PENDING",
          invoice_url: charge.invoiceUrl ?? null,
          payment_link: charge.invoiceUrl ?? null,
          pix_qr_code: pixQr,
          pix_payload: pixPayload,
          external_reference: externalReference,
          environment: env,
        });

        log("charge_created", {
          chargeId: charge.id,
          companyId: col.company_id,
          value: entradaValue,
          env,
          ms: Date.now() - startedAt,
        });

        return new Response(
          JSON.stringify({
            ok: true,
            invoice_url: charge.invoiceUrl ?? null,
            pix_qr_code: pixQr,
            pix_payload: pixPayload,
            value: entradaValue,
            remaining: Math.max(0, Math.round((price - entradaValue) * 100) / 100),
          }),
          { status: 200, headers },
        );
      },
    },
  },
});
