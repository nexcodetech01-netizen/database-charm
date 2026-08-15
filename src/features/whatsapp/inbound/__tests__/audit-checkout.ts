
import { advanceCheckout, createCheckoutSession } from "../checkout-session";
import { peekCheckoutSession, handleCheckoutTurn, saveCheckoutSession, resetCheckoutSessions } from "../checkout-session.server";
import { getCartSession, saveCartSession, resetCartSessions } from "../cart-session.server";
import { addProduct } from "../cart-session";

async function runAudit() {
  console.log("\n[CATALOG CHECKOUT AUDIT - START]");
  
  const companyId = "test-company";
  const phone = "5511999999999";
  
  // Limpa estados
  resetCheckoutSessions();
  resetCartSessions();

  // 1. Simula início de pedido (como se viesse do catálogo do site)
  console.log("\n1. Simulando início de pedido via [PEDIDO-CATALOGO]...");
  let cart = getCartSession(companyId, phone);
  cart = addProduct(cart, { id: "p1", name: "Produto Teste", price: 100, brand: null, categoryId: null, unit: null }, 1);
  saveCartSession(cart);

  const session = createCheckoutSession(companyId, phone);
  session.step = "WAITING_PAYMENT_METHOD";
  saveCheckoutSession(session);
  
  console.log("[DEBUG] CheckoutState INICIAL:", session.step);

  // 2. Simula resposta "Dinheiro"
  const incomingMessage = "Dinheiro";
  console.log("\n2. Mensagem recebida:", incomingMessage);
  
  const checkoutTurn = await handleCheckoutTurn({
    companyId,
    phone,
    text: incomingMessage,
    cart
  });

  console.log("\n[TESTE 1: DINHEIRO]");
  console.log("incomingMessage:", incomingMessage);
  console.log("Bella Response:", checkoutTurn?.text);
  console.log("Next Step:", checkoutTurn?.step);
  
  // Teste 2: Nome
  const nameMessage = "Tiele Thais M Andriani";
  const nameTurn = await handleCheckoutTurn({
    companyId,
    phone,
    text: nameMessage,
    cart
  });
  console.log("\n[TESTE 2: NOME]");
  console.log("incomingMessage:", nameMessage);
  console.log("Bella Response:", nameTurn?.text);
  console.log("Next Step:", nameTurn?.step);

  // Teste 3: Outros pagamentos
  const otherPayments = ["Pix", "Cartão", "cartao", "credito"];
  console.log("\n[TESTE 3: OUTROS PAGAMENTOS]");
  for (const p of otherPayments) {
    resetCheckoutSessions();
    const s = createCheckoutSession(companyId, phone);
    s.step = "WAITING_PAYMENT_METHOD";
    saveCheckoutSession(s);
    
    const turn = await handleCheckoutTurn({ companyId, phone, text: p, cart });
    console.log(`Input: "${p}" -> Next Step: ${turn?.step}`);
  }

  console.log("\n[CATALOG CHECKOUT AUDIT - END]");
}

runAudit().catch(console.error);
