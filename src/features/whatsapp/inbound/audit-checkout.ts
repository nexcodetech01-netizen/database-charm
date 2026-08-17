
import { advanceCheckout, createCheckoutSession, formatWebsiteOrderSummary } from "./checkout-session";
import { createCartSession, addProduct, setProductQuantity } from "./cart-session";

const companyId = "test-company";
const phone = "5511999999999";
const now = Date.now();

async function runAudit() {
  console.log("=== INICIANDO AUDITORIA DA MÁQUINA DE ESTADOS DE CHECKOUT ===\n");

  try {
    // --- Cenário 1: DINHEIRO COM TROCO ---
    console.log("Cenário 1 — DINHEIRO COM TROCO:");
    let cart = createCartSession(companyId, phone, now);
    cart = addProduct(cart, { id: "p1", name: "Produto A", price: 40 } as any, 1, now);
    cart = addProduct(cart, { id: "p2", name: "Produto B", price: 48 } as any, 1, now);
    // @ts-ignore - deliveryFee existe no objeto mas não no tipo estático do TS do carrinho efêmero
    cart.deliveryFee = 5; 
    cart.total = 93;

    let session = createCheckoutSession(companyId, phone, now);
    session.step = "WAITING_PAYMENT_METHOD";

    // 3. Simular resposta "dinheiro"
    let res = await advanceCheckout({ session, cart, text: "dinheiro", now });
    session = res.session;
    
    // 4 & 5. Validação
    const pass1_45 = session.step === "WAITING_CHANGE_INFO" && res.text.includes("troco");
    console.log(`  [${pass1_45 ? "PASS" : "FAIL"}] Transição para WAITING_CHANGE_INFO e pergunta de troco.`);

    // 6 & 7. Resposta "sim"
    res = await advanceCheckout({ session, cart, text: "sim", now });
    session = res.session;
    const pass1_67 = session.step === "WAITING_CHANGE_INFO" && session.changeNeeded === null;
    console.log(`  [${pass1_67 ? "PASS" : "FAIL"}] Continua aguardando valor do troco.`);

    // 8 & 9. Resposta "100"
    res = await advanceCheckout({ session, cart, text: "100", now });
    session = res.session;
    const pass1_89 = session.changeNeeded === true && session.changeAmount === 100 && session.step === "WAITING_DOCUMENT";
    console.log(`  [${pass1_89 ? "PASS" : "FAIL"}] changeNeeded=true, amount=100, step=WAITING_DOCUMENT.`);

    // 10 & 11. Simular CPF
    res = await advanceCheckout({ session, cart, text: "123.456.789-00", now });
    session = res.session;
    const pass1_1011 = session.customer.cpf === "12345678900" && session.step === "WAITING_ADDRESS";
    console.log(`  [${pass1_1011 ? "PASS" : "FAIL"}] CPF armazenado e avanço para endereço.`);

    // 12 & 13. Simular endereço e Resumo
    res = await advanceCheckout({ session, cart, text: "Rua Teste, 123, CEP 01001-000", now });
    session = res.session;
    const summary = res.text;
    const pass1_1213 = summary.includes("Dinheiro") && 
                       summary.includes("Troco: para R$ 100,00") && 
                       summary.includes("123.456.789-00") &&
                       summary.includes("Produto A") && 
                       summary.includes("1 un.");
    console.log(`  [${pass1_1213 ? "PASS" : "FAIL"}] Resumo contém todos os dados obrigatórios e quantidades corretas.`);


    // --- Cenário 2: DINHEIRO SEM TROCO ---
    console.log("\nCenário 2 — DINHEIRO SEM TROCO:");
    session = createCheckoutSession(companyId, phone, now);
    session.step = "WAITING_PAYMENT_METHOD";
    res = await advanceCheckout({ session, cart, text: "dinheiro", now });
    session = res.session;
    
    // 4. Responder "não"
    res = await advanceCheckout({ session, cart, text: "não", now });
    session = res.session;
    const pass2 = session.changeNeeded === false && session.changeAmount === null && session.step === "WAITING_DOCUMENT";
    console.log(`  [${pass2 ? "PASS" : "FAIL"}] changeNeeded=false, amount=null, step=WAITING_DOCUMENT (CPF obrigatório).`);


    // --- Cenário 3: PIX ---
    console.log("\nCenário 3 — PIX:");
    session = createCheckoutSession(companyId, phone, now);
    session.step = "WAITING_PAYMENT_METHOD";
    res = await advanceCheckout({ session, cart, text: "pix", now });
    session = res.session;
    const pass3 = session.step === "WAITING_DOCUMENT" && session.payment === "pix";
    console.log(`  [${pass3 ? "PASS" : "FAIL"}] PIX pula troco e vai direto para WAITING_DOCUMENT (CPF obrigatório).`);


    // --- Cenário 4: CATÁLOGO COM NOME JÁ PREENCHIDO ---
    console.log("\nCenário 4 — CATÁLOGO COM NOME JÁ PREENCHIDO:");
    session = createCheckoutSession(companyId, phone, now);
    session.buyerName = "João Silva"; // Simula [PEDIDO-CATALOGO]
    session.step = "WAITING_PAYMENT_METHOD";
    
    // Testar Dinheiro com nome já preenchido
    res = await advanceCheckout({ session, cart, text: "dinheiro", now });
    const pass4_cash = res.session.step === "WAITING_CHANGE_INFO";
    console.log(`  [${pass4_cash ? "PASS" : "FAIL"}] Dinheiro NÃO pula troco mesmo com buyerName.`);

    // Testar se após troco vai para CPF
    let sessionAfterTroco = res.session;
    res = await advanceCheckout({ session: sessionAfterTroco, cart, text: "não", now });
    const pass4_cpf = res.session.step === "WAITING_DOCUMENT";
    console.log(`  [${pass4_cpf ? "PASS" : "FAIL"}] Após troco, NÃO pula CPF mesmo com buyerName.`);


    // --- Cenário 5: QUANTIDADE ---
    console.log("\nCenário 5 — QUANTIDADE:");
    let cartQty = createCartSession(companyId, phone, now);
    cartQty = addProduct(cartQty, { id: "p1", name: "Produto A", price: 40 } as any, 1, now);
    
    // Simular processamento de um novo [PEDIDO-CATALOGO] que informa qty 1 para o mesmo produto
    // A correção implementada usa setProductQuantity para sincronizar em vez de somar
    cartQty = setProductQuantity(cartQty, { id: "p1", name: "Produto A", price: 40 } as any, 1, now);
    
    const pass5 = cartQty.items.find(i => i.productId === "p1")?.qty === 1;
    console.log(`  [${pass5 ? "PASS" : "FAIL"}] Quantidade permanece 1 (sincronização) e NÃO vira 2.`);

  } catch (e) {
    console.error("\nERRO DURANTE A AUDITORIA:");
    console.error(e);
  }
}

runAudit();
