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
import { digits } from "@/lib/masks";
import { isValidCNPJ, isValidCPF } from "@/lib/validators";

export type CheckoutStep =
  | "buyer_name"
  | "person_type"
  | "document"
  | "zip_code"
  | "address_number"
  | "address_complement"
  | "birth_date"
  | "fulfillment"
  | "payment"
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
  createdAt: number;
  updatedAt: number;
}

/** Tempo de vida do fechamento conversacional (30 min sem interação). */
export const CHECKOUT_SESSION_TTL_MS = 30 * 60 * 1000;

export const EMPTY_CART_MESSAGE =
  "Seu carrinho ainda está vazio 😊 Me diga o que você procura que eu te mostro as opções.";
export const CHECKOUT_ABORTED_MESSAGE =
  "Sem problemas! Cancelei o fechamento, mas seu carrinho continua salvo. 😊";
export const SUMMARY_CONFIRM_MESSAGE = "Está tudo correto? 😊";

export const INVALID_CPF_MESSAGE =
  "Esse CPF não parece válido 😕 Pode conferir e enviar novamente?";
export const INVALID_CNPJ_MESSAGE =
  "Esse CNPJ não parece válido 😕 Pode conferir e enviar novamente?";
export const INVALID_CEP_MESSAGE =
  "O CEP precisa ter 8 dígitos. Pode enviar novamente? (ex: 01001-000)";
export const CEP_NOT_FOUND_MESSAGE =
  "Não encontrei esse CEP 😕 Pode conferir e enviar novamente?";
export const INVALID_BIRTH_DATE_MESSAGE =
  "A data precisa estar no formato DD/MM/AAAA. Pode enviar novamente?";

const FINALIZE_RE =
  /\b(quero finalizar|finalizar|fechar pedido|fechar o pedido|fechar a compra|concluir compra|concluir o pedido|concluir|pode finalizar|pode fechar|vamos fechar|quero comprar|fechar|continuar)\b/;
const ABORT_RE =
  /\b(cancelar|cancela|desistir|deixa pra la|para|parar|voltar ao catalogo|nao quero mais)\b/;
const RESTART_RE = /\b(recomecar|comecar de novo|reiniciar|refazer|do inicio)\b/;

const PICKUP_RE = /\b(retirar|retirada|retiro|buscar|loja|pegar na loja)\b/;
const DELIVERY_RE = /\b(entrega|entregar|delivery|receber em casa|envio|enviar)\b/;

const PIX_RE = /\bpix\b/;
const CARD_RE = /\b(cartao|credito|debito|card|maquininha)\b/;
const CASH_RE = /\b(dinheiro|especie|cash|a vista)\b/;

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
  const t = normalize(text ?? "");
  if (!t) return null;
  if (t === "1") return "pix";
  if (t === "2") return "card";
  if (t === "3") return "cash";
  if (PIX_RE.test(t)) return "pix";
  if (CARD_RE.test(t)) return "card";
  if (CASH_RE.test(t)) return "cash";
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
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number.isFinite(value) ? value : 0);
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
  buyer_name: "Qual é o seu nome completo?",
  person_type: [
    "Você compra como:",
    "",
    "• Pessoa Física",
    "• Pessoa Jurídica",
  ].join("\n"),
  document: "Qual é o seu CPF?",
  zip_code: "Qual é o seu CEP?",
  address_number: "Qual o número do endereço?",
  address_complement: "Algum complemento? (opcional — responda *não* para pular)",
  birth_date: "Qual a sua data de nascimento? (DD/MM/AAAA)",
  fulfillment: ["Como deseja receber?", "", "🏪 Retirada", "🚚 Entrega"].join("\n"),
  payment: ["Forma de pagamento pretendida:", "", "• PIX", "• Cartão", "• Dinheiro"].join(
    "\n",
  ),
};

export const CNPJ_PROMPT = "Qual é o CNPJ da empresa?";

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
  const line = [
    [customer.street, customer.number].filter(Boolean).join(", "),
    customer.complement,
    customer.district,
    [customer.city, customer.state].filter(Boolean).join("/"),
    formatZipCode(customer.zipCode) || null,
  ]
    .filter((v): v is string => Boolean(v && String(v).trim()))
    .join(" — ");
  return line;
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

export function formatCheckoutSummary(
  session: CheckoutSession,
  cart: CartSession,
): string {
  const c = session.customer;
  const items = cart.items.map(
    (i) => `• ${i.qty}x ${i.name} — ${money(i.subtotal)}`,
  );
  const lines = [
    "🛍️ *Resumo do Pedido*",
    "",
    `Cliente: ${c.fullName ?? session.buyerName ?? "-"}`,
    `${c.personType === "pj" ? "CNPJ" : "CPF"}: ${formatDocument(c)}`,
  ];
  if (c.personType === "pf") {
    lines.push(`Nascimento: ${formatBirthDate(c.birthDate)}`);
  }
  lines.push(`Endereço: ${formatCustomerAddress(c) || "-"}`);
  lines.push(
    "",
    "Entrega:",
    formatFulfillmentLine(session),
    "",
    "Pagamento:",
    session.payment ? PAYMENT_LABEL[session.payment] : "-",
    "",
    "Itens:",
    ...items,
    "",
    `Total: ${money(cart.total)}`,
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

  switch (session.step) {
    case "buyer_name": {
      if (!text) return { session, text: PROMPTS.buyer_name, aborted: false };
      return {
        session: withCustomer(
          session,
          { fullName: text },
          { buyerName: text, step: "person_type" },
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
      const isPf = session.customer.personType !== "pj";
      const updated = withCustomer(
        session,
        { complement: skip ? null : text },
        { step: isPf ? "birth_date" : "fulfillment" },
        now,
      );
      return {
        session: syncDelivery(updated),
        text: isPf ? PROMPTS.birth_date : PROMPTS.fulfillment,
        aborted: false,
      };
    }
    case "birth_date": {
      const iso = parseBirthDate(text);
      if (!iso) return { session, text: INVALID_BIRTH_DATE_MESSAGE, aborted: false };
      return {
        session: withCustomer(session, { birthDate: iso }, { step: "fulfillment" }, now),
        text: PROMPTS.fulfillment,
        aborted: false,
      };
    }
    case "fulfillment": {
      const kind = parseFulfillment(text);
      if (!kind) return { session, text: PROMPTS.fulfillment, aborted: false };
      return {
        session: next(session, { fulfillment: kind, step: "payment" }, now),
        text: PROMPTS.payment,
        aborted: false,
      };
    }
    case "payment": {
      const payment = parsePayment(text);
      if (!payment) return { session, text: PROMPTS.payment, aborted: false };
      const withPayment = next(session, { payment, step: "summary" }, now);
      return {
        session: withPayment,
        text: formatCheckoutSummary(withPayment, args.cart),
        aborted: false,
      };
    }
    case "summary":
    case "done":
    default:
      return {
        session: next(session, {}, now),
        text: formatCheckoutSummary(session, args.cart),
        aborted: false,
      };
  }
}
