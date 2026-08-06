/**
 * Server-only helpers for the Mercado Livre OAuth2 integration.
 * NEVER import from a browser bundle.
 *
 * Access model:
 * - User-facing calls pass an authenticated Supabase client (RLS as the user).
 * - The OAuth callback prefers the authenticated RLS client and only falls
 *   back to supabaseAdmin when no browser session is available.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  encryptToken,
  decryptToken,
  tryDecryptToken,
  MetaSecretMissingError,
} from "./meta-crypto.server";
import { integrationFetch } from "@/lib/http-client.server";

const AUTH_HOST = "https://auth.mercadolivre.com.br/authorization";
const TOKEN_URL = "https://api.mercadolibre.com/oauth/token";
const API = "https://api.mercadolibre.com";
const TABLE = "mercadolivre_integrations" as const;

// Loose type — the table isn't in the generated Database schema yet.
type AnySupabase = SupabaseClient<any, any, any>;

export interface MLCredentials {
  clientId: string;
  clientSecret: string;
}

export function buildAuthorizeUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const url = new URL(AUTH_HOST);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  console.log(`[ML_AUTH_URL_DEBUG] clientId=${params.clientId}, redirectUri=${params.redirectUri}, state=${params.state ? 'present' : 'missing'}`);
  return url.toString();
}

interface MLTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  user_id: number;
  refresh_token: string;
}

export async function exchangeCodeForToken(params: {
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
}): Promise<MLTokenResponse> {
  const payload = {
    grant_type: "authorization_code",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    code: params.code,
    redirect_uri: params.redirectUri,
  };

  const res = await integrationFetch(
    TOKEN_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(payload),
    },
    { integration: "mercadolivre:token", timeoutMs: 12_000, retryNonIdempotent: true },
  );
  const text = await res.text();
  
  if (!res.ok) {
    // AUDITORIA P0: Captura resposta completa para diagnóstico
    console.error(`[ML_TOKEN_ERROR] HTTP ${res.status}: ${text}`);
    throw new Error(`ML token exchange failed (${res.status}): ${text}`);
  }
  
  return JSON.parse(text) as MLTokenResponse;
}

export async function refreshAccessToken(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<MLTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
  });
  const res = await integrationFetch(
    TOKEN_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body,
    },
    { integration: "mercadolivre:token", timeoutMs: 12_000, retryNonIdempotent: true },
  );
  const text = await res.text();
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      console.warn(`[ML_REFRESH_AUTH_EXPIRED] HTTP ${res.status}`);
    }
    throw new Error(`ML refresh failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as MLTokenResponse;
}

export async function fetchMLUser(accessToken: string): Promise<{ id: number; nickname: string }> {
  const res = await integrationFetch(
    `${API}/users/me`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
    { integration: "mercadolivre:users-me", timeoutMs: 12_000 },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`ML /users/me failed (${res.status}): ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

/* -------------------- Persistence -------------------- */

export type MLIntegrationStatus =
  | "disconnected"
  | "credentials_only"
  | "connected"
  | "expiring_soon"
  | "expired";

export interface MLIntegrationSummary {
  connected: boolean;
  hasCredentials: boolean;
  clientId: string | null;
  mlUserId: string | null;
  mlNickname: string | null;
  scopes: string[];
  tokenExpiresAt: string | null;
  lastSyncedAt: string | null;
  status: MLIntegrationStatus;
  /** Seconds until token expiration (negative if already expired). Null when unknown. */
  expiresInSeconds: number | null;
}


async function getAdmin(): Promise<AnySupabase | null> {
  const { getOptionalSupabaseAdmin } = await import("@/integrations/supabase/client.server");
  return getOptionalSupabaseAdmin() as unknown as AnySupabase | null;
}

export async function saveCredentials(
  supabase: AnySupabase,
  params: {
    companyId: string;
    userId: string;
    clientId: string;
    /** When null/undefined, preserve the previously stored secret. */
    clientSecret: string | null;
  },
): Promise<void> {
  const payload: Record<string, unknown> = {
    company_id: params.companyId,
    connected_by: params.userId,
    client_id: params.clientId,
    updated_at: new Date().toISOString(),
  };

  if (params.clientSecret) {
    payload.client_secret_encrypted = encryptToken(params.clientSecret);
  } else {
    // Preserve existing secret when caller sent it blank.
    const { data: existing } = await supabase
      .from(TABLE)
      .select("client_secret_encrypted")
      .eq("company_id", params.companyId)
      .maybeSingle();
    const current = (existing as { client_secret_encrypted?: string | null } | null)
      ?.client_secret_encrypted ?? null;
    if (!current) {
      throw new Error(
        "Client Secret é obrigatório na primeira gravação de credenciais.",
      );
    }
    payload.client_secret_encrypted = current;
  }

  const { error } = await supabase.from(TABLE).upsert(payload, {
    onConflict: "company_id",
  });
  if (error) throw error;
}

export async function getCompanyCredentials(
  supabase: AnySupabase,
  companyId: string,
): Promise<MLCredentials | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("client_id, client_secret_encrypted")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as { client_id: string; client_secret_encrypted: string };
  if (!process.env.META_TOKEN_ENC_SECRET) {
    throw new MetaSecretMissingError("META_TOKEN_ENC_SECRET");
  }
  const clientSecret = tryDecryptToken(row.client_secret_encrypted);
  if (clientSecret === null) {
    // Cifrado com outra chave: exige reconexão, não é erro de execução.
    console.warn("[mercadolivre] client_secret não decifrável — reconexão necessária");
    return null;
  }
  return { clientId: row.client_id, clientSecret };
}

export async function upsertTokens(params: {
  companyId: string;
  userId: string;
  token: MLTokenResponse;
  supabase?: AnySupabase | null;
}): Promise<void> {
  const persistenceClient = params.supabase ?? await getAdmin();
  if (!persistenceClient) {
    throw new Error(
      "Sessão expirada. Entre novamente no NexOS e repita a conexão com o Mercado Livre.",
    );
  }
  const user = await fetchMLUser(params.token.access_token);
  const expiresAt = new Date(Date.now() + params.token.expires_in * 1000).toISOString();
  const scopes = (params.token.scope ?? "").split(/\s+/).filter(Boolean);
  const { error } = await persistenceClient
    .from(TABLE)
    .update({
      access_token_encrypted: encryptToken(params.token.access_token),
      refresh_token_encrypted: encryptToken(params.token.refresh_token),
      token_expires_at: expiresAt,
      ml_user_id: String(user.id),
      ml_nickname: user.nickname,
      scopes,
      connected_by: params.userId,
      last_synced_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("company_id", params.companyId);
  if (error) throw error;
}

/** Callback-only variant that reads credentials with the admin client (no user session). */
export async function getCompanyCredentialsAdmin(
  companyId: string,
  authenticatedClient?: AnySupabase | null,
): Promise<MLCredentials | null> {
  const persistenceClient = authenticatedClient ?? await getAdmin();
  if (!persistenceClient) {
    throw new Error(
      "Sessão expirada. Entre novamente no NexOS e repita a conexão com o Mercado Livre.",
    );
  }
  return getCompanyCredentials(persistenceClient, companyId);
}

async function readSummaryRow(supabase: AnySupabase, companyId: string) {
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      "client_id, client_secret_encrypted, access_token_encrypted, refresh_token_encrypted, ml_user_id, ml_nickname, scopes, token_expires_at, last_synced_at",
    )
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  return data as
    | {
        client_id: string;
        client_secret_encrypted: string | null;
        access_token_encrypted: string | null;
        refresh_token_encrypted: string | null;
        ml_user_id: string | null;
        ml_nickname: string | null;
        scopes: string[] | null;
        token_expires_at: string | null;
        last_synced_at: string | null;
      }
    | null;
}

/**
 * Marca a integração como "precisa reconectar": zera a validade do token e,
 * opcionalmente, limpa os tokens que não podem mais ser usados.
 * Nunca lança — é telemetria de estado.
 */
export async function markReconnectRequired(
  supabase: AnySupabase,
  companyId: string,
  options: { clearTokens?: boolean } = {},
): Promise<void> {
  try {
    await supabase
      .from(TABLE)
      .update({
        token_expires_at: new Date(0).toISOString(),
        ...(options.clearTokens
          ? { access_token_encrypted: null, refresh_token_encrypted: null }
          : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", companyId);
  } catch (err) {
    console.warn(
      "[mercadolivre] falha ao marcar reconexão necessária",
      err instanceof Error ? err.message : err,
    );
  }
}

/** Refresh window: renew tokens when less than this many seconds remain. */
const REFRESH_THRESHOLD_SECONDS = 60 * 30; // 30 min

/**
 * If the stored access token is expired or about to expire, uses the refresh
 * token to obtain a new pair and persists them. Silent no-op when not needed
 * or when refresh isn't possible (missing creds / refresh token / provider error).
 */
export async function ensureFreshAccessToken(
  supabase: AnySupabase,
  companyId: string,
  userId: string,
): Promise<void> {
  const row = await readSummaryRow(supabase, companyId);
  if (!row?.access_token_encrypted || !row.refresh_token_encrypted) return;
  if (!row.client_id || !row.client_secret_encrypted) return;

  const now = Date.now();
  const expiresAt = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  
  // Se o token for de 1970 ou inválido, tratamos como expirado e forçamos o refresh se possível
  const expiresInSeconds = expiresAt > 0 ? Math.floor((expiresAt - now) / 1000) : -1;
  
  if (expiresInSeconds > REFRESH_THRESHOLD_SECONDS) return;

  const clientSecret = tryDecryptToken(row.client_secret_encrypted);
  const refreshToken = tryDecryptToken(row.refresh_token_encrypted);
  if (clientSecret === null || refreshToken === null) {
    console.warn(
      "[mercadolivre] credenciais não decifráveis (chave de criptografia alterada) — marcando reconexão",
    );
    await markReconnectRequired(supabase, companyId, { clearTokens: true });
    return;
  }

  try {
    const token = await refreshAccessToken({
      clientId: row.client_id,
      clientSecret,
      refreshToken,
    });
    await upsertTokens({ companyId, userId, token, supabase });
  } catch (err) {
    // Refresh falhou (token revogado, credenciais inválidas, provider fora).
    // Marca a integração como expirada explicitamente para que a UI possa
    // pedir reautorização em vez de tentar publicar com um token stale.
    const message = err instanceof Error ? err.message : String(err);
    const looksAuthError =
      /\b(400|401|invalid_grant|invalid_client|unauthorized)\b/i.test(message);
    console.warn("[mercadolivre] auto-refresh failed", message);
    try {
      await supabase
        .from(TABLE)
        .update({
          // Força o cálculo de status "expired" em getIntegrationSummary
          token_expires_at: new Date(0).toISOString(),
          // Sinaliza que o refresh não é mais possível sem reautorização
          ...(looksAuthError
            ? { access_token_encrypted: null, refresh_token_encrypted: null }
            : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", companyId);
    } catch (persistErr) {
      console.warn(
        "[mercadolivre] failed to mark integration expired",
        persistErr instanceof Error ? persistErr.message : persistErr,
      );
    }
  }
}

export async function getIntegrationSummary(
  supabase: AnySupabase,
  companyId: string,
  options?: { userId?: string; autoRefresh?: boolean },
): Promise<MLIntegrationSummary> {
  let row = await readSummaryRow(supabase, companyId);
  if (!row) {
    return {
      connected: false,
      hasCredentials: false,
      clientId: null,
      mlUserId: null,
      mlNickname: null,
      scopes: [],
      tokenExpiresAt: null,
      lastSyncedAt: null,
      status: "disconnected",
      expiresInSeconds: null,
    };
  }

  const shouldAutoRefresh = options?.autoRefresh !== false && Boolean(options?.userId);
  if (shouldAutoRefresh && row.access_token_encrypted && row.refresh_token_encrypted) {
    const seconds = row.token_expires_at
      ? Math.floor((new Date(row.token_expires_at).getTime() - Date.now()) / 1000)
      : null;
    if (seconds !== null && seconds <= REFRESH_THRESHOLD_SECONDS) {
      await ensureFreshAccessToken(supabase, companyId, options!.userId!);
      row = (await readSummaryRow(supabase, companyId)) ?? row;
    }
  }

  const connected = Boolean(row.access_token_encrypted);
  const hasCredentials = Boolean(row.client_id);
  const expiresInSeconds = row.token_expires_at
    ? Math.floor((new Date(row.token_expires_at).getTime() - Date.now()) / 1000)
    : null;

  let status: MLIntegrationStatus = "disconnected";
  if (!hasCredentials) status = "disconnected";
  else if (!connected) status = "credentials_only";
  else if (expiresInSeconds !== null && expiresInSeconds <= 0) status = "expired";
  else if (expiresInSeconds !== null && expiresInSeconds < 60 * 60 * 24) status = "expiring_soon";
  else status = "connected";

  return {
    connected,
    hasCredentials,
    clientId: row.client_id ?? null,
    mlUserId: row.ml_user_id,
    mlNickname: row.ml_nickname,
    scopes: row.scopes ?? [],
    tokenExpiresAt: row.token_expires_at,
    lastSyncedAt: row.last_synced_at,
    status,
    expiresInSeconds,
  };
}


export async function deleteIntegration(
  supabase: AnySupabase,
  companyId: string,
): Promise<void> {
  const { error } = await supabase.from(TABLE).delete().eq("company_id", companyId);
  if (error) throw error;
}

export async function syncMLProducts(
  supabase: AnySupabase,
  companyId: string,
  userId: string,
): Promise<{ imported: number; updated: number }> {
  const row = await readSummaryRow(supabase, companyId);
  if (!row?.access_token_encrypted || !row.ml_user_id) {
    throw new Error("Integração com Mercado Livre não encontrada ou não autorizada.");
  }

  const token = decryptToken(row.access_token_encrypted);
  if (!token) throw new Error("Falha ao decifrar token do Mercado Livre.");

  // 1. Buscar IDs de anúncios ativos
  const searchUrl = `${API}/users/${row.ml_user_id}/items/search?status=active`;
  const searchRes = await integrationFetch(
    searchUrl,
    { headers: { Authorization: `Bearer ${token}` } },
    { integration: "mercadolivre:search-items", timeoutMs: 15_000 },
  );

  if (!searchRes.ok) {
    throw new Error(`Falha ao buscar anúncios (${searchRes.status})`);
  }

  const searchData = await searchRes.json();
  const itemIds: string[] = searchData.results || [];

  if (itemIds.length === 0) return { imported: 0, updated: 0 };

  // 2. Buscar detalhes dos itens (em lotes de 20 para performance e limites da API)
  let imported = 0;
  let updated = 0;
  const batchSize = 20;

  for (let i = 0; i < itemIds.length; i += batchSize) {
    const batchIds = itemIds.slice(i, i + batchSize);
    const multigetUrl = `${API}/items?ids=${batchIds.join(",")}`;
    const multigetRes = await integrationFetch(
      multigetUrl,
      { headers: { Authorization: `Bearer ${token}` } },
      { integration: "mercadolivre:multiget-items", timeoutMs: 20_000 },
    );

    if (!multigetRes.ok) continue;

    const items = await multigetRes.json();

    for (const itemWrapper of items) {
      const item = itemWrapper.body;
      if (!item || itemWrapper.code !== 200) continue;

      // Buscar produto existente por ml_item_id ou SKU
      const { data: existing } = await supabase
        .from("products")
        .select("id, ml_item_id, sku")
        .eq("company_id", companyId)
        .or(`ml_item_id.eq.${item.id},sku.eq.${item.seller_custom_field || item.id}`)
        .maybeSingle();

      const productPayload = {
        company_id: companyId,
        name: item.title,
        sku: item.seller_custom_field || item.id,
        price: item.price,
        stock: item.available_quantity,
        ml_item_id: item.id,
        ml_permalink: item.permalink,
        status: "active",
        cover_image_path: item.thumbnail,
        updated_at: new Date().toISOString(),
        // Se for novo, garante que o canal de venda inclua mercado_livre
        sales_channels: existing ? undefined : ["mercado_livre", "loja_fisica"],
      };

      if (existing) {
        const { error: upErr } = await supabase
          .from("products")
          .update(productPayload)
          .eq("id", existing.id);
        if (!upErr) updated++;
      } else {
        const { error: insErr } = await supabase.from("products").insert({
          ...productPayload,
          created_at: new Date().toISOString(),
        });
        if (!insErr) imported++;
      }
    }
  }

  return { imported, updated };
}

export async function ensureMLProduct(
  supabase: AnySupabase,
  companyId: string,
  mlItemId: string,
  accessToken: string,
): Promise<string | null> {
  // 1. Tentar buscar por ml_item_id ou sku (se o sku for o próprio ml_item_id no fallback)
  const { data: existing } = await supabase
    .from("products")
    .select("id")
    .eq("company_id", companyId)
    .or(`ml_item_id.eq.${mlItemId},sku.eq.${mlItemId}`)
    .maybeSingle();

  if (existing) return existing.id;

  // 2. Não encontrado: Buscar detalhes no ML para criar
  try {
    const res = await integrationFetch(
      `${API}/items/${mlItemId}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
      { integration: "mercadolivre:get-item", timeoutMs: 10_000 },
    );

    if (!res.ok) return null;
    const item = await res.json();

    const { data: product, error } = await supabase
      .from("products")
      .insert({
        company_id: companyId,
        name: item.title,
        sku: item.seller_custom_field || item.id,
        price: item.price,
        stock: item.available_quantity,
        ml_item_id: item.id,
        ml_permalink: item.permalink,
        status: "active",
        cover_image_path: item.thumbnail,
        sales_channels: ["mercado_livre", "loja_fisica"],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[mercadolivre] falha ao criar produto automático:", error.message);
      return null;
    }

    return product.id;
  } catch (err) {
    console.error("[mercadolivre] erro ao assegurar produto:", err);
    return null;
  }
}
