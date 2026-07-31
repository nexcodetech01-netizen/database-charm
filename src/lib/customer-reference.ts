/**
 * Referência curta para apresentação ao cliente (derivada do SKU).
 *
 * O SKU segue o padrão CATEGORIA-MODELO-COR-SEQUENCIAL, por exemplo:
 *   BOL-QUA-PRE-001  →  QUA-PRE-001
 *   BOL-CAR-BEG-001  →  CAR-BEG-001
 *
 * A referência apenas remove o prefixo da categoria (primeiro segmento).
 * Se o SKU não seguir o padrão esperado (>= 4 segmentos separados por "-"
 * e último segmento numérico), devolve o SKU integral sem alterações.
 *
 * ⚠️ Uso EXCLUSIVAMENTE visual (catálogo do cliente, etiquetas, PDF, web).
 * NUNCA usar em cadastro, estoque, vendas, compras, integrações ou DB.
 */

const PATTERN = /^[A-Za-z0-9]+-([A-Za-z0-9]+-[A-Za-z0-9]+-\d+)$/;

export function toCustomerReference(sku: string | null | undefined): string {
  const value = (sku ?? "").trim();
  if (!value) return "";
  const match = value.match(PATTERN);
  return match ? match[1] : value;
}
