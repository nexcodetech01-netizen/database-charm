/**
 * Bella Greeting
 *
 * Saudação determinística baseada no horário local. Sem I/O, sem IA.
 */
export function resolveGreeting(now: Date = new Date()): string {
  const h = now.getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
