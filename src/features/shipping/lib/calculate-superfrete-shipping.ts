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

  // FIX (2026-08-20): a API do Superfrete passou a EXIGIR o campo
  // `services` (erro "(services) é obrigatório" quando omitido) —
  // diferente de quando essa restrição foi removida em 2026-08-18
  // (na época, omitir o campo funcionava e trazia todas as opções).
  // Pra não voltar a travar em só 3 transportadoras (o bug original
  // que motivou remover isso), passamos uma lista ampla de códigos de
  // serviço conhecidos, em vez do "1,2,17" antigo.
  //
  // IMPORTANTE: essa lista foi montada com o conhecimento público mais
  // recente disponível, sem conseguir confirmar ao vivo contra a
  // documentação atual da Superfrete (sem acesso à internet neste
  // ambiente no momento da correção). Vale conferir no painel da
  // Superfrete (Configurações > Transportadoras habilitadas) se essa
  // lista bate com o que sua conta realmente tem disponível — se
  // faltar alguma transportadora que você sabe que deveria aparecer,
  // me avisa o código dela (aparece no painel deles) que eu adiciono.
  // FIX (2026-08-20, revisão 4 — CORREÇÃO DEFINITIVA): a revisão 2
  // (mudar `services` pra array) estava ERRADA. A prova veio da própria
  // resposta de erro da SuperFrete: "data.services.split is not a
  // function" — ou seja, é o BACKEND DELES que chama `.split(",")`
  // nesse campo pra separar os códigos. Isso só funciona se `services`
  // for uma STRING separada por vírgula ("1,2,3,4") — mandar um array
  // quebra o código deles (array não tem `.split`), e o erro que eles
  // devolvem é literalmente essa exceção interna. Revertido pro formato
  // de texto original, que é o que a API deles realmente espera.
  const SUPERFRETE_SERVICES =
    process.env["SUPERFRETE_SERVICES"] || "1,2,3,4,15,16,17,18,22,31,32,33";

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
    services: SUPERFRETE_SERVICES,
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
    // Log detalhado pra facilitar diagnóstico se o erro persistir —
    // mostra exatamente o que foi enviado e o que a SuperFrete
    // devolveu, sem precisar adivinhar de novo.
    console.error("[calculateSuperfreteShipping] Erro da API:", {
      status: response.status,
      payloadSent: payload,
      responseBody: data,
    });
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
    // Sempre inclui o corpo completo da resposta da SuperFrete na
    // mensagem — mesmo quando `data.message` existe, porque esse campo
    // às vezes é só um resumo genérico ("Bad Request") que esconde o
    // detalhe real que vem em outro campo da resposta. Com isso tudo
    // aparece direto na tela, sem precisar de log de servidor.
    const baseMessage = data.message || "Falha ao calcular frete na SuperFrete";
    throw new Error(
      `${baseMessage} (status ${response.status}): ${JSON.stringify(data).slice(0, 500)}`,
    );
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
