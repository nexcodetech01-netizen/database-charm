/**
 * Fechamento conversacional da Bella (Sprint 6.8 — Etapas 1 e 3).
 *
 * Camada PURA e EFÊMERA: máquina de estados do "fechar pedido", incluindo
 * a coleta dos dados básicos do cliente (nome, PF/PJ, CPF/CNPJ, endereço
 * por CEP e nascimento).
 *
 * NÃO cria cliente, NÃO atualiza cliente, NÃO cria venda, NÃO cria
 * orçamento, NÃO reserva/movimenta estoque, NÃO altera financeiro, CRM,
 * cadastro, catálogo nem qualquer motor oficial do ERP. Nada é gravado no
 * banco do ERP — tudo vive na conversa até virar um atendimento no Inbox.
 */
import { normalize } from "./catalog-nav";
import type { CartSession } from "./cart-session";
import { digits, parseCurrency } from "@/lib/masks";
import { isValidCNPJ, isValidCPF } from "@/lib/validators";

export type CheckoutStep =
  | "WAITING_PAYMENT_METHOD"
  | "WAITING_PAYMENT_METHOD_OTHER_CITY"
  | "WAITING_CHANGE_INFO"
  | "WAITING_CUSTOMER_NAME"
  | "WAITING_DOCUMENT"
  | "WAITING_ADDRESS"
  | "WAITING_SHIPPING_FEE"
  | "WAITING_CONFIRMATION"
  | "buyer_name" // Keep for backward compatibility/internal mapping if needed
  | "person_type"
  | "document"
  | "zip_code"
  | "address_number"
  | "address_complement"
  | "fulfillment"
  | "payment"
  | "change_info"
  | "summary"
  | "done";


export type FulfillmentKind = "pickup" | "delivery";
export type PaymentKind = "pix" | "card" | "cash";
export type PersonType = "pf" | "pj";

export interface CheckoutDelivery {
  city: string | null;
  neighborhood: string | null;
  address: string | null;
  complement: string | null;
}

/** Dados básicos do cliente — vivem apenas no atendimento do Inbox. */
export interface CheckoutCustomer {
  fullName: string | null;
  personType: PersonType | null;
  cpf: string | null;
  cnpj: string | null;
  /** ISO `YYYY-MM-DD` (somente PF). */
  birthDate: string | null;
  zipCode: string | null;
  state: string | null;
  city: string | null;
  district: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
}

export interface CheckoutSession {
  companyId: string;
  phone: string;
  step: CheckoutStep;
  buyerName: string | null;
  customer: CheckoutCustomer;
  fulfillment: FulfillmentKind | null;
  delivery: CheckoutDelivery;
  payment: PaymentKind | null;
  deliveryFee: number | null; // null means "to be calculated"
  totalWithFreight: number;
  changeNeeded: boolean | null;
  changeAmount: number | null;
  createdAt: number;
  updatedAt: number;
  isOtherCity?: boolean; // New flag for city distinction
}

/** Tempo de vida do fechamento conversacional (30 min sem interação). */
export const CHECKOUT_SESSION_TTL_MS = 30 * 60 * 1000;

export const EMPTY_CART_MESSAGE =
  "O seu pedido ainda está vazio! 🛍️ Me conte o que você procura que eu te mostro as nossas melhores opções. 😊";
export const CHECKOUT_ABORTED_MESSAGE =
  "Tudo bem! Cancelei o fechamento por aqui, mas o seu pedido continua salvo. Quando quiser concluir, é só me chamar! 😊";
export const SUMMARY_CONFIRM_MESSAGE = "Está tudo certinho? 😊";

export const INVALID_CPF_MESSAGE =
  "Poxa, esse CPF não parece válido. 😕 Pode conferir os números e me enviar novamente?";
export const INVALID_CNPJ_MESSAGE =
  "Esse CNPJ não parece válido. 😕 Pode dar uma conferida e me enviar de novo?";
export const INVALID_CEP_MESSAGE =
  "O CEP precisa ter 8 dígitos, sabe? Pode me enviar novamente? (ex: 01001-000) 😊";
export const CEP_NOT_FOUND_MESSAGE =
  "Não consegui encontrar esse CEP por aqui. 😕 Pode conferir os números e me mandar novamente?";
export const INVALID_BIRTH_DATE_MESSAGE =
  "A data precisa estar no formato DD/MM/AAAA, tá bom? Pode me enviar novamente? 😊";

const FINALIZE_RE =
  /\b(quero finalizar|finalizar|fechar pedido|fechar o pedido|fechar a compra|concluir compra|concluir o pedido|concluir|pode finalizar|pode fechar|vamos fechar|quero comprar|fechar|continuar)\b/;
const ABORT_RE =
  /\b(cancelar|cancela|desistir|deixa pra la|para|parar|voltar ao catalogo|nao quero mais)\b/;
const RESTART_RE = /\b(recomecar|comecar de novo|reiniciar|refazer|do inicio)\b/;

const PICKUP_RE = /\b(retirar|retirada|retiro|buscar|loja|pegar na loja)\b/;
const DELIVERY_RE = /\b(entrega|entregar|delivery|receber em casa|envio|enviar)\b/;

const PIX_RE = /\bpix\b/i;
const CARD_RE = /\b(cartao|cartão|credito|crédito|debito|débito|card|maquininha)\b/i;
const CASH_RE = /\b(dinheiro|em dinheiro|especie|espécie|cash|a vista|à vista)\b/i;

const PF_RE = /\b(pessoa fisica|fisica|pf|cpf)\b/;
const PJ_RE = /\b(pessoa juridica|juridica|pj|cnpj|empresa)\b/;

const SKIP_RE = /\b(nao|nao tem|sem complemento|pular|nenhum|n\/a|-)\b/;

function emptyCustomer(): CheckoutCustomer {
  return {
    fullName: null,
    personType: null,
    cpf: null,
    cnpj: null,
    birthDate: null,
    zipCode: null,
    state: null,
    city: null,
    district: null,
    street: null,
    number: null,
    complement: null,
  };
}

export function createCheckoutSession(
  companyId: string,
  phone: string,
  now: number = Date.now(),
): CheckoutSession {
  return {
    companyId,
    phone,
    step: "buyer_name",
    buyerName: null,
    customer: emptyCustomer(),
    fulfillment: null,
    delivery: { city: null, neighborhood: null, address: null, complement: null },
    payment: null,
    deliveryFee: null,
    totalWithFreight: 0,
    changeNeeded: null,
    changeAmount: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function isCheckoutSessionExpired(
  session: CheckoutSession | null | undefined,
  now: number = Date.now(),
  ttlMs: number = CHECKOUT_SESSION_TTL_MS,
): boolean {
  if (!session) return true;
  return now - session.updatedAt > ttlMs;
}

/** "quero finalizar", "fechar pedido", "continuar"… */
export function isCheckoutIntent(text: string): boolean {
  const t = normalize(text ?? "");
  if (!t) return false;
  return FINALIZE_RE.test(t);
}

export function isAbortIntent(text: string): boolean {
  const t = normalize(text ?? "");
  return Boolean(t) && ABORT_RE.test(t);
}

export function isRestartIntent(text: string): boolean {
  const t = normalize(text ?? "");
  return Boolean(t) && RESTART_RE.test(t);
}

export function parseFulfillment(text: string): FulfillmentKind | null {
  const t = normalize(text ?? "");
  if (!t) return null;
  if (t === "1") return "pickup";
  if (t === "2") return "delivery";
  if (PICKUP_RE.test(t)) return "pickup";
  if (DELIVERY_RE.test(t)) return "delivery";
  return null;
}

export function parsePayment(text: string): PaymentKind | null {
  const raw = (text ?? "").trim().toLowerCase();
  if (!raw) return null;
  
  // Normalização agressiva: remove acentos e caracteres especiais
  const t = normalize(raw);

  // Mapeamento direto de números (opções do menu)
  if (raw === "1") return "pix";
  if (raw === "2") return "card";
  if (raw === "3") return "cash";

  // PIX
  if (/\b(pix|pagamento via pix)\b/i.test(t) || /\bpix\b/i.test(raw)) return "pix";
  
  // DINHEIRO / ESPÉCIE
  if (/\b(dinheiro|em dinheiro|especie|especie|cash|a vista|ao vivo)\b/i.test(t) || 
      /\b(dinheiro|espécie)\b/i.test(raw)) return "cash";

  // CARTÃO (CRÉDITO/DÉBITO)
  if (/\b(cartao|credito|debito|card|maquininha)\b/i.test(t) ||
      /\b(cartão|crédito|débito)\b/i.test(raw)) return "card";
  
  return null;
}

/** "pessoa física" / "PF" / "1" → pf; "pessoa jurídica" / "PJ" / "2" → pj. */
export function parsePersonType(text: string): PersonType | null {
  const t = normalize(text ?? "");
  if (!t) return null;
  if (t === "1") return "pf";
  if (t === "2") return "pj";
  if (PJ_RE.test(t)) return "pj";
  if (PF_RE.test(t)) return "pf";
  return null;
}

/** CEP com 8 dígitos → só os dígitos; caso contrário `null`. */
export function parseZipCode(text: string): string | null {
  const d = digits(text ?? "");
  return d.length === 8 ? d : null;
}

/** `DD/MM/AAAA` (aceita separadores `/`, `-` ou `.`) → ISO `YYYY-MM-DD`. */
export function parseBirthDate(text: string): string | null {
  const m = /^(\d{2})[/\-.](\d{2})[/\-.](\d{4})$/.exec((text ?? "").trim());
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || year < 1900) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function money(value: number): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(safeValue).replace(/\u00A0/g, " ");
}

export function formatZipCode(zip: string | null): string {
  const d = digits(zip ?? "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (zip ?? "");
}

export function formatDocument(customer: CheckoutCustomer): string {
  if (customer.personType === "pj" && customer.cnpj) {
    const d = digits(customer.cnpj);
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  if (customer.cpf) {
    const d = digits(customer.cpf);
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  return "-";
}

export function formatBirthDate(iso: string | null): string {
  if (!iso) return "-";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

export const PROMPTS: Record<Exclude<CheckoutStep, "summary" | "done">, string> = {
  WAITING_PAYMENT_METHOD: [
    "Qual forma de pagamento você prefere? 😊",
    "",
    "1. PIX",
    "2. Cartão",
    "3. Dinheiro",
  ].join("\n"),
  WAITING_PAYMENT_METHOD_OTHER_CITY: [
    "Qual forma de pagamento você prefere? 😊",
    "",
    "1. PIX",
    "2. Cartão",
  ].join("\n"),

  WAITING_CHANGE_INFO: [
    "💵 Você vai precisar de troco?",
    "Se sim, me informe para quanto. Ex.: R$ 50,00",
    "Se não precisar, responda 'não'.",
  ].join("\n"),
  WAITING_CUSTOMER_NAME: "Qual é o seu nome completo? 😊",
  WAITING_DOCUMENT: "Qual o seu CPF? (só os números, ou com pontos e traço) 😊",
  WAITING_ADDRESS: "Por favor, me informe seu endereço completo com CEP para entrega. 😊",
  WAITING_SHIPPING_FEE: "Aguarde um momentinho! ⏳ Ainda estou calculando o frete para o seu endereço. Assim que tiver o valor, eu te aviso para confirmarmos o pedido final. 😊",
  WAITING_CONFIRMATION: SUMMARY_CONFIRM_MESSAGE,
  buyer_name: "Qual é o seu nome completo? 😊",
  person_type: [
    "Perfeito! E você está comprando como:",
    "",
    "1. Pessoa Física (CPF)",
    "2. Pessoa Juriddica (CNPJ)",
  ].join("\n"),
  document: "Entendido! E qual é o seu CPF? 😊",
  zip_code: "Certo! Agora me conta o seu CEP para a entrega. 🚚",
  address_number: "Qual é o número do endereço? 😊",
  address_complement: "Temos algum complemento por lá? (Apto, bloco, etc. Se não tiver, é só responder *não*! 😊)",
  fulfillment: [
    "Como você prefere receber o seu pedido? 😊",
    "",
    "1. 🏪 Retirada na loja",
    "2. 🚚 Entrega no meu endereço",
  ].join("\n"),
  payment: [
    "Qual forma de pagamento você prefere?",
    "",
    "1. • PIX",
    "2. • Cartão",
    "3. • Dinheiro",
  ].join("\n"),
  change_info: [
    "💵 Você vai precisar de troco?",
    "Se sim, me informe para quanto. Ex.: R$ 50,00",
    "Se não precisar, responda 'não'.",
  ].join("\n"),
};

export const CNPJ_PROMPT = "Entendido! E qual é o CNPJ da empresa? 😊";

/** Pergunta do documento conforme PF/PJ. */
export function documentPrompt(personType: PersonType | null): string {
  return personType === "pj" ? CNPJ_PROMPT : PROMPTS.document;
}

const PAYMENT_LABEL: Record<PaymentKind, string> = {
  pix: "PIX",
  card: "Cartão",
  cash: "Dinheiro",
};

/** Endereço completo em uma linha (a partir dos dados do cliente). */
export function formatCustomerAddress(customer: CheckoutCustomer): string {
  // 1. Extrair CEP se ele estiver grudado no logradouro ou número
  let street = customer.street || "";
  let number = customer.number || "";
  let zip = customer.zipCode || "";

  // Se o street ou number contiverem um padrão de CEP (8 dígitos), removemos
  const zipPattern = /\d{5}-?\d{3}/;
  
  if (zipPattern.test(street)) {
    const match = street.match(zipPattern);
    if (match) {
      if (!zip) zip = digits(match[0]);
      street = street.replace(match[0], "").replace(/,\s*$/, "").trim();
    }
  }

  if (zipPattern.test(number)) {
    const match = number.match(zipPattern);
    if (match) {
      if (!zip) zip = digits(match[0]);
      number = number.replace(match[0], "").trim();
    }
  }


  // 2. Montar a linha
  const addressLine = [street, number].filter(Boolean).join(", ");
  
  const parts = [
    addressLine || null,
    customer.complement,
    customer.district,
    [customer.city, customer.state].filter(Boolean).join("/"),
    formatZipCode(zip) || null,
  ]
    .filter((v): v is string => Boolean(v && String(v).trim()))
    .join(" — ");
    
  return parts;
}

export function formatFulfillmentLine(session: CheckoutSession): string {
  if (session.fulfillment === "pickup") return "🏪 Retirada na loja";
  const address = formatCustomerAddress(session.customer);
  if (address) return `🚚 Entrega — ${address}`;
  const d = session.delivery;
  const parts = [d.address, d.neighborhood, d.city, d.complement].filter(
    (v): v is string => Boolean(v && v.trim()),
  );
  return `🚚 Entrega — ${parts.join(", ")}`;
}

/**
 * Resumo do pedido — fluxo simplificado (iniciado pelo botão "Finalizar
 * pedido" do catálogo do site, mensagem "[PEDIDO-CATALOGO]").
 */
export function formatWebsiteOrderSummary(
  session: CheckoutSession,
  cart: CartSession,
): string {
  const c = session.customer;
  const items = cart.items.map(
    (i) => `• ${i.name} — ${i.qty} un. — ${money(i.unitPrice)} (Subtotal: ${money(i.subtotal)})`,
  );
  
  const subtotal = cart.total;
  const freight = session.deliveryFee;
  const isFreightPending = freight === null;
  const total = isFreightPending ? null : subtotal + (freight || 0);

  const lines = [
    `Perfeito, ${c.fullName || "!"}! Seu pedido ficou assim:`,
    "",
    "Produtos:",
    ...items,
    "",
    `Subtotal: ${money(subtotal)}`,
    `Frete: ${isFreightPending ? "Será calculado para envio" : money(freight || 0)}`,
    `Total: ${total === null ? "A calcular" : money(total)}`,
  ];

  if (isFreightPending) {
    lines.push(
      "",
      "📦 A taxa de envio para sua cidade será calculada conforme o CEP e informada antes da confirmação do pedido."
    );
  }

  lines.push(
    "",
    `CPF: ${c.cpf ? formatDocument(c) : "-"}`,
    "Endereço:",
    formatCustomerAddress(c) || "-",
    "",
    `Forma de recebimento: ${session.fulfillment === "pickup" ? "Retirada" : "Entrega"}`,
    `Forma de pagamento: ${session.payment ? PAYMENT_LABEL[session.payment] : "-"}`,
    session.payment === "cash" 
      ? `Troco: ${session.changeNeeded ? `para ${money(session.changeAmount ?? 0)}` : "Não precisa"}`
      : "",
    "",
    SUMMARY_CONFIRM_MESSAGE,
  );
  return lines.join("\n");
}

/**
 * Resumo do pedido — fluxo conversacional completo (quando o cliente
 * digita "quero finalizar"/"fechar pedido" direto na conversa com a
 * Bella, sem vir do botão do catálogo do site).
 */
export function formatCheckoutSummary(
  session: CheckoutSession,
  cart: CartSession,
): string {
  const c = session.customer;
  const items = cart.items.map(
    (i) => `• *${i.name}* (x${i.qty}) — *${money(i.unitPrice)}* (Subtotal: ${money(i.subtotal)})`,
  );
  const lines = [
    "🛍️ *Resumo do seu Pedido*",
    "",
    `*Cliente:* ${c.fullName || "-"}`,
    `*${c.personType === "pj" ? "CNPJ" : "CPF"}:* ${formatDocument(c)}`,
  ];
  lines.push(`*Endereço:* ${formatCustomerAddress(c) || "-"}`);
  lines.push(
    "",
    "*Entrega:*",
    formatFulfillmentLine(session),
    "",
    "*Pagamento:*",
    session.payment ? PAYMENT_LABEL[session.payment] : "-",
    session.payment === "cash"
      ? `*Troco:* ${session.changeNeeded ? `para ${money(session.changeAmount ?? 0)}` : "Não precisa"}`
      : "",
    "",
    "*Itens do pedido:*",
    ...items,
    "",
    `*Subtotal: ${money(cart.total)}*`,
    `*Frete: ${session.deliveryFee === null ? "Será calculado para envio" : money(session.deliveryFee)}*`,
    `*Total: ${session.deliveryFee === null ? "A calcular" : money(cart.total + session.deliveryFee)}*`,
    "",
    SUMMARY_CONFIRM_MESSAGE,
  );
  return lines.join("\n");
}

export interface CheckoutAdvanceResult {
  session: CheckoutSession;
  /** Resposta da Bella para este turno. */
  text: string;
  /** true quando o fluxo foi abandonado pelo cliente. */
  aborted: boolean;
}

/** Consulta de CEP injetada (ViaCEP no servidor, stub nos testes). */
export type CepResolver = (cep: string) => Promise<{
  street: string;
  neighborhood: string;
  city: string;
  state: string;
} | null>;

function next(
  session: CheckoutSession,
  patch: Partial<CheckoutSession>,
  now: number,
): CheckoutSession {
  return { ...session, ...patch, updatedAt: now };
}

function withCustomer(
  session: CheckoutSession,
  patch: Partial<CheckoutCustomer>,
  rest: Partial<CheckoutSession>,
  now: number,
): CheckoutSession {
  return next(
    session,
    { ...rest, customer: { ...session.customer, ...patch } },
    now,
  );
}

/** Mantém `delivery` (legado do Inbox) espelhando os dados do cliente. */
function syncDelivery(session: CheckoutSession): CheckoutSession {
  const c = session.customer;
  return {
    ...session,
    delivery: {
      city: c.city,
      neighborhood: c.district,
      address: [c.street, c.number].filter(Boolean).join(", ") || null,
      complement: c.complement,
    },
  };
}

/**
 * Avança um passo do fechamento com a mensagem do cliente.
 * Recebe e devolve estado; o único efeito externo possível é a consulta
 * de CEP injetada. Nunca toca em banco do ERP ou motores oficiais.
 */
export async function advanceCheckout(args: {
  session: CheckoutSession;
  cart: CartSession;
  text: string;
  now?: number;
  resolveCep?: CepResolver;
}): Promise<CheckoutAdvanceResult> {
  const now = args.now ?? Date.now();
  const text = (args.text ?? "").trim();
  const session = args.session;

  if (isAbortIntent(text)) {
    return {
      session: next(session, { step: "done" }, now),
      text: CHECKOUT_ABORTED_MESSAGE,
      aborted: true,
    };
  }

  if (isRestartIntent(text)) {
    const fresh = createCheckoutSession(session.companyId, session.phone, now);
    return { session: fresh, text: PROMPTS.buyer_name, aborted: false };
  }

  if (args.cart.items.length === 0) {
    return {
      session: next(session, { step: "done" }, now),
      text: EMPTY_CART_MESSAGE,
      aborted: false,
    };
  }

  console.log(`[AUDIT] ADVANCE_CHECKOUT: step=${session.step}, payment=${session.payment}, text=${JSON.stringify(text)}`);
  switch (session.step) {
    case "WAITING_PAYMENT_METHOD":
    case "WAITING_PAYMENT_METHOD_OTHER_CITY": {
      const payment = parsePayment(text);
      
      // Rejeição explícita de dinheiro para outra cidade
      if (payment === "cash" && session.isOtherCity) {
        return {
          session,
          text: "Poxa, para envios para outra cidade aceitamos apenas PIX ou Cartão. 😊 Qual das duas você prefere? \n\n1. PIX\n2. Cartão",
          aborted: false
        };
      }

      if (!payment) {
        const optionsText = session.isOtherCity ? "Pix ou cartão? 😊" : "Pix, cartão ou dinheiro? 😊";
        return { 
          session, 
          text: `Não consegui identificar a forma de pagamento. Você prefere ${optionsText}`, 
          aborted: false 
        };
      }
      
      const updated = next(session, { payment }, now);
      
      // Se for dinheiro, pergunta do troco obrigatoriamente (só chega aqui se não for isOtherCity)
      if (payment === "cash") {
        return {
          session: next(updated, { step: "WAITING_CHANGE_INFO" }, now),
          text: PROMPTS.WAITING_CHANGE_INFO,
          aborted: false
        };
      }

      // Se NÃO for dinheiro, o fluxo DEVE seguir linearmente para NOME (WAITING_CUSTOMER_NAME) se não tiver nome
      const hasName = !!session.customer.fullName;
      const nextStep = hasName ? "WAITING_DOCUMENT" : "WAITING_CUSTOMER_NAME";
      return {
        session: next(updated, { step: nextStep }, now),
        text: PROMPTS[nextStep],
        aborted: false
      };
    }

    case "WAITING_CHANGE_INFO": {
      const t = normalize(text);
      const isNo = SKIP_RE.test(t) || t === "nao";
      
      if (isNo) {
        const updated = next(session, { changeNeeded: false, changeAmount: null }, now);
        
        // Fluxo linear: Após o troco, ir para NOME ou CPF
        const hasName = !!session.customer.fullName;
        const nextStep = hasName ? "WAITING_DOCUMENT" : "WAITING_CUSTOMER_NAME";
        return {
          session: next(updated, { step: nextStep }, now),
          text: PROMPTS[nextStep],
          aborted: false
        };
      }

      // Tenta extrair valor monetário de forma centralizada usando parseCurrency
      const amount = parseCurrency(text);
      if (amount <= 0 && !isNo) {
        return { session, text: "Não entendi o valor. Se você precisar de troco, me informe para quanto (ex: R$ 50,00). Se não precisar, responda 'não'. 😊", aborted: false };
      }
      const total = args.cart.total;

      // Validação: valor do troco >= total
      if (amount < total) {
        return {
          session,
          text: `⚠️ O valor informado para o troco (${money(amount)}) precisa ser igual ou maior que o total do pedido de ${money(total)}. Para quanto você vai precisar de troco?`,
          aborted: false
        };
      }

      const updated = next(session, { changeNeeded: true, changeAmount: amount }, now);
      
      // Fluxo linear: Após o troco, DEVE ir para CPF (WAITING_DOCUMENT) ou NOME
      const hasName = !!session.customer.fullName;
      const nextStep = hasName ? "WAITING_DOCUMENT" : "WAITING_CUSTOMER_NAME";
      return {
        session: next(updated, { step: nextStep }, now),
        text: `Combinado, troco para ${money(amount)}! 😊 ${PROMPTS[nextStep]}`,
        aborted: false
      };
    }
    case "payment": {
      const payment = parsePayment(text);
      if (!payment) return { session, text: PROMPTS.payment, aborted: false };
      
      const updated = next(session, { payment }, now);
      
      if (payment === "cash") {
        return {
          session: next(updated, { step: "change_info" }, now),
          text: PROMPTS.change_info,
          aborted: false
        };
      }

      const withPayment = next(session, { payment, step: "summary" }, now);
      return {
        session: withPayment,
        text: formatCheckoutSummary(withPayment, args.cart),
        aborted: false,
      };
    }
    case "change_info": {
      const t = normalize(text);
      const isNo = SKIP_RE.test(t) || t === "nao";
      
      if (isNo) {
        const withNoChange = next(session, { changeNeeded: false, changeAmount: null, step: "summary" }, now);
        return {
          session: withNoChange,
          text: formatCheckoutSummary(withNoChange, args.cart),
          aborted: false
        };
      }

      const amount = parseCurrency(text);
      if (amount <= 0 && !isNo) {
        return { session, text: "Não entendi o valor. Se você precisar de troco, me informe para quanto (ex: R$ 50,00). Se não precisar, responda 'não'. 😊", aborted: false };
      }
      const total = args.cart.total;

      if (amount < total) {
        return {
          session,
          text: `⚠️ O valor informado para o troco (${money(amount)}) precisa ser igual ou maior que o total do pedido de ${money(total)}. Para quanto você vai precisar de troco?`,
          aborted: false
        };
      }

      const withChange = next(session, { changeNeeded: true, changeAmount: amount, step: "summary" }, now);
      return {
        session: withChange,
        text: formatCheckoutSummary(withChange, args.cart),
        aborted: false
      };
    }
    case "WAITING_CUSTOMER_NAME": {
      if (!text) return { session, text: `Perfeito! 😊 Qual é o seu nome completo?`, aborted: false };
      
      const updated = withCustomer(
        session,
        { fullName: text },
        { step: "WAITING_DOCUMENT" },
        now
      );

      return {
        session: updated,
        text: `Obrigada, ${text}! 😊 Agora, qual o seu CPF? (só os números, ou com pontos e traço)`,
        aborted: false,
      };
    }
    case "buyer_name": {
      if (!text) return { session, text: PROMPTS.buyer_name, aborted: false };
      return {
        session: withCustomer(
          session,
          { fullName: text },
          { step: "person_type" },
          now,
        ),
        text: PROMPTS.person_type,
        aborted: false,
      };
    }
    case "person_type": {
      const personType = parsePersonType(text);
      if (!personType) return { session, text: PROMPTS.person_type, aborted: false };
      return {
        session: withCustomer(session, { personType }, { step: "document" }, now),
        text: documentPrompt(personType),
        aborted: false,
      };
    }
    case "document": {
      const isPj = session.customer.personType === "pj";
      const d = digits(text);
      if (isPj) {
        if (!isValidCNPJ(d)) {
          return { session, text: INVALID_CNPJ_MESSAGE, aborted: false };
        }
        return {
          session: withCustomer(session, { cnpj: d, cpf: null }, { step: "zip_code" }, now),
          text: PROMPTS.zip_code,
          aborted: false,
        };
      }
      if (!isValidCPF(d)) {
        return { session, text: INVALID_CPF_MESSAGE, aborted: false };
      }
      return {
        session: withCustomer(session, { cpf: d, cnpj: null }, { step: "zip_code" }, now),
        text: PROMPTS.zip_code,
        aborted: false,
      };
    }
    case "WAITING_DOCUMENT": {
      const d = digits(text);
      if (!isValidCPF(d)) {
        return { session, text: INVALID_CPF_MESSAGE, aborted: false };
      }
      const updated = withCustomer(
        session,
        { cpf: d, personType: "pf" },
        { step: "WAITING_ADDRESS" },
        now,
      );
      return {
        session: updated,
        text: `Perfeito! 😊 Agora me informe seu endereço completo com CEP para entrega.`,
        aborted: false,
      };
    }
    case "WAITING_ADDRESS": {
      // 1. Tentar extrair CEP do texto (qualquer sequência de 8 dígitos ou 5-3)
      const zipMatch = text.match(/\d{5}-?\d{3}/);
      const zip = zipMatch ? digits(zipMatch[0]) : null;
      
      // 2. Tentar extrair número (procurar por números isolados após a rua)
      // Se o texto tiver vírgula, o que vem depois costuma ser o número
      let extractedStreet = text;
      let extractedNumber = "";
      
      if (text.includes(",")) {
        const parts = text.split(",");
        extractedStreet = parts[0].trim();
        // O segundo pedaço pode ter número e CEP
        const rest = parts.slice(1).join(",").trim();
        const numMatch = rest.match(/^\d+/);
        if (numMatch) {
          extractedNumber = numMatch[0];
        }
      } else {
        // Sem vírgula, procura por espaço seguido de número no final (antes do CEP se houver)
        const streetWithoutZip = zipMatch ? text.replace(zipMatch[0], "").trim() : text;
        const numMatch = streetWithoutZip.match(/\s(\d+)(\s|$)/);
        if (numMatch) {
          extractedNumber = numMatch[1];
          extractedStreet = streetWithoutZip.replace(numMatch[0], " ").trim();
        }
      }

      // 3. Se temos um CEP, tentamos resolver via API
      if (zip && args.resolveCep) {
         const info = await args.resolveCep(zip);
         if (info) {
            const updated = withCustomer(
              session,
              { 
                zipCode: zip,
                // SOLUÇÃO GENÉRICA: Se a API retornou logradouro, ele é a fonte de verdade
                // Se não retornou (estrada sem nome, etc), usamos o que o cliente digitou
                street: info.street || (extractedStreet.length > 3 ? extractedStreet : ""),
                number: extractedNumber || null,
                district: info.neighborhood,
                city: info.city,
                state: info.state
              },
               { step: session.deliveryFee === null ? "WAITING_SHIPPING_FEE" : "WAITING_CONFIRMATION" },
              now
            );
            return {
              session: syncDelivery(updated),
              text: updated.step === "WAITING_CONFIRMATION" 
                ? formatWebsiteOrderSummary(updated, args.cart)
                : PROMPTS[updated.step as keyof typeof PROMPTS],
              aborted: false
            };
         }
      }

      // 4. Fallback: se o texto for longo o suficiente, aceitamos como endereço livre
      if (text.length > 10) {
        const updated = withCustomer(
          session,
          { 
            street: extractedStreet,
            number: extractedNumber || null,
            zipCode: zip
          },
           { step: session.deliveryFee === null ? "WAITING_SHIPPING_FEE" : "WAITING_CONFIRMATION" },
          now
        );
        return {
          session: syncDelivery(updated),
          text: updated.step === "WAITING_CONFIRMATION"
            ? formatWebsiteOrderSummary(updated, args.cart)
            : PROMPTS[updated.step as keyof typeof PROMPTS],
          aborted: false
        };
      }

      return { session, text: "Não entendi o endereço. Pode me enviar o endereço completo com CEP? 😊", aborted: false };
    }
    case "WAITING_SHIPPING_FEE": {
      const amount = parseCurrency(text);
      if (amount <= 0) {
        return { 
          session, 
          text: "Poxa, não consegui identificar um valor de frete válido. 😕 Pode me informar o valor (ex: R$ 18,00)?", 
          aborted: false 
        };
      }
      
      const updated = next(session, { deliveryFee: amount, step: "WAITING_CONFIRMATION" }, now);
      return {
        session: updated,
        text: formatWebsiteOrderSummary(updated, args.cart),
        aborted: false
      };
    }
    case "zip_code": {
      const zip = parseZipCode(text);
      if (!zip) return { session, text: INVALID_CEP_MESSAGE, aborted: false };
      const found = args.resolveCep ? await args.resolveCep(zip) : null;
      if (!found) return { session, text: CEP_NOT_FOUND_MESSAGE, aborted: false };
      const updated = withCustomer(
        session,
        {
          zipCode: zip,
          street: found.street || null,
          district: found.neighborhood || null,
          city: found.city || null,
          state: found.state || null,
        },
        { step: "address_number" },
        now,
      );
      const found_line = [
        "Encontrei este endereço:",
        "",
        [found.street, found.neighborhood].filter(Boolean).join(", "),
        [found.city, found.state].filter(Boolean).join("/"),
        "",
        PROMPTS.address_number,
      ]
        .filter((l) => l !== undefined)
        .join("\n");
      return { session: syncDelivery(updated), text: found_line, aborted: false };
    }
    case "address_number": {
      if (!text) return { session, text: PROMPTS.address_number, aborted: false };
      const updated = withCustomer(
        session,
        { number: text },
        { step: "address_complement" },
        now,
      );
      return {
        session: syncDelivery(updated),
        text: PROMPTS.address_complement,
        aborted: false,
      };
    }
    case "address_complement": {
      const skip = !text || SKIP_RE.test(normalize(text));
      const updated = withCustomer(
        session,
        { complement: skip ? null : text },
        { step: "fulfillment" },
        now,
      );
      return {
        session: syncDelivery(updated),
        text: PROMPTS.fulfillment,
        aborted: false,
      };
    }
    case "fulfillment": {
      const kind = parseFulfillment(text);
      if (!kind) return { session, text: PROMPTS.fulfillment, aborted: false };
      const updated = next(session, { fulfillment: kind, step: "payment" }, now);
      return {
        session: updated,
        text: PROMPTS.payment,
        aborted: false,
      };
    }
    case "WAITING_CONFIRMATION":
    case "summary": {
      const t = normalize(text);
      const isYes = /\b(sim|ok|pode|confirmar|confirmo|certo|correto|esta correto)\b/.test(t);
      if (isYes) {
        // A confirmação final SOMENTE pode acontecer se o frete estiver definido (não null)
        if (session.deliveryFee === null) {
           return { 
             session, 
             text: "Aguarde um momentinho! ⏳ Ainda estou calculando o frete para o seu endereço. Assim que tiver o valor, eu te aviso para confirmarmos o pedido final. 😊", 
             aborted: false 
           };
        }

        return {
          session: next(session, { step: "done" }, now),
          text: "Perfeito! Seu pedido foi confirmado e nossa equipe já foi avisada. 😊",
          aborted: false,
        };
      }
      return { session, text: SUMMARY_CONFIRM_MESSAGE, aborted: false };
    }

    case "done":
    default:
      return {
        session: next(session, {}, now),
        text: formatCheckoutSummary(session, args.cart),
        aborted: false,
      };
  }
}
