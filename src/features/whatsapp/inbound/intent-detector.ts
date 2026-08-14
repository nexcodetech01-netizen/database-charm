/**
 * Utilitários para detecção de intenções e formatação de saudações no WhatsApp.
 */

/**
 * Retorna uma saudação cordial baseada no horário atual ou genérica.
 */
export function getGreeting(): string {
  const hour = new Date().getUTCHours() - 3; // Ajuste básico para BRT (UTC-3)
  if (hour >= 5 && hour < 12) return "Olá, bom dia! 😃";
  if (hour >= 12 && hour < 18) return "Olá, boa tarde! 😃";
  if (hour >= 18 || hour < 5) return "Olá, boa noite! 😃";
  return "Olá! Tudo bem? 😃";
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
