/**
 * Fiscal v2 — semântica do cofre de segredos (`public.fiscal_secrets`).
 *
 * Módulo PURO: espelha, em TypeScript, as regras aplicadas no banco pela
 * migration de credenciais por ambiente. Nenhuma regra fiscal ou de emissão
 * é definida aqui — apenas a chave lógica do vault.
 *
 * Chave lógica (índice único, NULLS NOT DISTINCT):
 *   (company_id, kind, owner_id, environment)
 *
 * Consequência: Homologação e Produção coexistem para o mesmo `kind`.
 */

export type FiscalSecretKind =
  | "provider_api_key"
  | "provider_admin_key"
  | "cert_password"
  | "csc_token";

export type FiscalSecretEnvironment = "homologation" | "production";

export interface FiscalSecretRef {
  companyId: string;
  kind: FiscalSecretKind;
  ownerId: string | null;
  environment: FiscalSecretEnvironment | null;
}

export interface FiscalSecretRow extends FiscalSecretRef {
  ciphertext: string;
  updatedAt: number;
}

/** Segredos do provedor SEMPRE pertencem a um ambiente. */
export function requiresEnvironment(kind: FiscalSecretKind): boolean {
  return kind === "provider_api_key" || kind === "provider_admin_key";
}

export function isValidEnvironment(value: unknown): value is FiscalSecretEnvironment {
  return value === "homologation" || value === "production";
}

/** Chave de unicidade equivalente ao índice do banco. */
export function vaultKey(ref: FiscalSecretRef): string {
  return [ref.companyId, ref.kind, ref.ownerId ?? "\u0000", ref.environment ?? "\u0000"].join("|");
}

export function sameVaultKey(a: FiscalSecretRef, b: FiscalSecretRef): boolean {
  return vaultKey(a) === vaultKey(b);
}

export class FiscalSecretValidationError extends Error {}

export function assertWritable(ref: FiscalSecretRef): void {
  if (ref.environment !== null && !isValidEnvironment(ref.environment)) {
    throw new FiscalSecretValidationError(`invalid environment: ${String(ref.environment)}`);
  }
  if (requiresEnvironment(ref.kind) && ref.environment === null) {
    throw new FiscalSecretValidationError(`environment required for ${ref.kind}`);
  }
}

/**
 * Seleção de leitura: quando o ambiente é informado, NUNCA cai para a
 * credencial de outro ambiente (espelha `readSecret` no engine).
 */
export function selectSecret(
  rows: readonly FiscalSecretRow[],
  ref: FiscalSecretRef,
): FiscalSecretRow | null {
  const matches = rows.filter(
    (r) =>
      r.companyId === ref.companyId &&
      r.kind === ref.kind &&
      (r.ownerId ?? null) === (ref.ownerId ?? null) &&
      (ref.environment === null || (r.environment ?? null) === ref.environment),
  );
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => b.updatedAt - a.updatedAt)[0]!;
}

/**
 * Cofre em memória com a MESMA semântica do banco (delete + insert por
 * chave lógica). Usado nos testes automatizados.
 */
export class InMemoryFiscalVault {
  private rows: FiscalSecretRow[] = [];

  setSecret(ref: FiscalSecretRef, ciphertext: string | null, updatedAt = Date.now()): void {
    assertWritable(ref);
    this.rows = this.rows.filter((r) => !sameVaultKey(r, ref));
    if (!ciphertext) return; // exclusão apenas do ambiente informado
    this.rows.push({ ...ref, ciphertext, updatedAt });
  }

  readSecret(ref: FiscalSecretRef): string | null {
    return selectSecret(this.rows, ref)?.ciphertext ?? null;
  }

  hasSecret(ref: FiscalSecretRef): boolean {
    return selectSecret(this.rows, ref) !== null;
  }

  deleteSecret(ref: FiscalSecretRef): void {
    this.setSecret(ref, null);
  }

  all(): readonly FiscalSecretRow[] {
    return this.rows;
  }
}
