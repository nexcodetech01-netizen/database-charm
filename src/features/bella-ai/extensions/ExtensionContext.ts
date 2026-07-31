/**
 * ExtensionContext — API entregue à extensão durante `register()`.
 *
 * SEGURANÇA:
 *  - Sem acesso direto ao banco.
 *  - Sem acesso a Secrets.
 *  - Sem bypass de RLS.
 *  - Sem chamar Services diretamente — extensões acionam Skills via
 *    Action Engine existente.
 *  - Sem alterar permissões do sistema.
 */
import type { ExtensionManifest, ExtensionPermission } from "./types";
import { PermissionChecker } from "./ExtensionPermissions";

export interface ExtensionContext {
  readonly manifest: ExtensionManifest;
  readonly permissions: PermissionChecker;
  /** Logger específico da extensão (não expõe console global). */
  readonly log: (level: "info" | "warn" | "error", message: string) => void;
  /** Verifica permissão. Não lança. */
  can(p: ExtensionPermission): boolean;
  /** Verifica ou lança. */
  require(p: ExtensionPermission, label: string): void;
}

export function createExtensionContext(params: {
  manifest: ExtensionManifest;
  log: (level: "info" | "warn" | "error", message: string) => void;
}): ExtensionContext {
  const checker = new PermissionChecker(params.manifest.permissions);
  return {
    manifest: params.manifest,
    permissions: checker,
    log: params.log,
    can: (p) => checker.has(p),
    require: (p, label) => checker.require(p, label),
  };
}
