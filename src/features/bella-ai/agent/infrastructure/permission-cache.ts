/**
 * Cache de permissões efetivas do usuário.
 *
 * SEGURANÇA:
 *  - TTL curto (60s).
 *  - Invalidado explicitamente em SIGNED_OUT / USER_UPDATED via
 *    `invalidatePermissionsCache()` (chamar no root após onAuthStateChange).
 *  - Chave = (userId, companyId). Nunca persiste em localStorage.
 */
type Key = string;
interface Entry {
  permissions: ReadonlySet<string>;
  isOwner: boolean;
  expiresAt: number;
}

const TTL_MS = 60_000;
const store = new Map<Key, Entry>();

function key(userId: string, companyId: string): Key {
  return `${userId}::${companyId}`;
}

export function getCachedPermissions(
  userId: string,
  companyId: string,
): { permissions: ReadonlySet<string>; isOwner: boolean } | null {
  const entry = store.get(key(userId, companyId));
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key(userId, companyId));
    return null;
  }
  return { permissions: entry.permissions, isOwner: entry.isOwner };
}

export function setCachedPermissions(
  userId: string,
  companyId: string,
  permissions: Set<string> | ReadonlySet<string>,
  isOwner: boolean,
): void {
  const set = permissions instanceof Set ? permissions : new Set(permissions);
  store.set(key(userId, companyId), {
    permissions: set,
    isOwner,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function invalidatePermissionsCache(userId?: string, companyId?: string): void {
  if (!userId) {
    store.clear();
    return;
  }
  if (!companyId) {
    for (const k of Array.from(store.keys())) if (k.startsWith(`${userId}::`)) store.delete(k);
    return;
  }
  store.delete(key(userId, companyId));
}
