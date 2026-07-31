/**
 * Helpers de construção/normalização de Manifest. Puro.
 */
import type { ExtensionManifest, SemVer } from "./types";

const SEMVER_RE = /^\d+\.\d+\.\d+$/;

export function isValidSemVer(v: string): v is SemVer {
  return SEMVER_RE.test(v);
}

/** Compara SemVer: -1 | 0 | 1. */
export function compareSemVer(a: SemVer, b: SemVer): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}

export function defineManifest(m: ExtensionManifest): ExtensionManifest {
  return Object.freeze({ ...m, permissions: [...m.permissions] });
}
