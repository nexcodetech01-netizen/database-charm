import type { GenerateLabelInput, LabelResult } from "../types";

/**
 * Chama a API do Superfrete pra gerar a etiqueta de envio de verdade.
 *
 * FIX (2026-08-18): extraído de `routes/api/public/shipping/labels.ts`
 * pra ser chamado DIRETO pela server function `generateLabel` (sem dar
 * a volta de fazer uma requisição HTTP da própria aplicação pra ela
 * mesma). Esse "auto-fetch" era frágil — a server function roda no
 * servidor, onde `window` nunca existe, então a resolução de URL
 * (`typeof window !== "undefined"`) sempre caía no fallback
 * (`VERCEL_URL`, que não existe nesse ambiente Cloudflare, ou uma URL
 * fixa) — se esse fetch de si-pra-si falhasse por qualquer motivo de
 * rede/infra, o erro virava um "Internal Server Error" genérico do
 * framework, escondendo a mensagem detalhada que o Superfrete
 * devolvia. Chamando essa função direto, sem HTTP no meio, o erro real
 * do Superfrete chega correto pra tela.
 */
export async function generateSuperfreteLabel(data: GenerateLabelInput): Promise<LabelResult> {
  const { quote_id, sender, recipient, package_details, service_code } = data;

  const SUPERFRETE_TOKEN = process.env["SUPERFRETE_TOKEN"];
  const SUPERFRETE_ENV = process.env["SUPERFRETE_ENV"] || "sandbox";

  if (!SUPERFRETE_TOKEN) {
    throw new Error("SUPERFRETE_TOKEN not configured");
  }

  const baseUrl =
    SUPERFRETE_ENV === "production"
      ? "https://api.superfrete.com"
      : "https://sandbox.superfrete.com";

  // 1. Adiciona ao carrinho
  const cartPayload = {
    from: {
      name: sender?.name || "NexOS Fashion",
      cpf_cnpj: (sender?.document || "").replace(/\D/g, ""),
      postal_code: (sender?.postal_code || "").replace(/\D/g, ""),
      address: sender?.address || "",
      number: sender?.number || "",
      complement: sender?.complement || "",
      district: sender?.district || "",
      city: sender?.city || "",
      state_abbr: sender?.state || "",
      email: sender?.email || null,
      phone: (sender?.phone || "").replace(/\D/g, ""),
    },
    to: {
      name: recipient?.name || "",
      cpf_cnpj: (recipient?.document || "").replace(/\D/g, ""),
      postal_code: (recipient?.postal_code || "").replace(/\D/g, ""),
      address: recipient?.address || "",
      number: recipient?.number || "",
      complement: recipient?.complement || "",
      district: recipient?.district || "",
      city: recipient?.city || "",
      state_abbr: recipient?.state || "",
      email: recipient?.email || null,
      phone: (recipient?.phone || "").replace(/\D/g, ""),
    },
    service: parseInt(String(service_code)),
    volumes: [
      {
        format: parseInt(String(package_details?.format || "3")),
        weight: package_details?.peso_kg || 0.1,
        width: package_details?.largura_cm || 0,
        height: package_details?.altura_cm || 0,
        length: package_details?.comprimento_cm || 0,
      },
    ],
    options: {
      insurance_value: package_details?.valor_declarado || 0,
      receipt: false,
      own_hand: false,
      reverse: false,
      non_commercial: false,
      invoice_number: (recipient as any)?.invoice_number || null,
    },
  };

  const cartResponse = await fetch(`${baseUrl}/api/v0/cart`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPERFRETE_TOKEN}`,
      "User-Agent": "NexOS Fashion (admin@nexxcode.com.br)",
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cartPayload),
  });

  const cartText = await cartResponse.text();
  const cartData = JSON.parse(cartText || "{}");

  if (!cartResponse.ok) {
    throw new Error(cartData.message || cartData.error || "Falha ao adicionar ao carrinho");
  }

  // 2. Checkout (paga tudo que está no carrinho)
  const checkoutResponse = await fetch(`${baseUrl}/api/v0/checkout`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPERFRETE_TOKEN}`,
      "User-Agent": "NexOS Fashion (admin@nexxcode.com.br)",
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ orders: [cartData.id] }),
  });

  const checkoutText = await checkoutResponse.text();
  const checkoutData = JSON.parse(checkoutText || "{}");

  if (!checkoutResponse.ok) {
    throw new Error(
      checkoutData.message || checkoutData.error || "Falha no checkout (saldo insuficiente?)",
    );
  }

  // 3. Gera a URL real do PDF da etiqueta
  const orderId =
    checkoutData?.order_id ||
    checkoutData?.orders?.[0]?.id ||
    checkoutData?.purchase?.id ||
    checkoutData?.purchase?.orders?.[0]?.id ||
    checkoutData?.id ||
    cartData?.id;

  let labelUrl = `${baseUrl}/api/v0/checkout/print?orders[]=${orderId}`;

  try {
    const printResponse = await fetch(`${baseUrl}/api/v0/tag/print`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SUPERFRETE_TOKEN}`,
        "User-Agent": "NexOS Fashion (admin@nexxcode.com.br)",
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ orders: [orderId] }),
    });

    if (printResponse.ok) {
      const contentType = printResponse.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const printData = await printResponse.json();
        if (printData.url) labelUrl = printData.url;
      }
    }
  } catch {
    // Segue com o fallback de URL definido acima.
  }

  return {
    success: true,
    order_id: orderId,
    tracking_code:
      checkoutData?.tracking_code ||
      checkoutData?.packages?.[0]?.tracking ||
      checkoutData?.orders?.[0]?.packages?.[0]?.tracking ||
      checkoutData?.purchase?.orders?.[0]?.tracking,
    label_url: labelUrl,
  };
}
