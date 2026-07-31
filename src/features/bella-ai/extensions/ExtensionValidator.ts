/**
 * ExtensionValidator — valida um manifesto antes de instalar/ativar.
 * Verifica: versão do core, dependências, permissões, duplicidade,
 * compatibilidade e conflitos com extensões já registradas.
 */
import type { ExtensionManifest } from "./types";
import { compareSemVer, isValidSemVer } from "./ExtensionManifest";
import { isValidPermission } from "./ExtensionPermissions";

export interface ExtensionValidationResult {
  ok: boolean;
  errors: string[];
}

export interface ValidatorEnvironment {
  coreVersion: string;
  installedIds: ReadonlySet<string>;
}

export function validateManifest(
  manifest: ExtensionManifest,
  env: ValidatorEnvironment,
): ExtensionValidationResult {
  const errors: string[] = [];

  if (!manifest.id?.trim()) errors.push("id ausente.");
  if (!manifest.name?.trim()) errors.push("name ausente.");
  if (!manifest.version || !isValidSemVer(manifest.version)) {
    errors.push(`version inválida (esperado SemVer). Recebido: "${manifest.version}".`);
  }
  if (!manifest.author?.trim()) errors.push("author ausente.");
  if (!manifest.description?.trim()) errors.push("description ausente.");

  if (!manifest.compatibility?.minCore || !isValidSemVer(manifest.compatibility.minCore)) {
    errors.push("compatibility.minCore ausente ou inválido.");
  } else if (compareSemVer(env.coreVersion, manifest.compatibility.minCore) < 0) {
    errors.push(
      `NexOS ${env.coreVersion} não atende minCore ${manifest.compatibility.minCore}.`,
    );
  }
  if (manifest.compatibility?.maxCore) {
    if (!isValidSemVer(manifest.compatibility.maxCore)) {
      errors.push("compatibility.maxCore inválido.");
    } else if (compareSemVer(env.coreVersion, manifest.compatibility.maxCore) > 0) {
      errors.push(
        `NexOS ${env.coreVersion} excede maxCore ${manifest.compatibility.maxCore}.`,
      );
    }
  }

  // Permissões
  const seenPerms = new Set<string>();
  for (const p of manifest.permissions ?? []) {
    if (!isValidPermission(p)) errors.push(`Permissão inválida: "${p}".`);
    if (seenPerms.has(p)) errors.push(`Permissão duplicada: "${p}".`);
    seenPerms.add(p);
  }

  // Dependências
  for (const dep of manifest.dependencies ?? []) {
    if (!dep?.trim()) errors.push("Dependência vazia declarada.");
    if (dep === manifest.id) errors.push("Extensão depende de si mesma.");
    if (!env.installedIds.has(dep)) {
      errors.push(`Dependência ausente: "${dep}".`);
    }
  }

  // Duplicidade
  if (env.installedIds.has(manifest.id)) {
    errors.push(`ID duplicado: "${manifest.id}" já registrado.`);
  }

  return { ok: errors.length === 0, errors };
}
