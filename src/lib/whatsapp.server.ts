/**
 * WhatsApp Business Cloud API — server-only helpers.
 *
 * Kept in a `.server.ts` module so it never leaks into client bundles.
 * Callable both from `createServerFn` handlers (e.g. `sendWhatsAppTemplate`)
 * and from other server-side flows (e.g. Bella Pay charge creation) via
 * dynamic `await import()`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { integrationFetch } from "@/lib/http-client.server";

const GRAPH_VERSION = "v20.0";

export interface SendTemplateInput {
  /** Destino em qualquer formato — será normalizado para E.164 sem "+". */
  to: string;
  /** Nome exato do template aprovado na Meta. */
  templateName: string;
  /** Idioma do template (default "pt_BR"). */
  languageCode?: string;
  /** Variáveis do corpo, na ordem em que aparecem no template. */
  variables?: Array<string | number>;
  /**
   * URL pública HTTPS de uma imagem para o header do template.
   * Só use quando o template foi aprovado com header do tipo IMAGE.
   * Meta não aceita base64 aqui — precisa ser URL acessível pela Meta.
   */
  headerImageUrl?: string;
}

export interface SendTemplateResult {
  ok: boolean;
  waMessageId: string | null;
  to: string;
  error: string | null;
  status?: number;
  raw?: unknown;
}

/**
 * Normaliza um telefone brasileiro para o formato aceito pela Cloud API
 * (dígitos apenas, com DDI). Se já vier com DDI, apenas remove símbolos.
 */
export function normalizeBrazilianPhone(input: string): string {
  const digits = (input ?? "").replace(/\D+/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  // Assume número nacional (DDD + número) sem DDI.
  return `55${digits}`;
}

/**
 * Dispara um template aprovado via WhatsApp Business Cloud API.
 * Não lança em falha de rede: retorna `{ ok: false, error }` para permitir
 * uso "fire-and-forget" em fluxos como criação de cobrança.
 */
export async function sendWhatsAppTemplateRaw(
  input: SendTemplateInput,
): Promise<SendTemplateResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const to = normalizeBrazilianPhone(input.to);
  const languageCode = input.languageCode ?? "pt_BR";

  if (!phoneNumberId || !accessToken) {
    return {
      ok: false,
      waMessageId: null,
      to,
      error:
        "Credenciais WhatsApp ausentes (WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN).",
    };
  }
  if (!to) {
    return { ok: false, waMessageId: null, to, error: "Telefone inválido." };
  }

  const componentsList: Array<Record<string, unknown>> = [];
  if (input.headerImageUrl) {
    componentsList.push({
      type: "header",
      parameters: [
        { type: "image", image: { link: input.headerImageUrl } },
      ],
    });
  }
  if (input.variables && input.variables.length > 0) {
    componentsList.push({
      type: "body",
      parameters: input.variables.map((v) => ({
        type: "text",
        text: String(v ?? ""),
      })),
    });
  }

  const body = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: input.templateName,
      language: { code: languageCode },
      ...(componentsList.length > 0 ? { components: componentsList } : {}),
    },
  };

  try {
    const res = await integrationFetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
      { integration: "whatsapp:template", timeoutMs: 15_000 },
    );
    const json = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      const msg = json.error?.message ?? `HTTP ${res.status}`;
      console.warn(
        JSON.stringify({
          scope: "sendWhatsAppTemplate",
          level: "warn",
          msg: "Meta rejeitou envio",
          templateName: input.templateName,
          to,
          status: res.status,
          error: msg,
          raw: json,
        }),
      );
      return {
        ok: false,
        waMessageId: null,
        to,
        error: msg,
        status: res.status,
        raw: json,
      };
    }
    const waMessageId = json.messages?.[0]?.id ?? null;
    console.log(
      JSON.stringify({
        scope: "sendWhatsAppTemplate",
        level: "info",
        msg: "template enviado",
        templateName: input.templateName,
        to,
        waMessageId,
      }),
    );
    return { ok: true, waMessageId, to, error: null, status: res.status, raw: json };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido";
    console.error(
      JSON.stringify({
        scope: "sendWhatsAppTemplate",
        level: "error",
        msg: "falha de rede",
        templateName: input.templateName,
        to,
        error: message,
      }),
    );
    return { ok: false, waMessageId: null, to, error: message };
  }
}

/**
 * Registra o evento de envio em `whatsapp_message_events` para uso na
 * dashboard de uso (limite mensal / custo estimado). Silencioso em falha.
 */
export async function recordWhatsAppOutboundEvent(
  supabase: SupabaseClient<Database>,
  params: {
    companyId: string;
    waMessageId: string | null;
    status: string;
  },
): Promise<void> {
  try {
    await supabase.from("whatsapp_message_events").insert({
      company_id: params.companyId,
      direction: "outbound",
      status: params.status,
      wa_message_id: params.waMessageId,
    });
  } catch (err) {
    console.warn(
      JSON.stringify({
        scope: "recordWhatsAppOutboundEvent",
        level: "warn",
        msg: "falha ao registrar evento",
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

/**
 * Envia texto livre pelo WhatsApp Business Cloud API.
 * Só funciona dentro da janela de 24h após a última mensagem do cliente.
 * Fora dela, a Meta rejeita — use templates para reengajamento.
 */
export interface SendTextInput {
  to: string;
  text: string;
}

export interface SendTextResult {
  ok: boolean;
  waMessageId: string | null;
  to: string;
  error: string | null;
  status?: number;
}

export async function sendWhatsAppText(input: SendTextInput): Promise<SendTextResult> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const to = normalizeBrazilianPhone(input.to);
  const text = (input.text ?? "").slice(0, 4096);

  if (!phoneNumberId || !accessToken) {
    return {
      ok: false,
      waMessageId: null,
      to,
      error: "Credenciais WhatsApp ausentes.",
    };
  }
  if (!to) return { ok: false, waMessageId: null, to, error: "Telefone inválido." };
  if (!text) return { ok: false, waMessageId: null, to, error: "Texto vazio." };

  try {
    const res = await integrationFetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { preview_url: false, body: text },
        }),
      },
      { integration: "whatsapp:text", timeoutMs: 15_000 },
    );
    const json = (await res.json().catch(() => ({}))) as {
      messages?: Array<{ id: string }>;
      error?: { message?: string };
    };
    if (!res.ok) {
      const msg = json.error?.message ?? `HTTP ${res.status}`;
      return { ok: false, waMessageId: null, to, error: msg, status: res.status };
    }
    return {
      ok: true,
      waMessageId: json.messages?.[0]?.id ?? null,
      to,
      error: null,
      status: res.status,
    };
  } catch (err) {
    return {
      ok: false,
      waMessageId: null,
      to,
      error: err instanceof Error ? err.message : "Erro desconhecido",
    };
  }
}
