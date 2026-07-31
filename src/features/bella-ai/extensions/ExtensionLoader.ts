/**
 * ExtensionLoader — normaliza a origem de uma extensão (objeto, factory
 * ou módulo dinâmico) em uma instância `Extension`. Não executa
 * `register()` — isso é responsabilidade do Manager, que aplica
 * validação, permissões e ciclo de vida.
 */
import type { Extension, ExtensionManifest } from "./types";

export type ExtensionSource =
  | Extension
  | (() => Extension | Promise<Extension>)
  | { manifest: ExtensionManifest; register: Extension["register"] };

export async function loadExtension(source: ExtensionSource): Promise<Extension> {
  const resolved = typeof source === "function" ? await source() : source;
  if (!resolved || typeof resolved !== "object") {
    throw new Error("[ExtensionLoader] Fonte inválida — Extension esperada.");
  }
  const ext = resolved as Extension;
  if (!ext.manifest) throw new Error("[ExtensionLoader] manifest ausente.");
  if (typeof ext.register !== "function") {
    throw new Error(`[ExtensionLoader] register() ausente em "${ext.manifest.id}".`);
  }
  return ext;
}
