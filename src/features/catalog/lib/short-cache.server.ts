/**
 * Cache curto em memória do servidor para as páginas públicas do catálogo.
 *
 * Cada visita refazia todas as consultas e assinava de novo os links das
 * fotos. Guardamos o resultado por pouco tempo (os links assinados valem
 * 1 hora) e juntamos visitas simultâneas numa só consulta. Só resultados
 * de sucesso são guardados; pré-visualização nunca usa cache.
 */
const TTL_MS = 60_000;
const MAX_ENTRIES = 200;

interface Entry<T> {
  at: number;
  value: T;
}

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(
  key: string,
  load: () => Promise<T>,
  shouldCache: (value: T) => boolean,
): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const p = load()
    .then((value) => {
      if (shouldCache(value)) {
        if (store.size >= MAX_ENTRIES) {
          const oldest = store.keys().next().value;
          if (oldest !== undefined) store.delete(oldest);
        }
        store.set(key, { at: Date.now(), value });
      }
      return value;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}
