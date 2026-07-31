/**
 * Permissões de extensão — declaração explícita e validação.
 *
 * Uma extensão só pode acessar recursos listados em `manifest.permissions`.
 * A verificação é feita antes do `register()` e em cada método do
 * ExtensionContext que exponha operações sensíveis.
 */
import type { ExtensionPermission } from "./types";

export const KNOWN_ROOT_PERMISSIONS: readonly ExtensionPermission[] = [
  "read",
  "write",
  "execute",
  "ai",
  "whatsapp",
] as const;

export function isValidPermission(p: string): p is ExtensionPermission {
  if ((KNOWN_ROOT_PERMISSIONS as readonly string[]).includes(p)) return true;
  return p.startsWith("module:") && p.length > "module:".length;
}

export class PermissionChecker {
  private readonly perms: ReadonlySet<ExtensionPermission>;
  constructor(perms: readonly ExtensionPermission[]) {
    this.perms = new Set(perms);
  }
  has(p: ExtensionPermission): boolean {
    return this.perms.has(p);
  }
  require(p: ExtensionPermission, contextLabel: string): void {
    if (!this.perms.has(p)) {
      throw new Error(
        `[ExtensionPermissions] Permissão "${p}" não declarada no manifesto. Requerida por: ${contextLabel}.`,
      );
    }
  }
  list(): ExtensionPermission[] {
    return [...this.perms];
  }
}
