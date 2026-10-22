/**
 * WhatsApp Business Cloud API — server functions.
 *
 * Reads credentials from server-only environment variables (Lovable Secrets):
 *   - META_APP_ID
 *   - META_APP_SECRET
 *   - WHATSAPP_WABA_ID
 *   - WHATSAPP_PHONE_NUMBER_ID
 *   - WHATSAPP_ACCESS_TOKEN
 *   - WHATSAPP_WEBHOOK_VERIFY_TOKEN
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { integrationFetch } from "@/lib/http-client.server";

export type WhatsAppSecretName =
  | "META_APP_ID"
  | "META_APP_SECRET"
  | "WHATSAPP_WABA_ID"
  | "WHATSAPP_PHONE_NUMBER_ID"
  | "WHATSAPP_ACCESS_TOKEN"
  | "WHATSAPP_WEBHOOK_VERIFY_TOKEN";

export interface WhatsAppSecretStatus {
  name: WhatsAppSecretName;
  configured: boolean;
}

export interface WhatsAppStatusResult {
  secrets: WhatsAppSecretStatus[];
  allConfigured: boolean;
  webhookUrl: string;
  webhookVerifyTokenConfigured: boolean;
  webhookVerifyToken: string | null;
}

export interface WhatsAppValidationResult {
  connected: boolean;
  error: string | null;
  phoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  wabaName: string | null;
  checkedAt: string;
}

export const getWhatsAppStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WhatsAppStatusResult> => {
    // O verify token do webhook é da PLATAFORMA (não de uma empresa): só quem
    // administra a plataforma (e-mail listado em PLATFORM_ADMIN_EMAILS) vê o valor.
    const adminEmails = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const userEmail = String((context.claims as { email?: unknown })?.email ?? "").toLowerCase();
    const isPlatformAdmin = userEmail !== "" && adminEmails.includes(userEmail);

    const names: WhatsAppSecretName[] = [
      "META_APP_ID",
      "META_APP_SECRET",
      "WHATSAPP_WABA_ID",
      "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    ];
    const secrets: WhatsAppSecretStatus[] = names.map((name) => ({
      name,
      configured: Boolean(process.env[name]),
    }));

    const { getRequestHost } = await import("@tanstack/react-start/server");
    let host = "";
    try {
      host = getRequestHost();
    } catch {
      host = "";
    }
    const proto =
      host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
    const webhookUrl = host
      ? `${proto}://${host}/api/public/whatsapp/webhook`
      : "/api/public/whatsapp/webhook";

    return {
      secrets,
      allConfigured: secrets.every((s) => s.configured),
      webhookUrl,
      webhookVerifyTokenConfigured: Boolean(
        process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      ),
      webhookVerifyToken: isPlatformAdmin
        ? (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? null)
        : null,
    };
  });

export const validateWhatsAppConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<WhatsAppValidationResult> => {
    const GRAPH_VERSION = "v20.0";
    const checkedAt = new Date().toISOString();
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const wabaId = process.env.WHATSAPP_WABA_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    const empty = {
      connected: false,
      phoneNumber: null,
      verifiedName: null,
      qualityRating: null,
      wabaName: null,
      checkedAt,
    };

    if (!phoneNumberId || !accessToken || !wabaId) {
      return {
        ...empty,
        error:
          "Credenciais incompletas. Configure WABA ID, Phone Number ID e Access Token.",
      };
    }

    try {
      const phoneRes = await integrationFetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        { integration: "whatsapp:phone-number", timeoutMs: 10_000 },
      );
      const phoneJson = (await phoneRes.json()) as Record<string, unknown>;
      if (!phoneRes.ok) {
        const msg =
          (phoneJson as { error?: { message?: string } }).error?.message ??
          `HTTP ${phoneRes.status}`;
        return { ...empty, error: `Phone Number: ${msg}` };
      }

      const wabaRes = await integrationFetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/${wabaId}?fields=name,id`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
        { integration: "whatsapp:waba", timeoutMs: 10_000 },
      );
      const wabaJson = (await wabaRes.json()) as Record<string, unknown>;
      if (!wabaRes.ok) {
        const msg =
          (wabaJson as { error?: { message?: string } }).error?.message ??
          `HTTP ${wabaRes.status}`;
        return { ...empty, error: `WABA: ${msg}` };
      }

      return {
        connected: true,
        error: null,
        phoneNumber: (phoneJson.display_phone_number as string) ?? null,
        verifiedName: (phoneJson.verified_name as string) ?? null,
        qualityRating: (phoneJson.quality_rating as string) ?? null,
        wabaName: (wabaJson.name as string) ?? null,
        checkedAt,
      };
    } catch (err) {
      return {
        ...empty,
        error: err instanceof Error ? err.message : "Erro desconhecido",
      };
    }
  });

// `sendWhatsAppTemplate` (server function) foi removida por segurança
// (auditoria 2026-10-22): nenhuma tela a usava e ela permitia que qualquer
// usuário logado disparasse templates para qualquer número com o WhatsApp da
// plataforma. Envios internos usam `sendWhatsAppTemplateRaw` (whatsapp.server.ts)
// direto no servidor.
