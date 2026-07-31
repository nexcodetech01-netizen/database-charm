import { digits } from "./masks";
import { isValidCNPJ } from "./validators";
import { lookupCnpj } from "./cnpj-validation.functions";

export type CnpjLookupData = {
  cnpj: string;
  razao_social: string | null;
  nome_fantasia: string | null;
  situacao: string;
};

export type CnpjValidationResult =
  | { ok: true; data?: CnpjLookupData }
  | { ok: false; message: string; code: "invalid_format" };

/**
 * Valida um CNPJ.
 *
 * Regra oficial (NexOS):
 *  - Bloqueia o cadastro APENAS quando o CNPJ é matematicamente inválido
 *    (formato ou dígitos verificadores incorretos).
 *  - A consulta à Receita Federal (BrasilAPI) é apenas complementar:
 *      • serve para enriquecer dados (razão social, situação);
 *      • NUNCA impede o salvamento — se falhar por indisponibilidade,
 *        timeout, 404 ou situação diferente de ATIVA, o cadastro segue.
 *
 * Uso padrão:
 *
 *   const check = await ensureValidCnpj(form.cnpj);
 *   if (!check.ok) { toast.error(check.message); return; }
 *   // check.data pode estar presente (Receita respondeu) ou não — não bloqueie por isso.
 */
export async function ensureValidCnpj(raw: string): Promise<CnpjValidationResult> {
  const cnpj = digits(raw ?? "");
  if (!isValidCNPJ(cnpj)) {
    return {
      ok: false,
      code: "invalid_format",
      message: "CNPJ inválido. Verifique os números informados.",
    };
  }

  // Consulta complementar. Qualquer falha é silenciosa — não bloqueia o usuário.
  try {
    const result = (await lookupCnpj({ data: { cnpj } })) as
      | { ok: true; data: CnpjLookupData }
      | { ok: false; code: string; message: string; data?: CnpjLookupData };
    if (result && result.ok === true) {
      return { ok: true, data: result.data };
    }
    if (result && "data" in result && result.data) {
      return { ok: true, data: result.data };
    }
  } catch {
    // ignore — Receita é opcional
  }
  return { ok: true };
}
