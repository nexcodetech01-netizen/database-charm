import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  disconnectMetaIntegration,
  getMetaIntegration,
  refreshMetaIntegration,
  startMetaOAuth,
} from "@/lib/meta.functions";

/**
 * Meta integration provider (real OAuth + Meta Graph API).
 *
 * Backend-backed connection identity + tokens live in `public.meta_integrations`.
 * Local (per-browser) UI preferences continue to persist in localStorage so
 * that the existing Meta Workspace UI keeps its toggles between reloads.
 */

const LOCAL_UI_KEY = "nexos:meta:ui-prefs";

export interface MetaFacebookSettings {
  pageName: string | null;
  shopEnabled: boolean;
  autoPublish: boolean;
  syncStock: boolean;
  syncPrice: boolean;
}

export interface MetaInstagramSettings {
  username: string | null;
  businessAccount: boolean;
  shoppingActive: boolean;
  autoPublish: boolean;
  syncPrice: boolean;
  syncStock: boolean;
  captionTemplate: string;
  hashtags: string;
  cta: string;
}

export interface MetaCatalogSettings {
  connected: boolean;
  productsTotal: number;
  productsSynced: number;
  productsPending: number;
  productsFailed: number;
}

export interface MetaState {
  connected: boolean;
  businessManager: string | null;
  metaBusinessId: string | null;
  permissions: string[];
  lastSyncAt: string | null;
  facebook: MetaFacebookSettings;
  instagram: MetaInstagramSettings;
  catalog: MetaCatalogSettings;
}

// Split shape: UI prefs are per-browser, connection is server-truth.
interface UIPrefs {
  facebook: Pick<
    MetaFacebookSettings,
    "shopEnabled" | "autoPublish" | "syncStock" | "syncPrice"
  >;
  instagram: Pick<
    MetaInstagramSettings,
    | "shoppingActive"
    | "autoPublish"
    | "syncPrice"
    | "syncStock"
    | "captionTemplate"
    | "hashtags"
    | "cta"
  >;
}

const DEFAULT_UI_PREFS: UIPrefs = {
  facebook: {
    shopEnabled: false,
    autoPublish: false,
    syncStock: true,
    syncPrice: true,
  },
  instagram: {
    shoppingActive: false,
    autoPublish: false,
    syncPrice: true,
    syncStock: true,
    captionTemplate:
      "✨ Novidade na loja!\nConfira este produto selecionado com carinho para você.",
    hashtags: "#novidade #promoção #lojaonline",
    cta: "Peça pelo WhatsApp.",
  },
};

const DEFAULT_STATE: MetaState = {
  connected: false,
  businessManager: null,
  metaBusinessId: null,
  permissions: [],
  lastSyncAt: null,
  facebook: { pageName: null, ...DEFAULT_UI_PREFS.facebook },
  instagram: {
    username: null,
    businessAccount: false,
    ...DEFAULT_UI_PREFS.instagram,
  },
  catalog: {
    connected: false,
    productsTotal: 0,
    productsSynced: 0,
    productsPending: 0,
    productsFailed: 0,
  },
};

function readPrefs(): UIPrefs {
  if (typeof window === "undefined") return DEFAULT_UI_PREFS;
  try {
    const raw = window.localStorage.getItem(LOCAL_UI_KEY);
    if (!raw) return DEFAULT_UI_PREFS;
    const parsed = JSON.parse(raw) as Partial<UIPrefs>;
    return {
      facebook: { ...DEFAULT_UI_PREFS.facebook, ...(parsed.facebook ?? {}) },
      instagram: { ...DEFAULT_UI_PREFS.instagram, ...(parsed.instagram ?? {}) },
    };
  } catch {
    return DEFAULT_UI_PREFS;
  }
}

function writePrefs(value: UIPrefs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LOCAL_UI_KEY, JSON.stringify(value));
  } catch {
    /* noop */
  }
}

interface MetaContextValue {
  hydrated: boolean;
  state: MetaState;
  connecting: boolean;
  connect: () => void;
  disconnect: () => void;
  refreshStatus: () => void;
  updateFacebook: (patch: Partial<MetaFacebookSettings>) => void;
  updateInstagram: (patch: Partial<MetaInstagramSettings>) => void;
  syncCatalogNow: () => void;
}

const MetaContext = createContext<MetaContextValue | null>(null);

export function MetaIntegrationProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<UIPrefs>(DEFAULT_UI_PREFS);
  const [state, setState] = useState<MetaState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const startFn = useServerFn(startMetaOAuth);
  const getFn = useServerFn(getMetaIntegration);
  const refreshFn = useServerFn(refreshMetaIntegration);
  const disconnectFn = useServerFn(disconnectMetaIntegration);

  const mergeServer = useCallback(
    (
      p: UIPrefs,
      server: Awaited<ReturnType<typeof getMetaIntegration>>,
    ): MetaState => ({
      connected: server.connected,
      businessManager: server.businessName,
      metaBusinessId: server.businessId,
      permissions: server.scopes,
      lastSyncAt: server.lastSyncedAt,
      facebook: {
        pageName: server.facebookPageName,
        ...p.facebook,
      },
      instagram: {
        username: server.instagramUsername,
        businessAccount: Boolean(server.instagramBusinessId),
        ...p.instagram,
      },
      catalog: {
        connected: Boolean(server.catalogId),
        // Sync counters are populated by META-002; keep zeros for META-001.
        productsTotal: 0,
        productsSynced: 0,
        productsPending: 0,
        productsFailed: 0,
      },
    }),
    [],
  );

  const loadFromServer = useCallback(async () => {
    try {
      const server = await getFn();
      setState((prev) => {
        const p = prefs;
        return mergeServer(p, server);
      });
    } catch (err) {
      console.error("[meta] failed to load status", err);
    }
  }, [getFn, mergeServer, prefs]);

  // Hydrate: prefs first, then server.
  useEffect(() => {
    const p = readPrefs();
    setPrefs(p);
    setState({
      ...DEFAULT_STATE,
      facebook: { pageName: null, ...p.facebook },
      instagram: { username: null, businessAccount: false, ...p.instagram },
    });
    setHydrated(true);
    (async () => {
      try {
        const server = await getFn();
        setState(mergeServer(p, server));
      } catch (err) {
        console.error("[meta] failed to load status", err);
      }
    })();
  }, [getFn, mergeServer]);

  // Handle OAuth callback query params (?meta_status=connected|error).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("meta_status");
    if (!status) return;
    if (status === "connected") {
      toast.success("Meta conectada com sucesso.");
      loadFromServer();
    } else {
      toast.error("Falha ao conectar a Meta", {
        description: params.get("meta_error") ?? undefined,
      });
    }
    params.delete("meta_status");
    params.delete("meta_error");
    const clean =
      window.location.pathname +
      (params.toString() ? `?${params.toString()}` : "") +
      window.location.hash;
    window.history.replaceState({}, "", clean);
  }, [loadFromServer]);

  const persistPrefs = useCallback((next: UIPrefs) => {
    setPrefs(next);
    writePrefs(next);
    setState((prev) => ({
      ...prev,
      facebook: { ...prev.facebook, ...next.facebook },
      instagram: { ...prev.instagram, ...next.instagram },
    }));
  }, []);

  const connect = useCallback(() => {
    setConnecting(true);
    startFn()
      .then(({ authorizationUrl }) => {
        window.location.href = authorizationUrl;
      })
      .catch((err: unknown) => {
        setConnecting(false);
        toast.error("Não foi possível iniciar a conexão com a Meta", {
          description: err instanceof Error ? err.message : String(err),
        });
      });
  }, [startFn]);

  const disconnect = useCallback(() => {
    disconnectFn()
      .then(() => {
        setState((prev) => ({
          ...prev,
          connected: false,
          businessManager: null,
          metaBusinessId: null,
          permissions: [],
          lastSyncAt: null,
          facebook: { ...prev.facebook, pageName: null },
          instagram: { ...prev.instagram, username: null, businessAccount: false },
          catalog: { ...prev.catalog, connected: false },
        }));
        toast.info("Meta desconectada.");
      })
      .catch((err: unknown) => {
        toast.error("Falha ao desconectar", {
          description: err instanceof Error ? err.message : String(err),
        });
      });
  }, [disconnectFn]);

  const refreshStatus = useCallback(() => {
    refreshFn()
      .then((server) => {
        setState(mergeServer(prefs, server));
      })
      .catch((err: unknown) => {
        toast.error("Falha ao atualizar status Meta", {
          description: err instanceof Error ? err.message : String(err),
        });
      });
  }, [refreshFn, mergeServer, prefs]);

  const updateFacebook = useCallback(
    (patch: Partial<MetaFacebookSettings>) => {
      // Only the persisted-preference subset lives in localStorage;
      // pageName remains driven by the server.
      const nextPrefs: UIPrefs = {
        ...prefs,
        facebook: {
          shopEnabled: patch.shopEnabled ?? prefs.facebook.shopEnabled,
          autoPublish: patch.autoPublish ?? prefs.facebook.autoPublish,
          syncStock: patch.syncStock ?? prefs.facebook.syncStock,
          syncPrice: patch.syncPrice ?? prefs.facebook.syncPrice,
        },
      };
      persistPrefs(nextPrefs);
    },
    [persistPrefs, prefs],
  );

  const updateInstagram = useCallback(
    (patch: Partial<MetaInstagramSettings>) => {
      const nextPrefs: UIPrefs = {
        ...prefs,
        instagram: {
          shoppingActive: patch.shoppingActive ?? prefs.instagram.shoppingActive,
          autoPublish: patch.autoPublish ?? prefs.instagram.autoPublish,
          syncPrice: patch.syncPrice ?? prefs.instagram.syncPrice,
          syncStock: patch.syncStock ?? prefs.instagram.syncStock,
          captionTemplate: patch.captionTemplate ?? prefs.instagram.captionTemplate,
          hashtags: patch.hashtags ?? prefs.instagram.hashtags,
          cta: patch.cta ?? prefs.instagram.cta,
        },
      };
      persistPrefs(nextPrefs);
    },
    [persistPrefs, prefs],
  );

  const syncCatalogNow = useCallback(() => {
    // META-001: catalog identification only; product sync arrives with META-002.
    refreshStatus();
  }, [refreshStatus]);

  const value = useMemo<MetaContextValue>(
    () => ({
      hydrated,
      state,
      connecting,
      connect,
      disconnect,
      refreshStatus,
      updateFacebook,
      updateInstagram,
      syncCatalogNow,
    }),
    [
      hydrated,
      state,
      connecting,
      connect,
      disconnect,
      refreshStatus,
      updateFacebook,
      updateInstagram,
      syncCatalogNow,
    ],
  );

  return <MetaContext.Provider value={value}>{children}</MetaContext.Provider>;
}

export function useMetaIntegration(): MetaContextValue {
  const ctx = useContext(MetaContext);
  if (!ctx) {
    throw new Error(
      "useMetaIntegration deve ser usado dentro de <MetaIntegrationProvider>.",
    );
  }
  return ctx;
}
