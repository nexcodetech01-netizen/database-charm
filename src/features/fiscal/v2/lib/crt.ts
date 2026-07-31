/**
 * Fiscal v2 — Código de Regime Tributário (CRT).
 *
 * Fonte única de verdade sobre valores válidos, coerência com o
 * `tax_regime` da empresa e mapeamento do valor enviado ao provedor.
 *
 * Módulo puro (client-safe): sem Supabase, sem process.env.
 *
 * CRT:
 *  1 — Simples Nacional
 *  2 — Simples Nacional (excesso de sublimite de receita bruta)
 *  3 — Regime Normal (Lucro Presumido / Lucro Real)
 *  4 — MEI (Microempreendedor Individual)
 */

export type CrtValue = 1 | 2 | 3 | 4;
export type FiscalTaxRegime = "simples" | "presumido" | "real" | "mei";

export const CRT_VALUES: readonly CrtValue[] = [1, 2, 3, 4];

/** Mensagem única exibida quando a empresa não configurou o CRT. */
export const CRT_NOT_CONFIGURED_MESSAGE = "CRT da empresa não configurado.";

/** CRTs aceitos para cada regime tributário. */
export const CRT_BY_REGIME: Record<FiscalTaxRegime, readonly CrtValue[]> = {
  simples: [1, 2],
  presumido: [3],
  real: [3],
  mei: [4],
};

/** CRT sugerido ao trocar o regime na configuração. */
export function defaultCrtForRegime(regime: FiscalTaxRegime): CrtValue {
  return CRT_BY_REGIME[regime][0];
}

export function isValidCrt(crt: number | null | undefined): crt is CrtValue {
  return crt === 1 || crt === 2 || crt === 3 || crt === 4;
}

/** Coerência entre `tax_regime` e CRT (regra 6 do sprint MEI). */
export function isCrtCoherent(
  regime: FiscalTaxRegime,
  crt: number | null | undefined,
): boolean {
  return isValidCrt(crt) && CRT_BY_REGIME[regime].includes(crt);
}

export function crtCoherenceMessage(regime: FiscalTaxRegime): string {
  const allowed = CRT_BY_REGIME[regime].join(" ou ");
  const label: Record<FiscalTaxRegime, string> = {
    simples: "Simples Nacional",
    presumido: "Lucro Presumido",
    real: "Lucro Real",
    mei: "MEI",
  };
  return `Regime ${label[regime]} exige CRT ${allowed}.`;
}

/**
 * CRT obrigatório para emissão. NUNCA assume 1 automaticamente.
 * @throws Error com `CRT_NOT_CONFIGURED_MESSAGE`
 */
export function requireCrt(crt: number | null | undefined): CrtValue {
  if (!isValidCrt(crt)) throw new Error(CRT_NOT_CONFIGURED_MESSAGE);
  return crt;
}

/**
 * Valor de `regime_tributario_emitente` enviado ao provedor.
 *
 * Enquanto a feature flag `ENABLE_CRT4_MEI` estiver desligada, o CRT 4
 * é transmitido como 1 (Simples Nacional) — comportamento atual, já
 * homologado na Focus NFe. Com a flag ligada, o 4 vai íntegro.
 */
export function resolveProviderCrt(crt: number | null | undefined, enableCrt4Mei: boolean): CrtValue {
  const value = requireCrt(crt);
  if (value === 4 && !enableCrt4Mei) return 1;
  return value;
}
