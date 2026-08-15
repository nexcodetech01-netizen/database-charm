
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

  console.log("\n[CATALOG CHECKOUT DEBUG]");
  console.log("conversationId: simulated-conv");
  console.log("checkoutState (Peek):", peekCheckoutSession(companyId, phone)?.step);
  console.log("incomingMessage:", incomingMessage);
  console.log("handlerSelected: handleCheckoutTurn");
  console.log("Bella Response:", checkoutTurn?.text);
  
  if (checkoutTurn?.text.includes("nome completo")) {
    console.log("\nSUCCESS: O checkout interceptou e avançou corretamente.");
  } else {
    console.log("\nFAILURE: O checkout NÃO avançou como esperado.");
  }

  console.log("\n[CATALOG CHECKOUT AUDIT - END]");
}

runAudit().catch(console.error);
