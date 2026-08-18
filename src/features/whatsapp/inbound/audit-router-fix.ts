import { parseWebsiteCatalogOrder } from "./intent-detector";

function testRouterLogic(text: string) {
  const isCatalogOrderMessage = text.trimStart().startsWith("[PEDIDO-CATALOGO]");
  const websiteOrder = isCatalogOrderMessage ? parseWebsiteCatalogOrder(text) : null;
  
  console.log(`Input starts with [PEDIDO-CATALOGO]: ${isCatalogOrderMessage}`);
  console.log(`Parsed order success: ${!!websiteOrder}`);
  
  // Simulation of the precedence logic
  if (isCatalogOrderMessage && !websiteOrder) {
    return "HANDLED_AS_PARSING_ERROR";
  }
  
  if (isCatalogOrderMessage && websiteOrder) {
    return "HANDLED_AS_NEW_CATALOG_ORDER";
  }
  
  return "HANDLED_BY_CONVERSATIONAL_ENGINE";
}

const tests = [
  {
    name: "Valid Catalog Order",
    text: "[PEDIDO-CATALOGO]\n• Item 1 — 1 un. — R$ 10,00\nTotal dos produtos: R$ 10,00\nForma de recebimento: Entrega em Tupã",
    expected: "HANDLED_AS_NEW_CATALOG_ORDER"
  },
  {
    name: "Malformed Catalog Order (Missing items)",
    text: "[PEDIDO-CATALOGO]\nInvalid format here",
    expected: "HANDLED_AS_PARSING_ERROR"
  },
  {
    name: "Normal message (pix)",
    text: "pix",
    expected: "HANDLED_BY_CONVERSATIONAL_ENGINE"
  },
  {
    name: "Catalog message with leading spaces",
    text: "   [PEDIDO-CATALOGO]\n• Item 1 — 1 un. — R$ 10,00\nTotal dos produtos: R$ 10,00",
    expected: "HANDLED_AS_NEW_CATALOG_ORDER"
  }
];

console.log("=== AUDITORIA DA LÓGICA DE PRECEDÊNCIA DO ROTEADOR ===");
tests.forEach(t => {
  const result = testRouterLogic(t.text);
  console.log(`${t.name}: [${result === t.expected ? "PASS" : "FAIL"}] (Got: ${result})`);
});
