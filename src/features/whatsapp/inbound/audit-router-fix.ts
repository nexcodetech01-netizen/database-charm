import { parseWebsiteCatalogOrder } from "./intent-detector";

function testRouterLogic(text: string) {
  const isCatalogOrderMessage = text.trimStart().startsWith("[PEDIDO-CATALOGO]");
  const websiteOrder = isCatalogOrderMessage ? parseWebsiteCatalogOrder(text) : null;
  
  // Simulation of the new precedence logic
  if (isCatalogOrderMessage && (!websiteOrder || websiteOrder.items.length === 0)) {
    return "HANDLED_AS_PARSING_ERROR_OR_EMPTY";
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
    expected: "HANDLED_AS_PARSING_ERROR_OR_EMPTY"
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

console.log("=== AUDITORIA FINAL DA LÓGICA DE PRECEDÊNCIA DO ROTEADOR ===");
tests.forEach(t => {
  const result = testRouterLogic(t.text);
  console.log(`${t.name}: [${result === t.expected ? "PASS" : "FAIL"}] (Got: ${result})`);
});
