/**
 * Server-only helpers for talking to the Meta Graph API and persisting
 * the resulting connection into public.meta_integrations.
 *
 * Scope: META-001 (identify + persist). Does NOT publish, sync stock or prices.
 */
import { encryptToken, decryptToken } from "./meta-crypto.server";
import { integrationFetch } from "@/lib/http-client.server";

export const META_GRAPH_VERSION = "v20.0";
const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const OAUTH = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;

export const META_SCOPES = [
  "public_profile",
  "email",
  "pages_show_list",
  "pages_read_engagement",
  "business_management",
  "instagram_basic",
  "catalog_management",
] as const;

export function requireMetaAppEnv() {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      "Meta app credentials missing. Set META_APP_ID and META_APP_SECRET in project secrets.",
    );
  }
  return { appId, appSecret };
}

export function buildAuthorizeUrl(params: {
  redirectUri: string;
  state: string;
}): string {
  const { appId } = requireMetaAppEnv();
  const url = new URL(OAUTH);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", META_SCOPES.join(","));
  return url.toString();
}

async function graphGet<T>(path: string, token: string, extra: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(extra)) url.searchParams.set(k, v);
  const res = await integrationFetch(url.toString(), { method: "GET" }, {
    integration: "meta-graph",
    timeoutMs: 12_000,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Meta Graph ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

/** Exchange the OAuth code for a short-lived user access token. */
export async function exchangeCodeForToken(params: {
  code: string;
  redirectUri: string;
}): Promise<{ access_token: string; token_type: string; expires_in?: number }> {
  const { appId, appSecret } = requireMetaAppEnv();
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("code", params.code);
  const res = await integrationFetch(url.toString(), { method: "GET" }, {
    integration: "meta-graph",
    timeoutMs: 12_000,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Meta token exchange failed (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

/** Upgrade a short-lived user token to a long-lived (~60d) token. */
export async function upgradeToLongLivedToken(shortToken: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in?: number;
}> {
  const { appId, appSecret } = requireMetaAppEnv();
  const url = new URL(`${GRAPH}/oauth/access_token`);
  url.searchParams.set("grant_type", "fb_exchange_token");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("fb_exchange_token", shortToken);
  const res = await integrationFetch(url.toString(), { method: "GET" }, {
    integration: "meta-graph",
    timeoutMs: 12_000,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Meta long-lived exchange failed (${res.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

export interface FetchedMetaProfile {
  scopes: string[];
  businessId: string | null;
  businessName: string | null;
  facebookPageId: string | null;
  facebookPageName: string | null;
  facebookPageToken: string | null;
  instagramBusinessId: string | null;
  instagramUsername: string | null;
  commerceMerchantSettingsId: string | null;
  catalogId: string | null;
  catalogName: string | null;
}

interface Page {
  id: string;
  name: string;
  access_token?: string;
  instagram_business_account?: { id: string; username?: string };
}

/** Fetches the primary Facebook Page, IG Business account, Business, Commerce Manager and Catalog. */
export async function fetchMetaProfile(userAccessToken: string): Promise<FetchedMetaProfile> {
  const [permissions, pages, businesses] = await Promise.all([
    graphGet<{ data: Array<{ permission: string; status: string }> }>(
      "/me/permissions",
      userAccessToken,
    ),
    graphGet<{ data: Page[] }>("/me/accounts", userAccessToken, {
      fields: "id,name,access_token,instagram_business_account{id,username}",
      limit: "50",
    }),
    graphGet<{ data: Array<{ id: string; name: string }> }>("/me/businesses", userAccessToken, {
      fields: "id,name",
      limit: "50",
    }),
  ]);

  const scopes = permissions.data.filter((p) => p.status === "granted").map((p) => p.permission);
  const primaryPage = pages.data[0] ?? null;
  const primaryBusiness = businesses.data[0] ?? null;

  let commerceMerchantSettingsId: string | null = null;
  let catalogId: string | null = null;
  let catalogName: string | null = null;

  if (primaryBusiness) {
    // Try catalogs first (works with catalog_management).
    try {
      const catalogs = await graphGet<{ data: Array<{ id: string; name: string }> }>(
        `/${primaryBusiness.id}/owned_product_catalogs`,
        userAccessToken,
        { fields: "id,name", limit: "50" },
      );
      if (catalogs.data.length > 0) {
        catalogId = catalogs.data[0].id;
        catalogName = catalogs.data[0].name;
      }
    } catch {
      /* catalog scope may not be granted */
    }
    // Commerce Manager (may require commerce_account_read_settings; best-effort).
    try {
      const commerce = await graphGet<{ data: Array<{ id: string }> }>(
        `/${primaryBusiness.id}/commerce_merchant_settings`,
        userAccessToken,
        { fields: "id", limit: "10" },
      );
      if (commerce.data.length > 0) commerceMerchantSettingsId = commerce.data[0].id;
    } catch {
      /* not granted / not available */
    }
  }

  return {
    scopes,
    businessId: primaryBusiness?.id ?? null,
    businessName: primaryBusiness?.name ?? null,
    facebookPageId: primaryPage?.id ?? null,
    facebookPageName: primaryPage?.name ?? null,
    facebookPageToken: primaryPage?.access_token ?? null,
    instagramBusinessId: primaryPage?.instagram_business_account?.id ?? null,
    instagramUsername: primaryPage?.instagram_business_account?.username ?? null,
    commerceMerchantSettingsId,
    catalogId,
    catalogName,
  };
}

/** Persist (upsert) the fetched profile + tokens for a company. */
export async function upsertMetaIntegration(params: {
  companyId: string;
  userId: string;
  userAccessToken: string;
  expiresIn: number | null;
  profile: FetchedMetaProfile;
}): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const nowMs = Date.now();
  const expiresAt = params.expiresIn ? new Date(nowMs + params.expiresIn * 1000).toISOString() : null;

  const { error } = await supabaseAdmin.from("meta_integrations").upsert(
    {
      company_id: params.companyId,
      connected_by: params.userId,
      access_token: encryptToken(params.userAccessToken),
      token_expires_at: expiresAt,
      scopes: params.profile.scopes,
      meta_business_id: params.profile.businessId,
      meta_business_name: params.profile.businessName,
      facebook_page_id: params.profile.facebookPageId,
      facebook_page_name: params.profile.facebookPageName,
      facebook_page_token: params.profile.facebookPageToken
        ? encryptToken(params.profile.facebookPageToken)
        : null,
      instagram_business_id: params.profile.instagramBusinessId,
      instagram_username: params.profile.instagramUsername,
      commerce_merchant_settings_id: params.profile.commerceMerchantSettingsId,
      catalog_id: params.profile.catalogId,
      catalog_name: params.profile.catalogName,
      last_synced_at: new Date(nowMs).toISOString(),
      updated_at: new Date(nowMs).toISOString(),
    },
    { onConflict: "company_id" },
  );
  if (error) throw error;
}

export interface MetaIntegrationSummary {
  connected: boolean;
  businessId: string | null;
  businessName: string | null;
  facebookPageId: string | null;
  facebookPageName: string | null;
  instagramBusinessId: string | null;
  instagramUsername: string | null;
  commerceMerchantSettingsId: string | null;
  catalogId: string | null;
  catalogName: string | null;
  scopes: string[];
  lastSyncedAt: string | null;
  tokenExpiresAt: string | null;
}

export async function getIntegrationSummary(companyId: string): Promise<MetaIntegrationSummary> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("meta_integrations")
    .select(
      "meta_business_id, meta_business_name, facebook_page_id, facebook_page_name, instagram_business_id, instagram_username, commerce_merchant_settings_id, catalog_id, catalog_name, scopes, last_synced_at, token_expires_at",
    )
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    return {
      connected: false,
      businessId: null,
      businessName: null,
      facebookPageId: null,
      facebookPageName: null,
      instagramBusinessId: null,
      instagramUsername: null,
      commerceMerchantSettingsId: null,
      catalogId: null,
      catalogName: null,
      scopes: [],
      lastSyncedAt: null,
      tokenExpiresAt: null,
    };
  }
  return {
    connected: true,
    businessId: data.meta_business_id,
    businessName: data.meta_business_name,
    facebookPageId: data.facebook_page_id,
    facebookPageName: data.facebook_page_name,
    instagramBusinessId: data.instagram_business_id,
    instagramUsername: data.instagram_username,
    commerceMerchantSettingsId: data.commerce_merchant_settings_id,
    catalogId: data.catalog_id,
    catalogName: data.catalog_name,
    scopes: data.scopes ?? [],
    lastSyncedAt: data.last_synced_at,
    tokenExpiresAt: data.token_expires_at,
  };
}

/** Re-fetches profile from Meta using the stored token and re-upserts. Also
 *  upgrades the token when it's close to expiry (long-lived tokens can be
 *  refreshed by re-exchanging them within the 60-day window). */
export async function refreshCompanyIntegration(companyId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("meta_integrations")
    .select("access_token, token_expires_at, connected_by")
    .eq("company_id", companyId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No Meta integration to refresh.");

  let token = decryptToken(data.access_token);
  let expiresIn: number | null = null;

  // If expiring within 7 days, try to upgrade (long-lived tokens are
  // refreshed by re-running fb_exchange_token before expiry).
  if (data.token_expires_at) {
    const msLeft = new Date(data.token_expires_at).getTime() - Date.now();
    if (msLeft < 7 * 24 * 3600 * 1000) {
      try {
        const long = await upgradeToLongLivedToken(token);
        token = long.access_token;
        expiresIn = long.expires_in ?? null;
      } catch {
        /* keep existing token; caller will surface error later */
      }
    }
  }

  const profile = await fetchMetaProfile(token);
  await upsertMetaIntegration({
    companyId,
    userId: data.connected_by ?? "",
    userAccessToken: token,
    expiresIn,
    profile,
  });
}

export async function deleteCompanyIntegration(companyId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("meta_integrations")
    .delete()
    .eq("company_id", companyId);
  if (error) throw error;
}
