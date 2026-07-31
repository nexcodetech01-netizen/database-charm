import { createServerFn } from "@tanstack/react-start";
import { integrationFetch } from "@/lib/http-client.server";

/**
 * Consulta oficial de CNPJ via BrasilAPI (fonte: Receita Federal).
 * Executa no servidor para evitar CORS e centralizar o contrato.
 *
 * Retorna:
 *  - ok:true  → CNPJ existe e está ativo.
 *  - ok:false → CNPJ inválido, inexistente, inapto ou serviço indisponível.
 *               Sempre acompanha uma `message` amigável para exibir ao usuário.
 */
export const lookupCnpj = createServerFn({ method: "POST" })
  .inputValidator((data: { cnpj: string }) => {
    if (!data || typeof data.cnpj !== "string") throw new Error("cnpj obrigatório");
    return { cnpj: data.cnpj.replace(/\D/g, "") };
  })
  .handler(async ({ data }) => {
    const { cnpj } = data;
    if (cnpj.length !== 14) {
      return {
        ok: false as const,
        code: "invalid_format",
        message: "CNPJ inválido. Verifique os números informados.",
      };
    }

    try {
      const res = await integrationFetch(
        `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`,
        { method: "GET", headers: { Accept: "application/json" } },
        { integration: "brasilapi:cnpj", timeoutMs: 10_000 },
      );

      if (res.status === 404) {
        return {
          ok: false as const,
          code: "not_found",
          message: "CNPJ não encontrado na Receita Federal.",
        };
      }

      if (!res.ok) {
        return {
          ok: false as const,
          code: "service_unavailable",
          message:
            "Não foi possível consultar a Receita Federal agora. Tente novamente em instantes.",
        };
      }

      const body = (await res.json()) as {
        cnpj?: string;
        razao_social?: string;
        nome_fantasia?: string;
        descricao_situacao_cadastral?: string; // ATIVA, BAIXADA, INAPTA, SUSPENSA, NULA
      };

      const situacao = (body.descricao_situacao_cadastral ?? "").toUpperCase();
      if (situacao && situacao !== "ATIVA") {
        return {
          ok: false as const,
          code: "inactive",
          message: `CNPJ com situação "${situacao.toLowerCase()}" na Receita Federal. Não é possível cadastrar.`,
          data: {
            cnpj: body.cnpj ?? cnpj,
            razao_social: body.razao_social ?? null,
            nome_fantasia: body.nome_fantasia ?? null,
            situacao,
          },
        };
      }

      return {
        ok: true as const,
        data: {
          cnpj: body.cnpj ?? cnpj,
          razao_social: body.razao_social ?? null,
          nome_fantasia: body.nome_fantasia ?? null,
          situacao: situacao || "ATIVA",
        },
      };
    } catch {
      return {
        ok: false as const,
        code: "service_unavailable",
        message:
          "Não foi possível consultar a Receita Federal agora. Tente novamente em instantes.",
      };
    }
  });
