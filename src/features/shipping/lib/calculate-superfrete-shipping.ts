import type { ShippingCalculatorInput, ShippingOption } from "../types";

export interface ShippingCalculationResult {
  options: ShippingOption[];
  /**
   * Mensagens de erro por opção recusada pelo Superfrete (ex.: dimensão
   * menor que o mínimo aceito por aquela transportadora/formato).
   * Antes eram descartadas em silêncio — ver comentário em
   * `calculateSuperfreteShipping`.
   */
  errors: string[];
}

/**
 * Chama a API do Superfrete pra calcular as opções de frete
 * disponíveis de verdade pra um envio.
 *
 * FIX (2026-08-18): extraído de `routes/api/public/shipping/calculate.ts`
 * pra ser chamado DIRETO pela server function `calculateShipping`, sem
 * fazer um fetch HTTP da própria aplicação pra ela mesma (mesmo motivo
 * documentado em `generate-superfrete-label.ts`).
 *
 * Também corrigido: antes o parâmetro `services` estava travado em
 * "1,2,17" (só 3 transportadoras) — opções reais (ex.: JADLOG) nunca
 * apareciam, mesmo disponíveis, porque o site oficial do Superfrete
 * não tem essa restrição. Omitindo o parâmetro, a API decide o
 * conjunto completo de opções disponíveis, igual ao site oficial.
 * E opções recusadas pelo Superfrete (dimensão abaixo do mínimo etc.)
 * agora são coletadas em `errors` em vez de descartadas em silêncio.
 */
export async function calculateSuperfreteShipping(
  input: ShippingCalculatorInput,
): Promise<ShippingCalculationResult> {
  const { cep_origem, cep_destino, peso_kg, altura_cm, largura_cm, comprimento_cm, format, valor_declarado } =
    input;

  const SUPERFRETE_TOKEN = process.env["SUPERFRETE_TOKEN"];
  const SUPERFRETE_ENV = process.env["SUPERFRETE_ENV"] || "sandbox";

  if (!SUPERFRETE_TOKEN) {
    throw new Error("SUPERFRETE_TOKEN not configured");
  }

  const baseUrl =
    SUPERFRETE_ENV === "production"
      ? "https://api.superfrete.com"
      : "https://sandbox.superfrete.com";

  const payload = {
    from: { postal_code: (cep_origem || "").replace(/\D/g, "") },
    to: { postal_code: (cep_destino || "").replace(/\D/g, "") },
    package: {
      format: parseInt(String(format || "3")),
      weight: peso_kg,
      width: largura_cm,
      height: altura_cm,
      length: comprimento_cm,
    },
    options: {
      insurance_value: valor_declarado,
      receipt: false,
      own_hand: false,
    },
  };

  const response = await fetch(`${baseUrl}/api/v0/calculator`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPERFRETE_TOKEN}`,
      "User-Agent": "NexOS Fashion (admin@nexxcode.com.br)",
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const responseText = await response.text();
  let data: any;
  try {
    data = JSON.parse(responseText || "{}");
  } catch {
    throw new Error("Resposta inválida da API do Superfrete");
  }

  if (!response.ok) {
    // FIX (2026-08-18): antes lançava só a mensagem genérica da raiz
    // ("Ocorreu um ou mais erros."), escondendo o motivo real — a
    // Superfrete devolve as mensagens específicas dentro de um objeto
    // `errors` aninhado (ex.: { "freight.calculator.no_result":
    // ["Nenhum frete válido encontrado para esse serviço."] }).
    // Quando é esse tipo de erro (nenhuma opção válida — geralmente
    // por dimensão abaixo do mínimo aceito), tratamos como "zero
    // opções encontradas" com o motivo detalhado, em vez de travar a
    // tela inteira com uma exceção genérica.
    const nestedErrors = data?.errors && typeof data.errors === "object" ? data.errors : null;
    if (nestedErrors) {
      const messages = Object.values(nestedErrors).flat().map(String);
      return { options: [], errors: messages.length > 0 ? messages : [data.message || "Nenhuma opção de frete encontrada."] };
    }
    throw new Error(data.message || "Falha ao calcular frete na SuperFrete");
  }

  const rawOptions = Array.isArray(data) ? data : [data];
  const errors = rawOptions
    .filter((option: any) => option && option.error)
    .map((option: any) => option.error_message || option.message || String(option.error));

  const options: ShippingOption[] = rawOptions
    .filter((option: any) => option && !option.error)
    .map((option: any) => ({
      id: option.id,
      servico: option.name || option.service_name,
      transportadora: option.company?.name || "Correios",
      preco: parseFloat(option.price || option.discount_price || 0),
      prazo_dias: parseInt(option.delivery_time || 0),
    }));

  return { options, errors };
}
