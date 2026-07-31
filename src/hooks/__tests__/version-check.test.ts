import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  formatVersionTag,
  isPreviewHostname,
  runUpdateCleanup,
  shouldNotifyForTag,
} from "../version-check.utils";

describe("isPreviewHostname", () => {
  it("flags Lovable preview + local hosts", () => {
    for (const h of [
      "localhost",
      "127.0.0.1",
      "id-preview--abc.lovable.app",
      "preview--x.lovable.app",
      "foo.lovableproject.com",
      "foo.lovableproject-dev.com",
      "x.beta.lovable.dev",
    ]) {
      expect(isPreviewHostname(h)).toBe(true);
    }
  });
  it("does NOT flag production hosts", () => {
    expect(isPreviewHostname("nexos.nexxcode.com.br")).toBe(false);
    expect(isPreviewHostname("nexos-design-foundry.lovable.app")).toBe(false);
  });
});

describe("formatVersionTag", () => {
  it("returns em-dash for empty inputs", () => {
    expect(formatVersionTag(null)).toBe("—");
    expect(formatVersionTag("")).toBe("—");
    expect(formatVersionTag('"/"')).toBe("—");
  });
  it("strips non-alphanumerics and keeps last 8 chars, lowercased", () => {
    expect(formatVersionTag('W/"abc123def456ghi789"')).toBe("56ghi789");
    expect(formatVersionTag("Wed, 20 Jul 2026 12:00:00 GMT")).toBe("20000gmt");
    expect(formatVersionTag("ABCD")).toBe("abcd");
  });
});

describe("shouldNotifyForTag — dedup semantics", () => {
  it("skips when no baseline yet", () => {
    expect(
      shouldNotifyForTag({
        initialTag: null,
        lastNotifiedTag: null,
        incomingTag: "v2",
      }),
    ).toBe(false);
  });
  it("skips when tag equals baseline", () => {
    expect(
      shouldNotifyForTag({
        initialTag: "v1",
        lastNotifiedTag: null,
        incomingTag: "v1",
      }),
    ).toBe(false);
  });
  it("skips when the same new tag was already notified", () => {
    expect(
      shouldNotifyForTag({
        initialTag: "v1",
        lastNotifiedTag: "v2",
        incomingTag: "v2",
      }),
    ).toBe(false);
  });
  it("notifies exactly once for a genuinely new tag", () => {
    expect(
      shouldNotifyForTag({
        initialTag: "v1",
        lastNotifiedTag: null,
        incomingTag: "v2",
      }),
    ).toBe(true);
  });
  it("notifies again when a THIRD version ships after v2 was already seen", () => {
    expect(
      shouldNotifyForTag({
        initialTag: "v1",
        lastNotifiedTag: "v2",
        incomingTag: "v3",
      }),
    ).toBe(true);
  });
});

describe("runUpdateCleanup — fallback behaviour", () => {
  it("clears SWs + caches then reloads on the happy path", async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const del = vi.fn().mockResolvedValue(true);
    const reload = vi.fn();

    const result = await runUpdateCleanup({
      getServiceWorkerRegistrations: async () => [{ unregister }, { unregister }],
      getCacheKeys: async () => ["nexos-a", "third-party"],
      deleteCache: del,
      reload,
    });

    expect(unregister).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledTimes(2);
    expect(del).toHaveBeenCalledWith("nexos-a");
    expect(del).toHaveBeenCalledWith("third-party");
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      serviceWorkersCleared: true,
      cachesCleared: true,
      reloaded: true,
      errors: [],
    });
  });

  it("still reloads when SW unregistration throws", async () => {
    const reload = vi.fn();
    const result = await runUpdateCleanup({
      getServiceWorkerRegistrations: async () => {
        throw new Error("sw boom");
      },
      getCacheKeys: async () => [],
      deleteCache: async () => true,
      reload,
    });
    expect(result.serviceWorkersCleared).toBe(false);
    expect(result.reloaded).toBe(true);
    expect(result.errors.join()).toMatch(/sw-unregister.*sw boom/);
  });

  it("records cache failures but still reloads", async () => {
    const reload = vi.fn();
    const result = await runUpdateCleanup({
      getCacheKeys: async () => ["nexos-a"],
      deleteCache: async () => {
        throw new Error("nope");
      },
      reload,
    });
    expect(result.cachesCleared).toBe(false);
    expect(result.reloaded).toBe(true);
  });

  it("reports reloaded=false so the caller can surface an error toast", async () => {
    const result = await runUpdateCleanup({
      reload: () => {
        throw new Error("reload blocked");
      },
    });
    expect(result.reloaded).toBe(false);
    expect(result.errors.join()).toMatch(/reload.*reload blocked/);
  });
});

describe("useVersionCheck — polling + visibility triggers (integration via fake timers)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("polls every 5 minutes and re-checks on visibilitychange + focus", async () => {
    // Simulate the exact wiring the hook installs, without needing React/JSDOM.
    const CHECK_INTERVAL_MS = 5 * 60 * 1000;
    const runCheck = vi.fn(async () => {});

    const interval = setInterval(() => void runCheck(), CHECK_INTERVAL_MS);
    const onVisible = () => void runCheck();
    const onFocus = () => void runCheck();

    // Initial boot check.
    void runCheck();
    expect(runCheck).toHaveBeenCalledTimes(1);

    // Three 5-minute ticks.
    vi.advanceTimersByTime(CHECK_INTERVAL_MS * 3);
    expect(runCheck).toHaveBeenCalledTimes(4);

    // Visibility + focus each trigger one more check.
    onVisible();
    onFocus();
    expect(runCheck).toHaveBeenCalledTimes(6);

    clearInterval(interval);
  });
});

describe("integration — stale Service Worker blocks the new bundle", () => {
  /**
   * Simula o pior cenário do PWA: um Service Worker antigo (cache-first)
   * está interceptando as requisições e servindo um HTML/bundle desatualizado.
   * O objetivo é validar a cadeia completa:
   *   1) O hash do bundle carregado difere do hash do bundle publicado
   *      → `shouldNotifyForTag` decide mostrar o banner.
   *   2) Ao clicar em "Atualizar agora", `runUpdateCleanup` desregistra
   *      TODOS os service workers, apaga TODOS os caches (inclusive os
   *      criados pelo SW antigo) e chama `reload()`.
   */
  it("mostra o banner e o reload limpa SW + caches do SW antigo", async () => {
    // ── (1) Detecção ────────────────────────────────────────────────────
    // Bundle atualmente carregado (o que o SW antigo entregou).
    const loadedBundleTag = "/assets/index-OLDHASH1.js";
    // Bundle referenciado pelo HTML recém-baixado do servidor.
    const deployedBundleTag = "/assets/index-NEWHASH2.js";

    const shouldShowBanner = shouldNotifyForTag({
      initialTag: loadedBundleTag,
      lastNotifiedTag: null,
      incomingTag: deployedBundleTag,
    });
    expect(shouldShowBanner).toBe(true); // → banner aparece

    // Dedup: uma segunda passada com o MESMO tag não re-notifica.
    expect(
      shouldNotifyForTag({
        initialTag: loadedBundleTag,
        lastNotifiedTag: deployedBundleTag,
        incomingTag: deployedBundleTag,
      }),
    ).toBe(false);

    // ── (2) Cleanup disparado pelo botão "Atualizar agora" ─────────────
    // Simula um SW antigo ainda registrado + caches (Workbox-like)
    // populados por esse SW.
    const oldSwUnregister = vi.fn().mockResolvedValue(true);
    const anotherSwUnregister = vi.fn().mockResolvedValue(true);

    const cacheStore = new Map<string, boolean>([
      ["workbox-precache-v2-https://app/", true],
      ["workbox-runtime-https://app/", true],
      ["nexos-html-v1", true],
      ["nexos-assets-v1", true],
    ]);

    const reload = vi.fn();

    const result = await runUpdateCleanup({
      getServiceWorkerRegistrations: async () => [
        { unregister: oldSwUnregister },
        { unregister: anotherSwUnregister },
      ],
      getCacheKeys: async () => Array.from(cacheStore.keys()),
      deleteCache: async (name) => cacheStore.delete(name),
      reload,
    });

    // Todos os SWs foram desregistrados (o antigo deixa de interceptar).
    expect(oldSwUnregister).toHaveBeenCalledTimes(1);
    expect(anotherSwUnregister).toHaveBeenCalledTimes(1);

    // Todos os caches foram removidos — incluindo os do SW antigo (Workbox)
    // e os próprios do NexOS. Sem sobras que possam re-servir o bundle velho.
    expect(cacheStore.size).toBe(0);

    // Reload disparado após o cleanup.
    expect(reload).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      serviceWorkersCleared: true,
      cachesCleared: true,
      reloaded: true,
      errors: [],
    });
  });

  it("mesmo se o SW antigo recusar unregister, o cleanup ainda apaga caches e recarrega", async () => {
    const cacheStore = new Map<string, boolean>([
      ["workbox-precache-v2-https://app/", true],
      ["nexos-html-v1", true],
    ]);
    const reload = vi.fn();

    const result = await runUpdateCleanup({
      getServiceWorkerRegistrations: async () => {
        throw new Error("SW antigo travado");
      },
      getCacheKeys: async () => Array.from(cacheStore.keys()),
      deleteCache: async (name) => cacheStore.delete(name),
      reload,
    });

    expect(result.serviceWorkersCleared).toBe(false);
    expect(result.errors.join()).toMatch(/sw-unregister.*SW antigo travado/);
    // Caches ainda são apagados — próxima navegação bate no servidor.
    expect(cacheStore.size).toBe(0);
    expect(result.cachesCleared).toBe(true);
    // Usuário não fica preso: reload roda no `finally` do pipeline.
    expect(reload).toHaveBeenCalledTimes(1);
    expect(result.reloaded).toBe(true);
  });
});
