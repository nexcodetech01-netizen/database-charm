/**
 * NexOS — Kill-switch Service Worker v2
 *
 * Este worker existe apenas para desregistrar versões antigas do PWA e limpar
 * caches herdados de instalações anteriores (Workbox / precache / runtime).
 * Ele NÃO faz cache, NÃO intercepta fetch e NÃO permanece ativo — após a
 * limpeza executa `self.registration.unregister()`.
 *
 * Preserva caches de terceiros (Firebase Messaging, OneSignal, etc.), removendo
 * apenas os buckets do próprio app cujo nome termina com o escopo desta
 * registration (Cache Storage é origin-scoped).
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
        // Precisa rodar em `finally`: `activate` dispara apenas uma vez; se
        // qualquer passo acima rejeitasse, o worker ficaria registrado para
        // sempre.
        await self.registration.unregister();
      }
    })(),
  );
});
