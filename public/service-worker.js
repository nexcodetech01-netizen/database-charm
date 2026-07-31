/**
 * NexOS — Kill-switch Service Worker v2 (caminho legado).
 *
 * Cópia idêntica de /sw.js publicada em /service-worker.js para cobrir
 * instalações antigas que registraram o worker nesse caminho. Mesma
 * política: limpa apenas caches do próprio app e desregistra ao final.
 */

function isAppCacheForThisRegistration(name) {
  if (/^nexos[-_]/i.test(name)) return true;
  const hasWorkboxBucket =
    /(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/.test(name);
  return hasWorkboxBucket && name.endsWith(self.registration.scope);
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const appCacheNames = cacheNames.filter(isAppCacheForThisRegistration);
        await Promise.allSettled(appCacheNames.map((name) => caches.delete(name)));

        await self.clients.claim();

        const windowClients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(
          windowClients.map((client) => client.navigate(client.url)),
        );
      } finally {
        await self.registration.unregister();
      }
    })(),
  );
});
