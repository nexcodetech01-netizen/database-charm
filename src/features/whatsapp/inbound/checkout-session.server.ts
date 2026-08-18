/**
 * Store PERSISTENTE das sessões de fechamento por conversa (Sprint 6.8 —
 * Etapa 1; persistência corrigida em 2026-08-15).
 *
 * FIX (2026-08-15): antes vivia só na memória do processo do servidor —
 * em hospedagem serverless/edge, a resposta do cliente a uma pergunta do
 * fechamento (ex.: forma de pagamento) podia cair numa instância sem
 * memória da sessão em andamento, fazendo a mensagem "escapar" pra outro
 * sistema (achado real: resposta "Dinheiro" foi parar num handler de
 * saldo financeiro, sem relação com o pedido). Agora grava em
 * `whatsapp_checkout_sessions`, sobrevivendo entre mensagens de forma
 * confiável.
 *
 * Continua sem criar venda, sem criar orçamento, sem reservar estoque,
 * sem alterar financeiro/CRM/cadastro e sem chamar nenhum motor oficial
 * do ERP — é só o estado da conversa, agora persistido.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getCartSession } from "./cart-session.server";
import type { CartSession } from "./cart-session";
import { lookupCep } from "@/lib/cep.service";
import {
  CHECKOUT_SESSION_TTL_MS,
  EMPTY_CART_MESSAGE,
  PROMPTS,
  advanceCheckout,
  createCheckoutSession,
  isCheckoutIntent,
  isCheckoutSessionExpired,
  type CepResolver,
  type CheckoutSession,
} from "./checkout-session";

const TABLE = "whatsapp_checkout_sessions";

/** Sessão viva de fechamento, ou `null` quando não existe / expirou. */
export async function peekCheckoutSession(
  companyId: string,
  phone: string,
  now: number = Date.now(),
): Promise<CheckoutSession | null> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("session_data")
    .eq("company_id", companyId)
    .eq("phone", phone)
    .maybeSingle();

  if (error || !data?.session_data) return null;
  const existing = data.session_data as unknown as CheckoutSession;
  return isCheckoutSessionExpired(existing, now) ? null : existing;
}

export async function saveCheckoutSession(session: CheckoutSession): Promise<CheckoutSession> {
  await supabaseAdmin.from(TABLE).upsert(
    {
      company_id: session.companyId,
      phone: session.phone,
      session_data: session as any,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "company_id,phone" },
  );
  return session;
}

export async function dropCheckoutSession(companyId: string, phone: string): Promise<void> {
  await supabaseAdmin.from(TABLE).delete().eq("company_id", companyId).eq("phone", phone);
}

/** Apenas para testes: limpa todas as sessões (ambiente de teste usa mock do supabaseAdmin). */
export async function resetCheckoutSessions(): Promise<void> {
  await supabaseAdmin.from(TABLE).delete().neq("phone", "__never__");
}

const defaultCepResolver: CepResolver = async (cep) => {
  const found = await lookupCep(cep);
  return found
    ? {
        street: found.street,
        neighborhood: found.neighborhood,
        city: found.city,
        state: found.state,
      }
    : null;
};

export interface CheckoutTurnResult {
  text: string;
  session: CheckoutSession | null;
  /** Passo atual após o turno (null quando o fluxo terminou/abortou). */
  step: CheckoutSession["step"] | null;
  /**
   * true quando o pedido acabou de ser confirmado pelo cliente neste
   * turno (transição para "done" através da confirmação — "sim"/"ok"),
   * diferente de outros caminhos que também zeram a sessão (ex.:
   * carrinho vazio). Usado para saber quando criar o ticket no inbox
   * comercial e disparar a notificação — sem isso, não há como
   * distinguir "pedido confirmado" de "sessão encerrada por outro
   * motivo" a partir de fora desta função.
   */
  confirmed: boolean;
  /**
   * Sessão completa no momento da confirmação (nome, documento,
   * endereço, pagamento) — só preenchida quando `confirmed` é true.
   * `session` já vem `null` nesse caso (sessão encerrada), então isto é
   * o único jeito de quem chamou esta função acessar os dados do
   * cliente para montar o ticket do inbox comercial.
   */
  completedSession: CheckoutSession | null;
}

/**
 * Resolve o turno de fechamento. Retorna `null` quando não há fluxo ativo
 * e a mensagem não é um pedido de fechamento — o fluxo normal segue.
 */
export async function handleCheckoutTurn(args: {
  companyId: string;
  phone: string;
  text: string;
  cart?: CartSession;
  now?: number;
  /** Consulta de CEP (padrão: ViaCEP). Injetável nos testes. */
  resolveCep?: CepResolver;
}): Promise<CheckoutTurnResult | null> {
  console.log(`[AUDIT] HANDLE_CHECKOUT_ENTERED: phone=${args.phone}, text=${args.text}`);
  
  // Defesa: se o texto for um pedido de catálogo, não processar como turno de checkout humano
  if (args.text.trim().startsWith("[PEDIDO-CATALOGO]")) {
    console.log(`[AUDIT] HANDLE_CHECKOUT_ABORTED: catalog message in checkout turn`);
    return null;
  }

  const now = args.now ?? Date.now();
  const cart = args.cart ?? (await getCartSession(args.companyId, args.phone, now));
  const active = await peekCheckoutSession(args.companyId, args.phone, now);

  if (!active) {
    if (!isCheckoutIntent(args.text) && args.text !== "") return null;
    if (cart.items.length === 0) {
      return { text: EMPTY_CART_MESSAGE, session: null, step: null, confirmed: false, completedSession: null };
    }
    const fresh = await saveCheckoutSession(
      createCheckoutSession(args.companyId, args.phone, now),
    );
    // Use the session step's prompt or buyer_name
    const prompt = PROMPTS[fresh.step as keyof typeof PROMPTS] || PROMPTS.buyer_name;
    return { text: prompt, session: fresh, step: fresh.step, confirmed: false, completedSession: null };
  }

  const result = await advanceCheckout({
    session: active,
    cart,
    text: args.text,
    now,
    resolveCep: args.resolveCep ?? defaultCepResolver,
  });
  if (result.session.step === "done") {
    // Confirmado de verdade só quando a sessão VEIO de um passo diferente
    // de "done" (ou seja, a transição aconteceu agora, pela resposta
    // "sim"/"ok" do cliente) — não por outro caminho que também zera a
    // sessão.
    const confirmed = active.step !== "done";
    await dropCheckoutSession(args.companyId, args.phone);
    return {
      text: result.text,
      session: null,
      step: null,
      confirmed,
      completedSession: confirmed ? result.session : null,
    };
  }
  await saveCheckoutSession(result.session);
  return {
    text: result.text,
    session: result.session,
    step: result.session.step,
    confirmed: false,
    completedSession: null,
  };
}
