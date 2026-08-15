/**
 * Utilitários para detecção de intenções e formatação de saudações no WhatsApp.
 */
import { normalize } from "./catalog-nav";

/**
 * Retorna uma saudação cordial baseada no horário atual ou genérica.
 */
export function getGreeting(): string {
  const hour = new Date().getUTCHours() - 3; // Ajuste básico para BRT (UTC-3)
  if (hour >= 5 && hour < 12) return "Olá, bom dia! 😊";
  if (hour >= 12 && hour < 18) return "Olá, boa tarde! 😊";
  if (hour >= 18 || hour < 5) return "Olá, boa noite! 😊";
  return "Olá! Tudo bem? 😊";
}

/**
 * Detecta e interpreta o resumo de pedido gerado pelo botão "Finalizar
 * pedido" de um catálogo Lovable (ex: tg-style-catalogue). Formato:
 * "[PEDIDO-CATALOGO]" + itens no padrão "• Nome — N un. — R$ X,XX" +
 * "Total dos produtos:" + "Forma de recebimento:".
 *
 * Sem esse detector a mensagem cai direto no fallback genérico de
 * navegação do catálogo (menu de categorias), ignorando o pedido já
 * montado que o cliente colou.
 */
export interface WebsiteCatalogOrderItem {
  name: string;
  quantity: number;
  price: string;
}

export interface WebsiteCatalogOrder {
  items: WebsiteCatalogOrderItem[];
  total: string;
  deliveryMethod: "tupa" | "other" | "unknown";
  cep?: string;
}

export function parseWebsiteCatalogOrder(text: string): WebsiteCatalogOrder | null {
  // Intl.NumberFormat('pt-BR', { style: 'currency' }) insere um espaço fino
  // (U+00A0, non-breaking space) entre "R$" e o valor — não um espaço comum.
  // Normalizamos aqui para que os regexes abaixo (que usam espaço normal)
  // funcionem com o preço real gerado pelo site, não só com texto digitado.
  const t = (text ?? "").replace(/\u00A0/g, " ");
  const isOrder =
    t.includes("[PEDIDO-CATALOGO]") ||
    t.includes("Gostaria de fazer um pedido") ||
    (t.includes("Total dos produtos:") && t.includes("Forma de recebimento:"));

  if (!isOrder) return null;

  const items: WebsiteCatalogOrderItem[] = [];
  const itemRegex = /• (.*?) — (\d+) un\. — (R\$ [\d,.]+)/g;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(t)) !== null) {
    if (match[1] && match[2] && match[3]) {
      items.push({ name: match[1].trim(), quantity: parseInt(match[2], 10), price: match[3] });
    }
  }

  const totalMatch = t.match(/Total dos produtos: (R\$ [\d,.]+)/);
  const total = totalMatch ? totalMatch[1] : "";

  let deliveryMethod: WebsiteCatalogOrder["deliveryMethod"] = "unknown";
  if (t.includes("Entrega em Tupã")) deliveryMethod = "tupa";
  else if (t.includes("Envio para outra cidade")) deliveryMethod = "other";

  const cepMatch = t.match(/CEP: (\d{5}-\d{3})/);
  const cep = cepMatch ? cepMatch[1] : undefined;

  const nameMatch = t.match(/Nome:\s*(.*)/i);
  const name = nameMatch ? nameMatch[1].trim() : undefined;

  return { items, total, deliveryMethod, cep, name };
}

export interface WebsiteCatalogOrder {
  items: WebsiteCatalogOrderItem[];
  total: string;
  deliveryMethod: "tupa" | "other" | "unknown";
  cep?: string;
  name?: string;
}

/**
 * Detecta se uma mensagem contém um SKU ou nome de produto vindo do catálogo.
 * O padrão comum do catálogo da Meta inclui "SKU: " ou links específicos.
 */
export function parseCatalogProductIntent(text: string): { sku?: string; name?: string } | null {
  const t = text.trim();
  
  // Padrão Meta: "SKU: XXX-XXX"
  const skuMatch = t.match(/SKU:\s*([A-Z0-9\-_]+)/i);
  if (skuMatch) return { sku: skuMatch[1] };

  // Caso venha o link do catálogo ou apenas o nome formatado entre aspas (comum em compartilhamentos)
  const quoteMatch = t.match(/"([^"]+)"/);
  if (quoteMatch && quoteMatch[1].length > 3) return { name: quoteMatch[1] };

  return null;
}

/**
 * Detecta intenção de compra imediata.
 */
export function isPurchaseIntent(text: string): boolean {
  const t = normalize(text ?? "");
  const PURCHASE_RE = /\b(quero comprar|como faco para pagar|pode separar pra mim|vou levar|quero levar|como compro|qual o pix|quero o link)\b/;
  return PURCHASE_RE.test(t);
}

/**
 * Verifica se a mensagem contém um padrão que parece resposta aos dados de entrega/pagamento.
 * Nome completo + CEP (8 dígitos) + Forma de pagamento (Pix/Dinheiro/Cartão)
 */
export function isDataSubmissionIntent(text: string): boolean {
  const t = normalize(text ?? "");
  // Busca por CEP (8 dígitos)
  const hasZip = /\b\d{5}-?\d{3}\b/.test(t);
  // Busca por formas de pagamento
  const hasPayment = /\b(pix|dinheiro|cartao|credito|debito)\b/i.test(t);
  // Se tiver CEP e forma de pagamento, assumimos que são os dados solicitados
  return hasZip && hasPayment;
}

/**
 * Detecta o método de pagamento específico na mensagem.
 */
export function detectPaymentMethod(text: string): 'money' | 'pix_card' | null {
  const t = normalize(text ?? "");
  if (/\b(dinheiro|especie|troco)\b/i.test(t)) return 'money';
  if (/\b(pix|cartao|credito|debito|link)\b/i.test(t)) return 'pix_card';
  return null;
}


